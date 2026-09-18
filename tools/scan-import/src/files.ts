/**
 * Collecting the scan files the lab delivered.
 *
 * Two sources are supported, because that is what labs hand out: a folder (often a whole
 * drugstore CD copied to disk, with subfolders) and a single `.zip`. A zip is extracted into a
 * temp dir so the rest of the CLI only ever deals with plain paths; `cleanupTempDirs()` removes
 * those dirs again.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';

import { naturalCompare } from '@filmnotes/domain';
import { unzipSync } from 'fflate';

/** One scan file, ready to be uploaded. */
export interface ImageFile {
  /** Display name and the `fileName` of the scan record; unique within one import. */
  name: string;
  /** Absolute path on disk (inside the extraction dir for a zip source). */
  path: string;
  mimeType: string;
}

/**
 * The extensions the import accepts, mapped to the mime type PocketBase's `scans.file` field
 * allows (see `backend/pb_migrations/1758150000_init_collections.js`).
 */
const MIME_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.webp': 'image/webp',
};

/** The mime type for a file name, or `null` when the file is not a scan we handle. */
function mimeTypeOf(name: string): string | null {
  return MIME_BY_EXTENSION[extname(name).toLowerCase()] ?? null;
}

/** Temp dirs this process created for zip sources, removed by `cleanupTempDirs`. */
const tempDirs: string[] = [];

/** Removes every directory a zip source was extracted into. Safe to call more than once. */
export function cleanupTempDirs(): void {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop() as string;
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Hidden files and the resource forks a macOS zip carries (`__MACOSX/._img1.jpg`) look like
 * images by their extension but are not, so every path segment starting with a dot and the
 * `__MACOSX` folder are skipped.
 */
function isHidden(relativePath: string): boolean {
  return relativePath
    .split('/')
    .some((segment) => segment.startsWith('.') || segment === '__MACOSX');
}

/** Every file below `dir`, recursively, as `{ name, path }` with the plain base name. */
async function walk(dir: string, prefix = ''): Promise<{ name: string; path: string }[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const found: { name: string; path: string }[] = [];
  for (const entry of entries) {
    const relativePath = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (isHidden(relativePath)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await walk(path, relativePath)));
    } else if (entry.isFile()) {
      found.push({ name: entry.name, path });
    }
  }
  return found;
}

/**
 * Sorts the candidates the way a file browser does (labs number their files) and turns them into
 * `ImageFile`s. Base names repeat when the source has subfolders, so a repeated name gets a
 * `-2`, `-3`, … suffix: the plan table and the `fileName` of the scan records stay unambiguous.
 */
function toImageFiles(candidates: { name: string; path: string }[]): ImageFile[] {
  const sorted = [...candidates].sort(
    (a, b) => naturalCompare(a.name, b.name) || naturalCompare(a.path, b.path),
  );
  const used = new Set<string>();
  return sorted.flatMap((candidate) => {
    const mimeType = mimeTypeOf(candidate.name);
    if (mimeType === null) return [];
    let name = candidate.name;
    for (let attempt = 2; used.has(name); attempt += 1) {
      const extension = extname(candidate.name);
      name = `${basename(candidate.name, extension)}-${attempt}${extension}`;
    }
    used.add(name);
    return [{ name, path: candidate.path, mimeType }];
  });
}

/** Extracts the images of a zip into a fresh temp dir and returns them. */
async function fromZip(zipPath: string): Promise<ImageFile[]> {
  const archive = unzipSync(new Uint8Array(await readFile(zipPath)));
  const dir = mkdtempSync(join(tmpdir(), 'filmnotes-scan-import-'));
  tempDirs.push(dir);

  const entries = Object.entries(archive).filter(
    ([entryPath]) =>
      !entryPath.endsWith('/') && !isHidden(entryPath) && mimeTypeOf(entryPath) !== null,
  );
  // Name the extracted files after the (unique) import names, so `path` and `name` agree.
  const files = toImageFiles(
    entries.map(([entryPath]) => ({ name: basename(entryPath), path: entryPath })),
  );
  const bytesByEntry = new Map(entries);

  await mkdir(dir, { recursive: true });
  return Promise.all(
    files.map(async (file) => {
      const bytes = bytesByEntry.get(file.path) as Uint8Array;
      const target = join(dir, file.name);
      await writeFile(target, bytes);
      return { ...file, path: target };
    }),
  );
}

/**
 * Lists the scan files of `source`, a folder (searched recursively) or a `.zip`.
 *
 * @throws Error when the source does not exist or is a file that is not a zip.
 */
export async function listImageFiles(source: string): Promise<ImageFile[]> {
  let entry;
  try {
    entry = await stat(source);
  } catch {
    throw new Error(`source not found: ${source}`);
  }

  if (entry.isDirectory()) return toImageFiles(await walk(source));
  if (extname(source).toLowerCase() === '.zip') return fromZip(source);
  throw new Error(`${source} is not a folder or a .zip file`);
}
