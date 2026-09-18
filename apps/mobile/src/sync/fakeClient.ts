/**
 * In-memory `SyncClient` for tests – no network, no `pocketbase` SDK.
 *
 * It imitates the parts of PocketBase the sync engine depends on:
 *  - one `Map` per collection, keyed by record id,
 *  - `created`/`updated` stamped with the fake server clock on every write (the client's
 *    own timestamp stays in `clientUpdated`, exactly as the real schema does),
 *  - `list(collection, since)` filters on the *server* `updated` – by parsing both sides,
 *    so unlike the real server it accepts an ISO watermark as well as PocketBase's own
 *    date format (the conversion lives in `client.ts`, which is where it is tested),
 *  - `update` on an unknown id throws a 404, which is what makes the engine fall back to
 *    `create`.
 *
 * This file is test infrastructure; it is deliberately not exported from the feature.
 */
import type { Id } from "@filmnotes/domain";

import type { RemoteRecord, SyncClient, UploadFile } from "./client";

/** A thrown error that carries a PocketBase HTTP status. */
class FakeResponseError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "FakeResponseError";
  }
}

export interface FakeSyncClientOptions {
  /** First timestamp the fake server clock hands out; it advances by 1 ms per write. */
  serverNow?: string;
  /** Users that `authWithPassword` accepts, as `email -> { password, userId }`. */
  users?: Record<string, { password: string; userId: Id }>;
}

export class FakeSyncClient implements SyncClient {
  private readonly collections = new Map<string, Map<Id, RemoteRecord>>();
  private readonly users: Record<string, { password: string; userId: Id }>;
  private serverClock: number;

  /** `collection/id` of every create and update that was attempted, in order. */
  readonly createCalls: string[] = [];
  readonly updateCalls: string[] = [];
  readonly listCalls: { collection: string; since: string | null }[] = [];

  /** `collection/id` entries whose `update` throws instead of writing. */
  readonly failingUpdates = new Set<string>();
  /** Collections whose `list` throws. */
  readonly failingLists = new Set<string>();
  /** Tokens `authWithToken` accepts, as `token -> userId`. */
  readonly tokens = new Map<string, Id>();

  constructor(options: FakeSyncClientOptions = {}) {
    this.serverClock = Date.parse(options.serverNow ?? "2026-09-18T12:00:00.000Z");
    this.users = options.users ?? {};
  }

  /** The fake server's clock, advancing by one millisecond per call. */
  fakeServerNow(): string {
    this.serverClock += 1;
    return new Date(this.serverClock).toISOString();
  }

  private bucket(collection: string): Map<Id, RemoteRecord> {
    const existing = this.collections.get(collection);
    if (existing !== undefined) return existing;
    const created = new Map<Id, RemoteRecord>();
    this.collections.set(collection, created);
    return created;
  }

  /** Puts a record on the fake server without going through the client API. */
  seed(collection: string, record: RemoteRecord): RemoteRecord {
    const at = this.fakeServerNow();
    const stored: RemoteRecord = { ...record, created: at, updated: at };
    this.bucket(collection).set(record.id, stored);
    return stored;
  }

  records(collection: string): RemoteRecord[] {
    return [...this.bucket(collection).values()];
  }

  record(collection: string, id: Id): RemoteRecord | undefined {
    return this.bucket(collection).get(id);
  }

  count(collection: string): number {
    return this.bucket(collection).size;
  }

  async authWithPassword(email: string, password: string): Promise<{ token: string; userId: Id }> {
    const user = this.users[email];
    if (user === undefined || user.password !== password) {
      throw new FakeResponseError(400, "Failed to authenticate.");
    }
    const token = `token-${user.userId}`;
    this.tokens.set(token, user.userId);
    return { token, userId: user.userId };
  }

  async authWithToken(token: string): Promise<{ userId: Id } | null> {
    const userId = this.tokens.get(token);
    return userId === undefined ? null : { userId };
  }

  async list(collection: string, sinceIso: string | null): Promise<RemoteRecord[]> {
    this.listCalls.push({ collection, since: sinceIso });
    if (this.failingLists.has(collection)) {
      throw new FakeResponseError(500, `list ${collection} failed`);
    }
    const since = sinceIso === null ? null : Date.parse(sinceIso);
    return this.records(collection)
      .filter((record) => since === null || Date.parse(String(record.updated)) > since)
      .sort((a, b) => String(a.updated).localeCompare(String(b.updated)));
  }

  async create(collection: string, record: RemoteRecord): Promise<RemoteRecord> {
    this.createCalls.push(`${collection}/${record.id}`);
    if (this.bucket(collection).has(record.id)) {
      throw new FakeResponseError(400, `${record.id} already exists`);
    }
    return this.seed(collection, record);
  }

  async update(collection: string, id: Id, record: RemoteRecord): Promise<RemoteRecord> {
    this.updateCalls.push(`${collection}/${id}`);
    if (this.failingUpdates.has(`${collection}/${id}`)) {
      throw new FakeResponseError(400, `update ${collection}/${id} failed`);
    }
    const existing = this.bucket(collection).get(id);
    if (existing === undefined) {
      throw new FakeResponseError(404, `The requested resource wasn't found.`);
    }
    const stored: RemoteRecord = {
      ...existing,
      ...record,
      id,
      created: existing.created,
      updated: this.fakeServerNow(),
    };
    this.bucket(collection).set(id, stored);
    return stored;
  }

  async uploadFile(
    collection: string,
    id: Id,
    field: string,
    file: UploadFile,
  ): Promise<RemoteRecord> {
    const existing = this.bucket(collection).get(id);
    if (existing === undefined) {
      throw new FakeResponseError(404, `The requested resource wasn't found.`);
    }
    const stored: RemoteRecord = {
      ...existing,
      [field]: file.name,
      updated: this.fakeServerNow(),
    };
    this.bucket(collection).set(id, stored);
    return stored;
  }

  fileUrl(collection: string, id: Id, fileName: string, thumb?: string): string {
    const query = thumb === undefined ? "" : `?thumb=${thumb}`;
    return `https://fake.test/api/files/${collection}/${id}/${fileName}${query}`;
  }
}
