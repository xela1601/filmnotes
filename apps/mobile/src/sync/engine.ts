/**
 * The sync engine: one round trip between the local store and PocketBase.
 *
 * It is pure with respect to the store – everything it needs comes in through `SyncDeps`,
 * so the whole thing runs against a fake client and an isolated store in the tests.
 *
 * ## Order of work
 *
 * 1. **Fetch** the remote changes of every collection (`updated > lastSyncAt`, server time).
 * 2. **Push** the outbox: `update`, falling back to `create` on a 404. If the fetched set
 *    contains the same record, last-write-wins decides by the *client* timestamps
 *    (`local.updated` vs the remote `clientUpdated`): the local record wins on a tie, the
 *    remote one wins if it is strictly newer – then the server is left alone and step 4
 *    applies the remote version locally.
 * 3. **Seed upload**: on the very first sync against an empty server, push the equipment
 *    and film stocks that `seedPresets` inserted locally (they carry no outbox entries).
 * 4. **Pull**: apply every fetched record that is newer than its local counterpart, or
 *    that has no local counterpart at all.
 * 5. **Watermark**: remember the start of the run minus a safety margin.
 *
 * Step 1 runs before the push on purpose: `SyncClient` has no "read one record", so the
 * change feed is the only way to see a conflicting server version before overwriting it.
 * Fetching once and using the result for both the conflict check and the pull also keeps
 * the number of requests at one `getFullList` per collection.
 *
 * The watermark is the *client's* clock while `list` filters on the *server's* `updated`.
 * The 5 s margin absorbs a small clock offset; a larger one only causes records to be
 * fetched again, which is harmless because the pull compares client timestamps.
 */
import {
  PB_COLLECTION,
  type CollectionName,
  type EntityOf,
  type Id,
  type ISODateTime,
} from '@filmnotes/domain';

import type { RemoteRecord, SyncClient } from './client';
import { fromRemote, toRemote } from './mapping';
import { COLLECTIONS, type AppState, type OutboxEntry } from '../store/store';

export interface SyncResult {
  /** Records written to the server. */
  pushed: number;
  /** Records taken over from the server. */
  pulled: number;
  /** Records the server also changed, where the local version was the newer one. */
  conflictsLocalWon: number;
  /** One entry per failed record or collection; a sync is never aborted by a single error. */
  errors: string[];
}

export interface SyncDeps {
  client: SyncClient;
  /** The PocketBase user id every pushed record is owned by. */
  ownerId: Id;
  getState: () => AppState;
  applyRemote: <K extends CollectionName>(collection: K, records: EntityOf<K>[]) => void;
  removeFromOutbox: (entries: OutboxEntry[]) => void;
  setLastSyncAt: (at: ISODateTime | null) => void;
  now: () => ISODateTime;
}

/** Subtracted from the start of the run to absorb a client/server clock offset. */
const WATERMARK_MARGIN_MS = 5_000;

/**
 * Collections that `seedPresets` fills locally without queueing an outbox entry, and that
 * therefore need the explicit first-sync upload.
 */
const SEED_COLLECTIONS: readonly CollectionName[] = [
  'cameras',
  'lenses',
  'filters',
  'flashes',
  'filmStocks',
];

/** The fetched remote changes, per collection and keyed by record id. */
type RemoteChanges = Map<CollectionName, Map<Id, RemoteRecord>>;

function statusOf(error: unknown): number | null {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status: unknown = (error as { status: unknown }).status;
    if (typeof status === 'number') return status;
  }
  return null;
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Writes one record: `update` first, `create` when the server does not know the id yet. */
async function pushRecord<K extends CollectionName>(
  deps: SyncDeps,
  collection: K,
  record: EntityOf<K>,
): Promise<void> {
  const remoteName = PB_COLLECTION[collection];
  const payload = toRemote(collection, record, deps.ownerId);
  try {
    await deps.client.update(remoteName, record.id, payload);
  } catch (error) {
    if (statusOf(error) !== 404) throw error;
    await deps.client.create(remoteName, payload);
  }
}

async function fetchChanges(
  deps: SyncDeps,
  since: ISODateTime | null,
  result: SyncResult,
): Promise<{ changes: RemoteChanges; complete: boolean }> {
  const changes: RemoteChanges = new Map();
  let complete = true;

  for (const collection of COLLECTIONS) {
    try {
      const records = await deps.client.list(PB_COLLECTION[collection], since);
      changes.set(collection, new Map(records.map((record) => [record.id, record])));
    } catch (error) {
      complete = false;
      result.errors.push(`${PB_COLLECTION[collection]}: ${messageOf(error)}`);
      changes.set(collection, new Map());
    }
  }

  return { changes, complete };
}

async function pushOutbox(
  deps: SyncDeps,
  changes: RemoteChanges,
  result: SyncResult,
): Promise<Set<string>> {
  /** `collection/id` of everything this run already wrote, so the seed upload can skip it. */
  const written = new Set<string>();
  const handled: OutboxEntry[] = [];

  for (const entry of deps.getState().outbox) {
    const local = deps.getState().entities[entry.collection][entry.id];
    if (local === undefined) {
      // The record is gone (e.g. after a reset); nothing left to push.
      handled.push(entry);
      continue;
    }

    const candidate = changes.get(entry.collection)?.get(entry.id);
    if (candidate !== undefined) {
      const remoteUpdated = fromRemote(entry.collection, candidate).updated;
      if (remoteUpdated > local.updated) {
        // The server version is newer: keep it, drop the local change and let the pull
        // step below write it into the store.
        handled.push(entry);
        continue;
      }
      result.conflictsLocalWon += 1;
    }

    try {
      await pushRecord(deps, entry.collection, local);
      result.pushed += 1;
      handled.push(entry);
      written.add(`${entry.collection}/${entry.id}`);
      // Our own write comes back in the change feed of the *next* sync; the version we
      // just sent must not be pulled back into the store in step 4.
      changes.get(entry.collection)?.delete(entry.id);
    } catch (error) {
      // The entry stays in the outbox and is retried on the next run.
      result.errors.push(`${PB_COLLECTION[entry.collection]}/${entry.id}: ${messageOf(error)}`);
    }
  }

  deps.removeFromOutbox(handled);
  return written;
}

/** Pushes the locally seeded equipment and film stocks to a server that has none. */
async function uploadSeedData(
  deps: SyncDeps,
  changes: RemoteChanges,
  written: Set<string>,
  result: SyncResult,
): Promise<void> {
  for (const collection of SEED_COLLECTIONS) {
    for (const record of Object.values(deps.getState().entities[collection])) {
      if (written.has(`${collection}/${record.id}`)) continue;
      try {
        await pushRecord(deps, collection, record);
        result.pushed += 1;
        changes.get(collection)?.delete(record.id);
      } catch (error) {
        result.errors.push(`${PB_COLLECTION[collection]}/${record.id}: ${messageOf(error)}`);
      }
    }
  }
}

/** Applies the fetched records of one collection that are newer than the local ones. */
function pullCollection<K extends CollectionName>(
  deps: SyncDeps,
  collection: K,
  candidates: Iterable<RemoteRecord>,
): number {
  const local = deps.getState().entities[collection];
  const applicable: EntityOf<K>[] = [];

  for (const candidate of candidates) {
    const entity = fromRemote(collection, candidate);
    const current = local[entity.id];
    if (current === undefined || entity.updated > current.updated) applicable.push(entity);
  }

  if (applicable.length === 0) return 0;
  deps.applyRemote(collection, applicable);
  return applicable.length;
}

/** One full sync round trip. Never throws: every failure lands in `result.errors`. */
export async function runSync(deps: SyncDeps): Promise<SyncResult> {
  const result: SyncResult = { pushed: 0, pulled: 0, conflictsLocalWon: 0, errors: [] };
  const startedAt = deps.now();
  const since = deps.getState().lastSyncAt;

  const { changes, complete } = await fetchChanges(deps, since, result);

  const written = await pushOutbox(deps, changes, result);

  const serverIsEmpty = (changes.get('cameras')?.size ?? 0) === 0;
  if (complete && since === null && serverIsEmpty) {
    await uploadSeedData(deps, changes, written, result);
  }

  for (const collection of COLLECTIONS) {
    result.pulled += pullCollection(deps, collection, changes.get(collection)?.values() ?? []);
  }

  // Only advance the watermark when every collection was actually read; otherwise the
  // missed changes would never be fetched again. Failed pushes are safe to ignore here –
  // their outbox entries survive.
  if (complete) {
    const watermark = new Date(Date.parse(startedAt) - WATERMARK_MARGIN_MS).toISOString();
    deps.setLastSyncAt(watermark);
  }

  return result;
}
