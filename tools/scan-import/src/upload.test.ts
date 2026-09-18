import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ID_PATTERN } from '@filmnotes/domain';
import type { ScanAssignment } from '@filmnotes/domain';

import type { ImageFile } from './files';
import { jpegBytes } from './testImages';
import type { PocketBaseLike } from './upload';
import { uploadPlan } from './upload';

const OWNER = 'owner1000000000';
const ROLL = 'roll10000000000';

interface CreateCall {
  collection: string;
  data: Record<string, unknown>;
}
interface UpdateCall {
  collection: string;
  id: string;
  form: FormData;
}

/** A `pb` stand-in that records what the upload did and can be told to fail. */
function fakePocketBase(options: { failCreate?: string[]; failUpdate?: string[] } = {}): {
  pb: PocketBaseLike;
  creates: CreateCall[];
  updates: UpdateCall[];
} {
  const creates: CreateCall[] = [];
  const updates: UpdateCall[] = [];
  const pb: PocketBaseLike = {
    collection: (collection: string) => ({
      async create(data: Record<string, unknown>) {
        const fileName = String(data.fileName);
        if (options.failCreate?.includes(fileName) === true) {
          throw new Error(`create refused ${fileName}`);
        }
        creates.push({ collection, data });
        return { id: String(data.id) };
      },
      async update(id: string, form: FormData) {
        const file = form.get('file');
        const name = file instanceof File ? file.name : '';
        if (options.failUpdate?.includes(name) === true) {
          throw new Error(`upload refused ${name}`);
        }
        updates.push({ collection, id, form });
        return { id };
      },
    }),
  };
  return { pb, creates, updates };
}

let workDir: string;
let files: ImageFile[];
const assignments: ScanAssignment[] = [
  { fileName: 'img1.jpg', sortIndex: 0, frameId: 'frame1000000001', frameNo: 1 },
  { fileName: 'img2.jpg', sortIndex: 1, frameId: 'frame1000000002', frameNo: 2 },
  { fileName: 'img3.jpg', sortIndex: 2, frameId: null, frameNo: null },
];

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'scan-import-upload-test-'));
  files = assignments.map((assignment) => {
    const path = join(workDir, assignment.fileName);
    writeFileSync(path, jpegBytes());
    return { name: assignment.fileName, path, mimeType: 'image/jpeg' };
  });
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe('uploadPlan', () => {
  it('creates a scan record per file and then uploads the bytes', async () => {
    const { pb, creates, updates } = fakePocketBase();
    const log: string[] = [];

    const result = await uploadPlan(pb, OWNER, ROLL, files, assignments, (line) => log.push(line));

    expect(result).toEqual({ uploaded: 3, failed: [] });
    expect(creates.map((call) => call.collection)).toEqual(['scans', 'scans', 'scans']);
    expect(updates.map((call) => call.collection)).toEqual(['scans', 'scans', 'scans']);
    expect(log).toHaveLength(3);

    const first = creates[0]!.data;
    expect(String(first.id)).toMatch(ID_PATTERN);
    expect(first.rollId).toBe(ROLL);
    expect(first.frameId).toBe('frame1000000001');
    expect(first.fileName).toBe('img1.jpg');
    expect(first.sortIndex).toBe(0);
    expect(first.owner).toBe(OWNER);
    expect(first.deleted).toBeNull();
    expect(String(first.importedAt)).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
    expect(first.clientUpdated).toBe(first.importedAt);

    // The file goes into the record that was just created, under the `file` field.
    expect(updates[0]!.id).toBe(first.id);
    const uploaded = updates[0]!.form.get('file');
    expect(uploaded).toBeInstanceOf(File);
    const blob = uploaded as File;
    expect(blob.name).toBe('img1.jpg');
    expect(blob.type).toBe('image/jpeg');
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(jpegBytes());
  });

  it('sends a null frameId for an unassigned file', async () => {
    const { pb, creates } = fakePocketBase();

    await uploadPlan(pb, OWNER, ROLL, files, assignments, () => undefined);

    expect(creates[2]!.data.frameId).toBeNull();
    expect(creates[2]!.data.sortIndex).toBe(2);
  });

  it('reports a failed record creation and continues with the other files', async () => {
    const { pb, creates, updates } = fakePocketBase({ failCreate: ['img2.jpg'] });
    const log: string[] = [];

    const result = await uploadPlan(pb, OWNER, ROLL, files, assignments, (line) => log.push(line));

    expect(result.uploaded).toBe(2);
    expect(result.failed).toEqual(['img2.jpg']);
    expect(creates.map((call) => call.data.fileName)).toEqual(['img1.jpg', 'img3.jpg']);
    expect(updates).toHaveLength(2);
    expect(log.join('\n')).toContain('create refused img2.jpg');
  });

  it('reports a failed file upload and names the record that stayed empty', async () => {
    const { pb, creates } = fakePocketBase({ failUpdate: ['img1.jpg'] });
    const log: string[] = [];

    const result = await uploadPlan(pb, OWNER, ROLL, files, assignments, (line) => log.push(line));

    expect(result.uploaded).toBe(2);
    expect(result.failed).toEqual(['img1.jpg']);
    expect(log.join('\n')).toContain(String(creates[0]!.data.id));
  });

  it('reports a file that disappeared between the plan and the upload', async () => {
    rmSync(files[1]!.path);
    const { pb } = fakePocketBase();

    const result = await uploadPlan(pb, OWNER, ROLL, files, assignments, () => undefined);

    expect(result.uploaded).toBe(2);
    expect(result.failed).toEqual(['img2.jpg']);
  });
});
