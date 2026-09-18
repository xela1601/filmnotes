import type { Id } from "@filmnotes/domain";
import PocketBase from "pocketbase";

/**
 * A record exactly as PocketBase stores it: our camelCase entity fields plus the
 * server-side extras (`owner`, `clientUpdated`, `created`, `updated`, `collectionId`, …).
 *
 * Values are deliberately `unknown`: PocketBase returns `''` for unset text and date
 * fields, `null` for unset json and dates in `YYYY-MM-DD HH:mm:ss.SSSZ` form. Turning
 * that into a domain entity is the job of `mapping.ts`.
 */
export interface RemoteRecord {
  id: Id;
  [field: string]: unknown;
}

/** A file to upload, either by local URI (native) or as a `Blob` (web). */
export interface UploadFile {
  uri?: string;
  blob?: Blob;
  name: string;
  type: string;
}

/**
 * Everything the sync engine needs from the server, narrow enough to be faked in tests.
 *
 * Implemented by `createPocketBaseClient` on top of the `pocketbase` JS SDK.
 */
export interface SyncClient {
  /** Logs in and returns the auth token plus the user id that becomes `owner`. */
  authWithPassword(email: string, password: string): Promise<{ token: string; userId: Id }>;
  /** Validates a stored token via `authRefresh`; `null` when it is no longer valid. */
  authWithToken(token: string): Promise<{ userId: Id } | null>;
  /** All records of a collection, optionally only those changed after `sinceIso` (server time). */
  list(collection: string, sinceIso: string | null): Promise<RemoteRecord[]>;
  create(collection: string, record: RemoteRecord): Promise<RemoteRecord>;
  update(collection: string, id: Id, record: RemoteRecord): Promise<RemoteRecord>;
  /** Multipart upload into a file field; used by the scan import (T-009). */
  uploadFile(collection: string, id: Id, field: string, file: UploadFile): Promise<RemoteRecord>;
  fileUrl(collection: string, id: Id, fileName: string, thumb?: string): string;
}

/** The auth collection the single app user lives in (see `backend/README.md`). */
const USERS_COLLECTION = "users";

/**
 * Rewrites an ISO timestamp into PocketBase's own date format (`YYYY-MM-DD HH:mm:ss.SSSZ`).
 *
 * PocketBase compares a date filter lexically against the stored string, so an ISO
 * watermark keeps its `T` separator and sorts *after* every timestamp of the same day
 * (`'T'` = 0x54 > `' '` = 0x20). The change feed would then come back empty until the
 * next calendar day – silently, because an empty page is a perfectly valid answer.
 * Verified against PocketBase 0.40 with the schema from T-004.
 */
function asPocketBaseDate(iso: string): string {
  return iso.replace("T", " ");
}

/**
 * `SyncClient` on top of the `pocketbase` JS SDK.
 *
 * Auto-cancellation is switched off: the engine lists every collection one after the
 * other, and the SDK would otherwise cancel same-endpoint requests of a previous run.
 *
 * The SDK is ESM-only and not on the Jest transform allow-list, so a test that reaches
 * this module has to replace it – either `jest.mock('pocketbase', …)` or, more usually,
 * `jest.mock('./client', …)`.
 */
export function createPocketBaseClient(baseUrl: string): SyncClient {
  const pb = new PocketBase(baseUrl);
  pb.autoCancellation(false);

  return {
    async authWithPassword(email, password) {
      const auth = await pb.collection(USERS_COLLECTION).authWithPassword(email, password);
      return { token: auth.token, userId: auth.record.id };
    },

    async authWithToken(token) {
      // A non-null list rule turns an unauthenticated list into an empty result instead
      // of a 401, so the token has to be validated against an endpoint that really
      // requires auth: authRefresh.
      pb.authStore.save(token, null);
      try {
        const auth = await pb.collection(USERS_COLLECTION).authRefresh();
        pb.authStore.save(auth.token, auth.record);
        return { userId: auth.record.id };
      } catch {
        pb.authStore.clear();
        return null;
      }
    },

    async list(collection, sinceIso) {
      const filter =
        sinceIso === null
          ? ""
          : pb.filter("updated > {:since}", { since: asPocketBaseDate(sinceIso) });
      return pb.collection(collection).getFullList<RemoteRecord>({ filter, sort: "updated" });
    },

    async create(collection, record) {
      return pb.collection(collection).create<RemoteRecord>(record);
    },

    async update(collection, id, record) {
      return pb.collection(collection).update<RemoteRecord>(id, record);
    },

    async uploadFile(collection, id, field, file) {
      const form = new FormData();
      if (file.blob !== undefined) {
        form.append(field, file.blob, file.name);
      } else if (file.uri !== undefined) {
        // React Native's FormData takes `{ uri, name, type }` where the DOM signature
        // demands a Blob; this is how a local file is uploaded from Expo.
        const native = { uri: file.uri, name: file.name, type: file.type };
        form.append(field, native as unknown as Blob);
      } else {
        throw new Error("uploadFile needs either a blob or a uri");
      }
      return pb.collection(collection).update<RemoteRecord>(id, form);
    },

    fileUrl(collection, id, fileName, thumb) {
      return pb.files.getURL(
        { id, collectionId: collection, collectionName: collection },
        fileName,
        thumb === undefined ? {} : { thumb },
      );
    },
  };
}
