/**
 * Getting scan files into the app: the file picker and the ZIP expansion.
 *
 * A lab hands the developed roll over either as a folder of images or as a single ZIP, so
 * both go through the same interface and end up as a list of `PickedFile`s the review
 * screen can show and the uploader can post (spec §3.3).
 */

/**
 * One file ready to be reviewed and uploaded.
 *
 * `blob` is only set on web, where the bytes never touch a file system; on iOS and
 * Android the bytes live in the cache directory and `uri` points at them. `SyncClient`
 * (T-008) accepts both forms.
 */
export interface PickedFile {
  /** File name without any directory part, e.g. `img012.jpg`. */
  name: string;
  uri: string;
  mimeType: string;
  size: number;
  blob?: Blob;
}
