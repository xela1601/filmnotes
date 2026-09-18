import type { Frame, Scan } from '@filmnotes/domain';

import { buildAssignments, assignTo } from './importModel';
import type { PickedFile } from './pickScans';
import { uploadScans } from './uploadScans';
import { FakeSyncClient } from '../../sync/fakeClient';
import type { SyncClient, UploadFile } from '../../sync/client';
import { useStore } from '../../store/store';
import { makeFrame } from '../../testing/fixtures';

const ROLL_ID = 'roll00000000001';
const OWNER_ID = 'user00000000001';
const NOW = '2026-09-18T12:00:00.000Z';

/** `frame0000000003` – the store only accepts 15-character ids. */
const frameId = (index: number): string => `frame${String(index).padStart(10, '0')}`;

function threeFrames(): Frame[] {
  return [1, 2, 3].map((frameNo) =>
    makeFrame({ id: frameId(frameNo), rollId: ROLL_ID, frameNo }),
  );
}

function pick(name: string): PickedFile {
  return { name, uri: `file:///cache/${name}`, mimeType: 'image/jpeg', size: 4 };
}

const FILES = ['scan_1.jpg', 'scan_2.jpg', 'scan_3.jpg'].map(pick);

/**
 * A `SyncClient` that delegates to the in-memory fake but watches (and optionally fails)
 * the uploads. A successful upload answers with the name PocketBase stored the file
 * under, which is never exactly the name that was sent.
 */
function recordingClient(failing: string[] = [], failCleanup = false) {
  const server = new FakeSyncClient();
  const uploads: UploadFile[] = [];

  const client: SyncClient = {
    authWithPassword: (email, password) => server.authWithPassword(email, password),
    authWithToken: (token) => server.authWithToken(token),
    list: (collection, since) => server.list(collection, since),
    create: (collection, record) => server.create(collection, record),
    update: async (collection, id, record) => {
      // `update` is only ever the cleanup of a failed upload.
      if (failCleanup) throw new Error('cleanup failed');
      return server.update(collection, id, record);
    },
    uploadFile: async (collection, id, field, file) => {
      uploads.push(file);
      if (failing.includes(file.name)) throw new Error(`upload of ${file.name} failed`);
      return server.uploadFile(collection, id, field, { ...file, name: `stored_${file.name}` });
    },
    fileUrl: (collection, id, name, thumb) => server.fileUrl(collection, id, name, thumb),
  };

  return { client, server, uploads };
}

function storedScans(): Scan[] {
  return Object.values(useStore.getState().entities.scans).sort(
    (a, b) => a.sortIndex - b.sortIndex,
  );
}

function run(files: PickedFile[], frames: Frame[], client: SyncClient) {
  return uploadScans({
    client,
    ownerId: OWNER_ID,
    rollId: ROLL_ID,
    files,
    assignments: buildAssignments(files, frames),
    upsert: useStore.getState().upsert,
    now: () => NOW,
  });
}

describe('uploadScans', () => {
  beforeEach(() => {
    useStore.getState().resetAll();
  });

  it('creates a record and uploads the file for every scan', async () => {
    const { client, server, uploads } = recordingClient();

    const result = await run(FILES, threeFrames(), client);

    expect(result).toEqual({ uploaded: 3, failed: [] });
    expect(server.createCalls).toHaveLength(3);
    expect(uploads.map((upload) => upload.name)).toEqual([
      'scan_1.jpg',
      'scan_2.jpg',
      'scan_3.jpg',
    ]);
    expect(server.count('scans')).toBe(3);
  });

  it('stores the scans locally with the frame of their assignment and the server file name', async () => {
    const { client } = recordingClient();

    await run(FILES, threeFrames(), client);

    expect(
      storedScans().map((scan) => ({
        fileName: scan.fileName,
        sortIndex: scan.sortIndex,
        frameId: scan.frameId,
        file: scan.file,
        rollId: scan.rollId,
        owner: scan.owner,
        importedAt: scan.importedAt,
      })),
    ).toEqual([
      {
        fileName: 'scan_1.jpg',
        sortIndex: 0,
        frameId: frameId(1),
        file: 'stored_scan_1.jpg',
        rollId: ROLL_ID,
        owner: OWNER_ID,
        importedAt: NOW,
      },
      {
        fileName: 'scan_2.jpg',
        sortIndex: 1,
        frameId: frameId(2),
        file: 'stored_scan_2.jpg',
        rollId: ROLL_ID,
        owner: OWNER_ID,
        importedAt: NOW,
      },
      {
        fileName: 'scan_3.jpg',
        sortIndex: 2,
        frameId: frameId(3),
        file: 'stored_scan_3.jpg',
        rollId: ROLL_ID,
        owner: OWNER_ID,
        importedAt: NOW,
      },
    ]);
  });

  it('keeps going after a failed upload and names the file that did not make it', async () => {
    const { client } = recordingClient(['scan_2.jpg']);

    const result = await run(FILES, threeFrames(), client);

    expect(result).toEqual({ uploaded: 2, failed: ['scan_2.jpg'] });
    expect(storedScans().map((scan) => scan.fileName)).toEqual(['scan_1.jpg', 'scan_3.jpg']);
    expect(storedScans().every((scan) => scan.file !== null)).toBe(true);
  });

  it('soft-deletes the server record of a failed upload', async () => {
    const { client, server } = recordingClient(['scan_2.jpg']);

    await run(FILES, threeFrames(), client);

    const orphans = server
      .records('scans')
      .filter((record) => record.fileName === 'scan_2.jpg');
    expect(orphans).toHaveLength(1);
    expect(orphans[0]?.deleted).toBe(NOW);
  });

  it('keeps going when even the cleanup of a failed upload fails', async () => {
    const { client } = recordingClient(['scan_2.jpg'], true);

    const result = await run(FILES, threeFrames(), client);

    expect(result).toEqual({ uploaded: 2, failed: ['scan_2.jpg'] });
    expect(storedScans().map((scan) => scan.fileName)).toEqual(['scan_1.jpg', 'scan_3.jpg']);
  });

  it('stores an unassigned scan without a frame', async () => {
    const { client } = recordingClient();
    const frames = threeFrames();

    await uploadScans({
      client,
      ownerId: OWNER_ID,
      rollId: ROLL_ID,
      files: FILES,
      assignments: assignTo(buildAssignments(FILES, frames), frames, 1, null),
      upsert: useStore.getState().upsert,
      now: () => NOW,
    });

    expect(storedScans().map((scan) => scan.frameId)).toEqual([frameId(1), null, frameId(3)]);
  });

  it('lines the files up with the assignments regardless of the order they were picked in', async () => {
    const { client, uploads } = recordingClient();
    const frames = threeFrames();
    const shuffled = ['scan_3.jpg', 'scan_1.jpg', 'scan_2.jpg'].map(pick);

    await run(shuffled, frames, client);

    expect(uploads.map((upload) => upload.name)).toEqual([
      'scan_1.jpg',
      'scan_2.jpg',
      'scan_3.jpg',
    ]);
    expect(storedScans().map((scan) => scan.frameId)).toEqual([
      frameId(1),
      frameId(2),
      frameId(3),
    ]);
  });

  it('posts the blob on web and the local uri on a device', async () => {
    const { client, uploads } = recordingClient();
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });

    await run([{ ...pick('scan_1.jpg'), blob }, pick('scan_2.jpg')], threeFrames(), client);

    expect(uploads[0]).toEqual({ name: 'scan_1.jpg', type: 'image/jpeg', blob });
    expect(uploads[1]).toEqual({
      name: 'scan_2.jpg',
      type: 'image/jpeg',
      uri: 'file:///cache/scan_2.jpg',
    });
  });

  it('reports nothing to do for an empty pick', async () => {
    const { client, server } = recordingClient();

    expect(await run([], threeFrames(), client)).toEqual({ uploaded: 0, failed: [] });
    expect(server.createCalls).toEqual([]);
  });
});
