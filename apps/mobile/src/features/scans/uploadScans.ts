/**
 * Uploading a reviewed scan import to PocketBase.
 *
 * Scan files live on the server only – the app keeps the record and reads the image back
 * through a file URL (spec §3.3). Each scan therefore takes two requests: the record is
 * created first so that the file field has a record to go into, then the file is posted
 * into it.
 *
 * One failure does not abort the import: the photographer has just spent minutes on the
 * review and a single broken file (or a dropped connection halfway through) must not cost
 * the rest of the roll. The names that did not make it come back in `failed`, and running
 * the import again for those is a plain repeat.
 */
import { newId, PB_COLLECTION, naturalCompare } from '@filmnotes/domain';
import type { Id, ISODateTime, Scan, ScanAssignment } from '@filmnotes/domain';

import type { PickedFile } from './pickScans';
import type { SyncClient, UploadFile } from '../../sync/client';
import { toRemote } from '../../sync/mapping';

export interface UploadScansDeps {
  client: SyncClient;
  /** PocketBase user id the records belong to. */
  ownerId: Id;
  rollId: Id;
  files: PickedFile[];
  /** The reviewed mapping, by `sortIndex` of the natural file order. */
  assignments: ScanAssignment[];
  /** The store's `upsert`, narrowed to what this module writes. */
  upsert: (collection: 'scans', record: Scan) => void;
  now: () => ISODateTime;
}

export interface UploadScansResult {
  uploaded: number;
  /** File names whose record or upload failed, in the order they were tried. */
  failed: string[];
}

/** The file field of the `scans` collection. */
const FILE_FIELD = 'file';

/** Either form `SyncClient.uploadFile` accepts: the web Blob or the local file. */
function asUpload(file: PickedFile): UploadFile {
  const common = { name: file.name, type: file.mimeType };
  return file.blob === undefined ? { ...common, uri: file.uri } : { ...common, blob: file.blob };
}

/**
 * The same order `matchScansToFrames` used to build the assignments, so the n-th file
 * belongs to the assignment with `sortIndex` n whatever order the picker returned.
 */
function inAssignmentOrder(files: PickedFile[]): PickedFile[] {
  return [...files].sort((a, b) => naturalCompare(a.name, b.name));
}

export async function uploadScans(deps: UploadScansDeps): Promise<UploadScansResult> {
  const collection = PB_COLLECTION.scans;
  const bySortIndex = new Map(deps.assignments.map((a) => [a.sortIndex, a]));
  const failed: string[] = [];
  let uploaded = 0;

  for (const [sortIndex, file] of inAssignmentOrder(deps.files).entries()) {
    const at = deps.now();
    const scan: Scan = {
      id: newId(),
      created: at,
      updated: at,
      deleted: null,
      owner: deps.ownerId,
      rollId: deps.rollId,
      frameId: bySortIndex.get(sortIndex)?.frameId ?? null,
      fileName: file.name,
      sortIndex,
      // Set from the server's answer once the file is in; a record without a file is
      // never written to the local store.
      file: null,
      // The lab's pixel dimensions are not read here; PocketBase derives the thumbnails.
      width: null,
      height: null,
      importedAt: at,
    };

    try {
      await deps.client.create(collection, toRemote('scans', scan, deps.ownerId));
      const remote = await deps.client.uploadFile(
        collection,
        scan.id,
        FILE_FIELD,
        asUpload(file),
      );
      // PocketBase renames an uploaded file (it appends a random suffix), and that name
      // is what the file URL needs.
      const stored = remote[FILE_FIELD];
      deps.upsert('scans', {
        ...scan,
        file: typeof stored === 'string' && stored !== '' ? stored : file.name,
      });
      uploaded += 1;
    } catch {
      failed.push(file.name);
      // The record may already be on the server while its file never arrived. Left alone
      // it would be pulled back by the next sync as a scan without an image, so it is
      // marked deleted here – best effort, because the same connection just failed.
      try {
        await deps.client.update(collection, scan.id, {
          id: scan.id,
          deleted: at,
          updated: at,
          clientUpdated: at,
        });
      } catch {
        // Nothing left to do: either the record was never created, or the server is gone.
      }
    }
  }

  return { uploaded, failed };
}
