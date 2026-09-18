import type { ExportLog } from '@filmnotes/domain';
import {
  registerExporter,
  shareConfigSchema,
  type Exporter,
  type ExportInput,
  type ExporterDeps,
  type ExportImage,
  type ExportResult,
} from '@filmnotes/exporters';

import { ExportPreconditionError, runFrameExport } from './runExport';
import { createAppStore } from '../../store/store';
import {
  makeCamera,
  makeFilmStock,
  makeFrame,
  makeRoll,
} from '../../testing/fixtures';

const NOW = '2026-09-18T12:00:00.000Z';
const FRAME = makeFrame({ notes: 'Harbour crane' });
const IMAGE: ExportImage = {
  bytes: new Uint8Array([7, 8, 9]),
  mimeType: 'image/jpeg',
  fileName: 'img001.jpg',
};

/** An isolated store seeded with the records a frame export needs. */
function seededStore(complete = true): ReturnType<typeof createAppStore> {
  const store = createAppStore({
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  });
  const { applyRemote } = store.getState();
  if (complete) {
    applyRemote('cameras', [makeCamera()]);
    applyRemote('filmStocks', [makeFilmStock()]);
    applyRemote('rolls', [makeRoll()]);
  }
  applyRemote('frames', [FRAME]);
  return store;
}

interface FakeExporter {
  exporter: Exporter<Record<string, never>>;
  calls: { input: ExportInput; config: unknown; deps: ExporterDeps }[];
}

/** Registers an exporter under `id` that records its calls and answers with `result`. */
function fakeExporter(
  id: string,
  result: ExportResult | Error,
  requiresImage = false,
): FakeExporter {
  const calls: FakeExporter['calls'] = [];
  const exporter: Exporter<Record<string, never>> = {
    id,
    nameKey: `exporters.${id}`,
    configSchema: shareConfigSchema,
    requiresImage,
    exportFrame(input, config, deps) {
      calls.push({ input, config, deps });
      return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
    },
  };
  registerExporter(exporter);
  return { exporter, calls };
}

const OK: ExportResult = {
  externalId: '4711',
  url: 'https://blog.example.test/?p=4711',
  sharePayload: null,
};

function logsOf(store: ReturnType<typeof createAppStore>): ExportLog[] {
  return Object.values(store.getState().entities.exportLogs);
}

describe('runFrameExport', () => {
  // The fake exporters never call it; it only has to be the identity the run passes on.
  const fetchSpy: typeof fetch = jest.fn(
    (): Promise<Response> => Promise.reject(new Error('no request expected')),
  );

  it('writes an export log with target, external id, url and the export time', async () => {
    const store = seededStore();
    fakeExporter('test-log', OK);

    const result = await runFrameExport({
      exporterId: 'test-log',
      frame: FRAME,
      state: store.getState(),
      config: {},
      image: IMAGE,
      fetch: fetchSpy,
      upsert: store.getState().upsert,
      now: () => NOW,
    });

    expect(result).toEqual(OK);
    expect(logsOf(store)).toHaveLength(1);
    expect(logsOf(store)[0]).toMatchObject({
      frameId: FRAME.id,
      target: 'test-log',
      externalId: '4711',
      url: 'https://blog.example.test/?p=4711',
      exportedAt: NOW,
      deleted: null,
    });
    expect(logsOf(store)[0]?.id).toMatch(/^[a-z0-9]{15}$/);
  });

  it('hands the exporter the built input, the validated config and the fetch', async () => {
    const store = seededStore();
    const fake = fakeExporter('test-input', OK);

    await runFrameExport({
      exporterId: 'test-input',
      frame: FRAME,
      state: store.getState(),
      config: {},
      image: IMAGE,
      fetch: fetchSpy,
      upsert: store.getState().upsert,
      now: () => NOW,
    });

    const call = fake.calls[0];
    expect(call?.input.caption).toContain('Kodak Gold 200');
    expect(call?.input.image).toBe(IMAGE);
    expect(call?.config).toEqual({});
    expect(call?.deps.fetch).toBe(fetchSpy);
  });

  it('exports the caption the user edited', async () => {
    const store = seededStore();
    const fake = fakeExporter('test-caption', OK);

    await runFrameExport({
      exporterId: 'test-caption',
      frame: FRAME,
      state: store.getState(),
      config: {},
      image: null,
      fetch: fetchSpy,
      upsert: store.getState().upsert,
      now: () => NOW,
      caption: 'Edited by hand',
    });

    expect(fake.calls[0]?.input.caption).toBe('Edited by hand');
  });

  it('hands a share payload over before the log is written', async () => {
    const store = seededStore();
    const shared: string[] = [];
    fakeExporter('test-share', {
      externalId: null,
      url: null,
      sharePayload: { text: 'Caption', image: IMAGE },
    });

    await runFrameExport({
      exporterId: 'test-share',
      frame: FRAME,
      state: store.getState(),
      config: {},
      image: IMAGE,
      fetch: fetchSpy,
      upsert: store.getState().upsert,
      now: () => NOW,
      deliver: (payload) => {
        shared.push(payload.text);
        // The log is written only afterwards, so nothing is recorded yet.
        expect(logsOf(store)).toHaveLength(0);
        return Promise.resolve();
      },
    });

    expect(shared).toEqual(['Caption']);
    expect(logsOf(store)).toHaveLength(1);
    expect(logsOf(store)[0]).toMatchObject({ target: 'test-share', externalId: null, url: null });
  });

  it('writes no log when the hand-over to the OS fails', async () => {
    const store = seededStore();
    fakeExporter('test-share-fail', {
      externalId: null,
      url: null,
      sharePayload: { text: 'Caption', image: null },
    });

    await expect(
      runFrameExport({
        exporterId: 'test-share-fail',
        frame: FRAME,
        state: store.getState(),
        config: {},
        image: null,
        fetch: fetchSpy,
        upsert: store.getState().upsert,
        now: () => NOW,
        deliver: () => Promise.reject(new Error('the user cancelled the share sheet')),
      }),
    ).rejects.toThrow('the user cancelled the share sheet');

    expect(logsOf(store)).toHaveLength(0);
  });

  it('propagates the error of a failed export and writes no log', async () => {
    const store = seededStore();
    fakeExporter('test-fail', new Error('WordPress post creation failed (403)'));

    await expect(
      runFrameExport({
        exporterId: 'test-fail',
        frame: FRAME,
        state: store.getState(),
        config: {},
        image: IMAGE,
        fetch: fetchSpy,
        upsert: store.getState().upsert,
        now: () => NOW,
      }),
    ).rejects.toThrow('WordPress post creation failed (403)');

    expect(logsOf(store)).toHaveLength(0);
  });

  it('refuses an unknown exporter id', async () => {
    const store = seededStore();

    await expect(
      runFrameExport({
        exporterId: 'nope',
        frame: FRAME,
        state: store.getState(),
        config: {},
        image: IMAGE,
        fetch: fetchSpy,
        upsert: store.getState().upsert,
        now: () => NOW,
      }),
    ).rejects.toMatchObject({ problem: 'unknownExporter' });

    expect(logsOf(store)).toHaveLength(0);
  });

  it('refuses a frame whose roll, camera or film stock is unknown', async () => {
    const store = seededStore(false);
    fakeExporter('test-incomplete', OK);

    const error: unknown = await runFrameExport({
      exporterId: 'test-incomplete',
      frame: FRAME,
      state: store.getState(),
      config: {},
      image: IMAGE,
      fetch: fetchSpy,
      upsert: store.getState().upsert,
      now: () => NOW,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ExportPreconditionError);
    expect(error).toMatchObject({ problem: 'incompleteFrame' });
  });

  it('refuses a frame without an image for an exporter that needs one', async () => {
    const store = seededStore();
    fakeExporter('test-needs-image', OK, true);

    await expect(
      runFrameExport({
        exporterId: 'test-needs-image',
        frame: FRAME,
        state: store.getState(),
        config: {},
        image: null,
        fetch: fetchSpy,
        upsert: store.getState().upsert,
        now: () => NOW,
      }),
    ).rejects.toMatchObject({ problem: 'imageRequired' });
  });

  it('refuses a config the exporter does not accept', async () => {
    const store = seededStore();
    fakeExporter('test-config', OK);

    await expect(
      runFrameExport({
        exporterId: 'test-config',
        frame: FRAME,
        state: store.getState(),
        config: null,
        image: IMAGE,
        fetch: fetchSpy,
        upsert: store.getState().upsert,
        now: () => NOW,
      }),
    ).rejects.toMatchObject({ problem: 'invalidConfig' });

    expect(logsOf(store)).toHaveLength(0);
  });
});
