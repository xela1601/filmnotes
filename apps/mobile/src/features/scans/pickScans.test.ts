import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { zipSync } from "fflate";

import { expandZip, isZip, pickScanFiles, type PickedFile } from "./pickScans";

jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));

/**
 * An in-memory stand-in for the parts of expo-file-system the ZIP expansion uses.
 *
 * The real module needs the native FileSystem module, and `Platform.OS` is `ios` under
 * jest-expo, so the native branch of `expandZip` is the one that runs here.
 */
jest.mock("expo-file-system", () => {
  const contents = new Map<string, Uint8Array>();
  const directories = new Set<string>(["file:///cache"]);

  const join = (parts: readonly unknown[]): string =>
    parts
      .map((part) => (typeof part === "string" ? part : String((part as { uri: string }).uri)))
      .join("/");

  class FakeDirectory {
    readonly uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists(): boolean {
      return directories.has(this.uri);
    }
    create(): void {
      directories.add(this.uri);
    }
  }

  class FakeFile {
    readonly uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists(): boolean {
      return contents.has(this.uri);
    }
    get size(): number {
      return contents.get(this.uri)?.length ?? 0;
    }
    create(): void {
      if (!contents.has(this.uri)) contents.set(this.uri, new Uint8Array());
    }
    delete(): void {
      contents.delete(this.uri);
    }
    write(bytes: Uint8Array): void {
      contents.set(this.uri, bytes);
    }
    async bytes(): Promise<Uint8Array> {
      const found = contents.get(this.uri);
      if (found === undefined) throw new Error(`no such file: ${this.uri}`);
      return found;
    }
  }

  return {
    File: FakeFile,
    Directory: FakeDirectory,
    Paths: { cache: new FakeDirectory("file:///cache") },
    /** Test handle on the fake file system. */
    __contents: contents,
  };
});

const getDocumentAsync = DocumentPicker.getDocumentAsync as jest.Mock;
const fakeContents = (FileSystem as unknown as { __contents: Map<string, Uint8Array> }).__contents;

/** A four-byte PNG-ish payload; the ZIP only has to carry bytes, not a decodable image. */
const bytesOf = (seed: number): Uint8Array => new Uint8Array([0x89, 0x50, seed, 0x0a]);

/** Puts a ZIP on the fake file system and returns the `PickedFile` pointing at it. */
function zipFile(entries: Record<string, Uint8Array>, name = "roll.zip"): PickedFile {
  const bytes = zipSync(entries);
  const uri = `file:///picked/${name}`;
  fakeContents.set(uri, bytes);
  return { name, uri, mimeType: "application/zip", size: bytes.length };
}

describe("pickScanFiles", () => {
  beforeEach(() => {
    getDocumentAsync.mockReset();
  });

  it("returns nothing when the picker is cancelled", async () => {
    getDocumentAsync.mockResolvedValue({ canceled: true, assets: null });

    expect(await pickScanFiles()).toEqual([]);
  });

  it("asks for several images or a ZIP at once", async () => {
    getDocumentAsync.mockResolvedValue({ canceled: true, assets: null });

    await pickScanFiles();

    expect(getDocumentAsync).toHaveBeenCalledWith(
      expect.objectContaining({ multiple: true, type: ["image/*", "application/zip"] }),
    );
  });

  it("maps the picked assets onto plain files", async () => {
    getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [
        { name: "img001.jpg", uri: "file:///picked/img001.jpg", mimeType: "image/jpeg", size: 17 },
        { name: "img002.JPG", uri: "file:///picked/img002.JPG", lastModified: 0 },
      ],
    });

    expect(await pickScanFiles()).toEqual([
      { name: "img001.jpg", uri: "file:///picked/img001.jpg", mimeType: "image/jpeg", size: 17 },
      { name: "img002.JPG", uri: "file:///picked/img002.JPG", mimeType: "image/jpeg", size: 0 },
    ]);
  });
});

describe("isZip", () => {
  it("recognises a ZIP by name and by mime type", () => {
    expect(
      isZip({ name: "roll.ZIP", uri: "x", mimeType: "application/octet-stream", size: 1 }),
    ).toBe(true);
    expect(
      isZip({ name: "roll", uri: "x", mimeType: "application/x-zip-compressed", size: 1 }),
    ).toBe(true);
    expect(isZip({ name: "img001.jpg", uri: "x", mimeType: "image/jpeg", size: 1 })).toBe(false);
  });
});

describe("expandZip", () => {
  it("keeps the images and drops macOS metadata and other files", async () => {
    const file = zipFile({
      "a/1.jpg": bytesOf(1),
      "__MACOSX/._1.jpg": bytesOf(2),
      "readme.txt": bytesOf(3),
    });

    const expanded = await expandZip(file);

    expect(expanded).toHaveLength(1);
    expect(expanded[0]).toMatchObject({ name: "1.jpg", mimeType: "image/jpeg", size: 4 });
  });

  it("writes the bytes of an entry where the uploader can read them", async () => {
    const file = zipFile({ "a/1.jpg": bytesOf(7) });

    const expanded = await expandZip(file);
    const written = expanded[0] === undefined ? undefined : fakeContents.get(expanded[0].uri);

    expect(written).toEqual(bytesOf(7));
  });

  it("returns the entries in natural name order", async () => {
    const file = zipFile({
      "scan_10.jpg": bytesOf(1),
      "scan_2.png": bytesOf(2),
      "scan_1.jpeg": bytesOf(3),
    });

    const expanded = await expandZip(file);

    expect(expanded.map((entry) => entry.name)).toEqual([
      "scan_1.jpeg",
      "scan_2.png",
      "scan_10.jpg",
    ]);
    expect(expanded.map((entry) => entry.mimeType)).toEqual([
      "image/jpeg",
      "image/png",
      "image/jpeg",
    ]);
  });

  it("keeps two entries with the same name apart on disk", async () => {
    const file = zipFile({ "a/1.jpg": bytesOf(1), "b/1.jpg": bytesOf(2) });

    const expanded = await expandZip(file);

    expect(expanded.map((entry) => entry.name)).toEqual(["1.jpg", "1.jpg"]);
    expect(new Set(expanded.map((entry) => entry.uri)).size).toBe(2);
  });
});
