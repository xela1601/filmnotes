import {
  DEFAULT_SCAN_MIME_TYPE,
  isScanFileName,
  isServerScanMimeType,
  scanMimeType,
  SERVER_SCAN_MIME_TYPES,
} from "./scanFormats";

describe("scanMimeType", () => {
  it("knows the formats a lab delivers, whatever the case of the extension", () => {
    expect(scanMimeType("img001.jpg")).toBe("image/jpeg");
    expect(scanMimeType("IMG001.JPEG")).toBe("image/jpeg");
    expect(scanMimeType("scan.TIF")).toBe("image/tiff");
    expect(scanMimeType("photo.heic")).toBe("image/heic");
  });

  it("is null for anything that is not an image", () => {
    expect(scanMimeType("readme.txt")).toBeNull();
    expect(scanMimeType("contact-sheet.pdf")).toBeNull();
    expect(scanMimeType("no-extension")).toBeNull();
  });
});

describe("isServerScanMimeType", () => {
  it("accepts what the scans.file field allows", () => {
    for (const mimeType of SERVER_SCAN_MIME_TYPES)
      expect(isServerScanMimeType(mimeType)).toBe(true);
  });

  it("rejects HEIC, which the server does not store", () => {
    expect(isServerScanMimeType("image/heic")).toBe(false);
    expect(isServerScanMimeType("image/heif")).toBe(false);
  });

  it("has JPEG as the default a lab delivers", () => {
    expect(isServerScanMimeType(DEFAULT_SCAN_MIME_TYPE)).toBe(true);
  });
});

describe("isScanFileName", () => {
  it("picks up every image format, including the ones the server will refuse", () => {
    expect(isScanFileName("img001.jpg")).toBe(true);
    expect(isScanFileName("img001.heic")).toBe(true);
    expect(isScanFileName("__MACOSX/._img001.jpg")).toBe(true);
    expect(isScanFileName("notes.txt")).toBe(false);
  });
});
