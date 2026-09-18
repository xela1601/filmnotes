import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import { zipSync } from 'fflate';

import { cleanupTempDirs, listImageFiles } from './files';
import { jpegBytes, pngBytes } from './testImages';

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'scan-import-files-test-'));
});

afterEach(() => {
  cleanupTempDirs();
  rmSync(workDir, { recursive: true, force: true });
});

function writeImage(relativePath: string, bytes: Uint8Array = jpegBytes()): void {
  const target = join(workDir, relativePath);
  mkdirSync(join(target, '..'), { recursive: true });
  writeFileSync(target, bytes);
}

describe('listImageFiles from a folder', () => {
  it('collects images recursively, in natural order, and skips other files', async () => {
    writeImage('b2.JPG');
    writeImage('a10.jpeg');
    writeImage('sub/c.png', pngBytes());
    writeFileSync(join(workDir, 'notes.txt'), 'not an image');

    const files = await listImageFiles(workDir);

    expect(files.map((file) => file.name)).toEqual(['a10.jpeg', 'b2.JPG', 'c.png']);
    expect(files.map((file) => file.mimeType)).toEqual(['image/jpeg', 'image/jpeg', 'image/png']);
    expect(files.map((file) => basename(file.path))).toEqual(['a10.jpeg', 'b2.JPG', 'c.png']);
    expect(readFileSync(files[2]!.path)).toEqual(Buffer.from(pngBytes()));
  });

  it('sorts embedded numbers numerically, the way a file browser does', async () => {
    for (const name of ['img10.jpg', 'img2.jpg', 'img1.jpg']) writeImage(name);

    const files = await listImageFiles(workDir);

    expect(files.map((file) => file.name)).toEqual(['img1.jpg', 'img2.jpg', 'img10.jpg']);
  });

  it('knows the mime type of every supported extension', async () => {
    for (const name of ['a.jpg', 'b.jpeg', 'c.png', 'd.tif', 'e.tiff', 'f.webp']) writeImage(name);

    const files = await listImageFiles(workDir);

    expect(files.map((file) => file.mimeType)).toEqual([
      'image/jpeg',
      'image/jpeg',
      'image/png',
      'image/tiff',
      'image/tiff',
      'image/webp',
    ]);
  });

  it('makes repeated base names unique', async () => {
    writeImage('a/x.jpg');
    writeImage('b/x.jpg');

    const files = await listImageFiles(workDir);

    expect(files.map((file) => file.name)).toEqual(['x.jpg', 'x-2.jpg']);
  });

  it('rejects a source that does not exist', async () => {
    await expect(listImageFiles(join(workDir, 'nope'))).rejects.toThrow(/nope/);
  });
});

describe('listImageFiles from a zip', () => {
  function writeZip(entries: Record<string, Uint8Array>): string {
    const path = join(workDir, 'scans.zip');
    writeFileSync(path, zipSync(entries));
    return path;
  }

  it('extracts the images to a temp dir, in natural order', async () => {
    const path = writeZip({
      'img10.jpg': jpegBytes(),
      'img2.jpg': jpegBytes(),
      'sub/img1.png': pngBytes(),
      'notes.txt': new TextEncoder().encode('not an image'),
    });

    const files = await listImageFiles(path);

    expect(files.map((file) => file.name)).toEqual(['img1.png', 'img2.jpg', 'img10.jpg']);
    expect(files.map((file) => file.mimeType)).toEqual(['image/png', 'image/jpeg', 'image/jpeg']);
    expect(files[0]!.path).not.toContain(workDir);
    expect(readFileSync(files[0]!.path)).toEqual(Buffer.from(pngBytes()));
    expect(readFileSync(files[1]!.path)).toEqual(Buffer.from(jpegBytes()));
  });

  it('removes the extracted files again on cleanup', async () => {
    const files = await listImageFiles(writeZip({ 'img1.jpg': jpegBytes() }));
    const extracted = files[0]!.path;

    cleanupTempDirs();

    expect(() => readFileSync(extracted)).toThrow();
  });

  it('skips the resource forks a macOS zip carries', async () => {
    const path = writeZip({
      '__MACOSX/._img1.jpg': jpegBytes(),
      '.hidden.jpg': jpegBytes(),
      'img1.jpg': jpegBytes(),
    });

    const files = await listImageFiles(path);

    expect(files.map((file) => file.name)).toEqual(['img1.jpg']);
  });

  it('rejects a file that is neither a folder nor a zip', async () => {
    const path = join(workDir, 'notes.txt');
    writeFileSync(path, 'not an archive');

    await expect(listImageFiles(path)).rejects.toThrow(/folder or a \.zip/);
  });
});
