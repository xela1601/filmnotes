/**
 * Construction smoke test for the PocketBase adapter.
 *
 * The `pocketbase` SDK is ESM-only and node_modules is not transformed by jest-expo, so
 * the module is replaced by a factory here – which is also what keeps this test free of
 * any network access. The real SDK is exercised by the backend smoke test (T-004) and by
 * the manual end-to-end check.
 */
const mockPb = {
  authWithPassword: jest.fn(),
  authRefresh: jest.fn(),
  getFullList: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  autoCancellation: jest.fn(),
  save: jest.fn(),
  clear: jest.fn(),
  filter: jest.fn(
    (raw: string, params: Record<string, unknown>): string =>
      raw.replace('{:since}', `"${String(params.since)}"`),
  ),
  getURL: jest.fn(
    (record: { id: string; collectionName: string }, fileName: string): string =>
      `https://pb.test/api/files/${record.collectionName}/${record.id}/${fileName}`,
  ),
};

jest.mock('pocketbase', () => ({
  __esModule: true,
  // The field initialisers run when the adapter constructs the client, which is well
  // after this module has finished loading – so touching `mockPb` here is safe.
  default: class {
    readonly authStore = { save: mockPb.save, clear: mockPb.clear };
    readonly files = { getURL: mockPb.getURL };
    readonly filter = mockPb.filter;
    readonly autoCancellation = mockPb.autoCancellation;
    readonly collection = () => mockPb;
  },
}));

import { createPocketBaseClient } from './client';

describe('createPocketBaseClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds a client with the whole SyncClient surface and no auto-cancellation', () => {
    const client = createPocketBaseClient('https://pb.test');

    expect(mockPb.autoCancellation).toHaveBeenCalledWith(false);
    for (const method of [
      'authWithPassword',
      'authWithToken',
      'list',
      'create',
      'update',
      'uploadFile',
      'fileUrl',
    ] as const) {
      expect(typeof client[method]).toBe('function');
    }
  });

  it('lists everything when there is no watermark', async () => {
    mockPb.getFullList.mockResolvedValue([]);

    await createPocketBaseClient('https://pb.test').list('rolls', null);

    expect(mockPb.getFullList).toHaveBeenLastCalledWith({ filter: '', sort: 'updated' });
  });

  it('passes the watermark in PocketBase date format, not ISO', async () => {
    // PocketBase compares date filters lexically against its stored
    // `YYYY-MM-DD HH:mm:ss.SSSZ` form. An ISO watermark keeps the `T`, which sorts after
    // every timestamp of the same day ("T" > " "), so the server would silently answer
    // with an empty change feed until the next calendar day.
    mockPb.getFullList.mockResolvedValue([]);

    await createPocketBaseClient('https://pb.test').list('rolls', '2026-09-18T10:00:00.000Z');

    expect(mockPb.filter).toHaveBeenLastCalledWith('updated > {:since}', {
      since: '2026-09-18 10:00:00.000Z',
    });
    expect(mockPb.getFullList).toHaveBeenLastCalledWith({
      filter: 'updated > "2026-09-18 10:00:00.000Z"',
      sort: 'updated',
    });
  });

  it('returns token and user id after a password login', async () => {
    mockPb.authWithPassword.mockResolvedValue({ token: 'tok', record: { id: 'user00000000001' } });

    const auth = await createPocketBaseClient('https://pb.test').authWithPassword(
      'me@example.test',
      'secret',
    );

    expect(auth).toEqual({ token: 'tok', userId: 'user00000000001' });
  });

  it('validates a stored token via authRefresh and reports an invalid one as null', async () => {
    mockPb.authRefresh.mockResolvedValueOnce({
      token: 'fresh',
      record: { id: 'user00000000001' },
    });
    const client = createPocketBaseClient('https://pb.test');

    expect(await client.authWithToken('tok')).toEqual({ userId: 'user00000000001' });
    expect(mockPb.save).toHaveBeenCalledWith('fresh', { id: 'user00000000001' });

    mockPb.authRefresh.mockRejectedValueOnce(new Error('401'));
    expect(await client.authWithToken('stale')).toBeNull();
    expect(mockPb.clear).toHaveBeenCalled();
  });

  it('builds a file url with an optional thumb', () => {
    const client = createPocketBaseClient('https://pb.test');

    expect(client.fileUrl('scans', 'scan00000000001', 'img.jpg')).toBe(
      'https://pb.test/api/files/scans/scan00000000001/img.jpg',
    );
    expect(mockPb.getURL).toHaveBeenLastCalledWith(
      { id: 'scan00000000001', collectionId: 'scans', collectionName: 'scans' },
      'img.jpg',
      {},
    );

    client.fileUrl('scans', 'scan00000000001', 'img.jpg', '200x200');
    expect(mockPb.getURL).toHaveBeenLastCalledWith(expect.anything(), 'img.jpg', {
      thumb: '200x200',
    });
  });
});
