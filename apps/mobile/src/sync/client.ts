import type { Id } from '@filmnotes/domain';

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
  uploadFile(
    collection: string,
    id: Id,
    field: string,
    file: UploadFile,
  ): Promise<RemoteRecord>;
  fileUrl(collection: string, id: Id, fileName: string, thumb?: string): string;
}
