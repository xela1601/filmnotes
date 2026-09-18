/**
 * Getting scan files into the app: the file picker and the ZIP expansion.
 *
 * A lab hands the developed roll over either as a folder of images or as a single ZIP, so
 * both go through the same interface and end up as a list of `PickedFile`s the review
 * screen shows and the uploader posts (spec §3.3).
 */
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { unzipSync } from 'fflate';
import { Platform } from 'react-native';
import { naturalCompare } from '@filmnotes/domain';

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

/**
 * The image formats a lab delivers, with the MIME type the server should store.
 *
 * Doubles as the allow-list for ZIP entries: anything without one of these extensions is
 * not a scan (`readme.txt`, a contact sheet PDF, the `__MACOSX` bookkeeping).
 */
const IMAGE_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

/** Sub-directory of the cache the unzipped entries are written to. */
const CACHE_FOLDER = 'filmnotes-scans';

const FALLBACK_MIME_TYPE = 'application/octet-stream';

/** The last path segment of a ZIP entry or picker asset name. */
function baseName(path: string): string {
  const segments = path.split('/');
  return segments[segments.length - 1] ?? path;
}

/** The MIME type for a file name, or `null` when it is not an image we accept. */
function imageTypeOf(name: string): string | null {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return null;
  return IMAGE_TYPES[name.slice(dot + 1).toLowerCase()] ?? null;
}

/**
 * macOS puts a `__MACOSX` shadow tree with `._`-prefixed resource forks into every ZIP it
 * creates. Those entries carry the same names as the images and would double the import.
 */
function isMacOsMetadata(path: string): boolean {
  return path.split('/').some((segment) => segment === '__MACOSX' || segment.startsWith('._'));
}

/** True for a file the user picked as a ZIP archive rather than a single image. */
export function isZip(file: PickedFile): boolean {
  return (
    file.name.toLowerCase().endsWith('.zip') || file.mimeType.toLowerCase().includes('zip')
  );
}

function toPickedFile(asset: DocumentPicker.DocumentPickerAsset): PickedFile {
  const name = baseName(asset.name);
  const file: PickedFile = {
    name,
    uri: asset.uri,
    mimeType: asset.mimeType ?? imageTypeOf(name) ?? FALLBACK_MIME_TYPE,
    size: asset.size ?? 0,
  };
  // On web the picker hands over the DOM File, which is the Blob the uploader posts.
  return asset.file === undefined ? file : { ...file, blob: asset.file };
}

/**
 * Opens the system file picker for several images or one ZIP.
 *
 * Returns an empty list when the user cancels – the review screen then simply keeps what
 * it had.
 */
export async function pickScanFiles(): Promise<PickedFile[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['image/*', 'application/zip'],
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return [];
  return result.assets.map(toPickedFile);
}

/** The bytes behind a picked file, from the web Blob or from the local file. */
async function readBytes(file: PickedFile): Promise<Uint8Array> {
  if (file.blob !== undefined) return new Uint8Array(await file.blob.arrayBuffer());
  return new File(file.uri).bytes();
}

function objectUrl(blob: Blob): string {
  // Not every runtime that reports itself as web has it (jsdom without the URL shim).
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    return URL.createObjectURL(blob);
  }
  return '';
}

/**
 * Turns the bytes of one ZIP entry into something uploadable: a Blob on web, a file in
 * the cache directory on iOS and Android.
 *
 * `index` only disambiguates the file on disk – two directories inside one archive may
 * well hold an `1.jpg` each, and their `name` stays what the lab called them.
 */
function materialize(
  name: string,
  mimeType: string,
  bytes: Uint8Array,
  index: number,
): PickedFile {
  if (Platform.OS === 'web') {
    const blob = new Blob([bytes as BlobPart], { type: mimeType });
    return { name, uri: objectUrl(blob), mimeType, size: bytes.length, blob };
  }

  const directory = new Directory(Paths.cache, CACHE_FOLDER);
  if (!directory.exists) directory.create({ intermediates: true });
  const target = new File(directory, `${index}-${name}`);
  if (target.exists) target.delete();
  target.create();
  target.write(bytes);
  return { name, uri: target.uri, mimeType, size: bytes.length };
}

/**
 * Expands a picked ZIP into its image entries, in natural name order.
 *
 * Everything that is not an image we accept is skipped, as is the `__MACOSX` shadow tree.
 * `unzipSync` keeps the whole archive in memory; a roll of 36 scans is a few dozen
 * megabytes, which is the size the lab hands out and well within what the device holds.
 */
export async function expandZip(file: PickedFile): Promise<PickedFile[]> {
  const entries = unzipSync(await readBytes(file));

  const images: { name: string; mimeType: string; bytes: Uint8Array }[] = [];
  for (const [path, bytes] of Object.entries(entries)) {
    if (isMacOsMetadata(path)) continue;
    const name = baseName(path);
    const mimeType = imageTypeOf(name);
    // A directory entry ends in `/`, so its base name has no extension either.
    if (mimeType === null) continue;
    images.push({ name, mimeType, bytes });
  }
  images.sort((a, b) => naturalCompare(a.name, b.name));

  return images.map((entry, index) =>
    materialize(entry.name, entry.mimeType, entry.bytes, index),
  );
}
