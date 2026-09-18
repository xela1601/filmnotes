import { loadScanImage, scanImageUrl } from "./loadScanImage";
import { makeScan } from "../../testing/fixtures";

const BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

/** A minimal `SyncClient.fileUrl`, recording how the export asked for the file. */
const fileUrl = jest.fn(
  (collection: string, id: string, fileName: string, thumb?: string): string =>
    `https://pb.test/api/files/${collection}/${id}/${fileName}${
      thumb === undefined ? "" : `?thumb=${thumb}`
    }`,
);

/** A `fetch` answer without depending on a `Response` implementation being present. */
function fakeResponse(options: {
  bytes?: Uint8Array;
  contentType?: string | null;
  status?: number;
}): Response {
  const bytes = options.bytes ?? BYTES;
  const contentType = options.contentType === undefined ? "image/jpeg" : options.contentType;
  const status = options.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => (name.toLowerCase() === "content-type" ? contentType : null),
    },
    arrayBuffer: () => Promise.resolve(bytes.slice().buffer),
  } as unknown as Response;
}

const realFetch = globalThis.fetch;

function mockFetch(response: Response): jest.Mock {
  const mock = jest.fn(() => Promise.resolve(response));
  globalThis.fetch = mock;
  return mock;
}

describe("loadScanImage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("loads the full file and takes the mime type from the response", async () => {
    const scan = makeScan({ file: "img001_a1b2c3.jpg" });
    const fetchMock = mockFetch(fakeResponse({}));

    const image = await loadScanImage({ fileUrl }, scan, "full");

    expect(fileUrl).toHaveBeenCalledWith("scans", scan.id, "img001_a1b2c3.jpg", undefined);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://pb.test/api/files/scans/scan00000000001/img001_a1b2c3.jpg",
    );
    expect(image.mimeType).toBe("image/jpeg");
    expect(Array.from(image.bytes)).toEqual(Array.from(BYTES));
  });

  it("names the image after the scan, not after the stored file", async () => {
    const scan = makeScan({ fileName: "img001.jpg", file: "img001_a1b2c3.jpg" });
    mockFetch(fakeResponse({}));

    const image = await loadScanImage({ fileUrl }, scan, "full");

    expect(image.fileName).toBe("img001.jpg");
  });

  it("asks for the 1600 px thumbnail for the share package", async () => {
    const scan = makeScan({ file: "img001_a1b2c3.jpg" });
    mockFetch(fakeResponse({}));

    await loadScanImage({ fileUrl }, scan, "1600");

    expect(fileUrl).toHaveBeenCalledWith("scans", scan.id, "img001_a1b2c3.jpg", "1600x0");
  });

  it("ignores a charset the server appends to the content type", async () => {
    const scan = makeScan({ file: "img001_a1b2c3.png" });
    mockFetch(fakeResponse({ contentType: "image/png; charset=binary" }));

    const image = await loadScanImage({ fileUrl }, scan, "full");

    expect(image.mimeType).toBe("image/png");
  });

  it("falls back to the file extension when the server sends no image content type", async () => {
    const scan = makeScan({ fileName: "scan-07.PNG", file: "scan_07_a1b2c3.png" });
    mockFetch(fakeResponse({ contentType: "application/octet-stream" }));

    const image = await loadScanImage({ fileUrl }, scan, "full");

    expect(image.mimeType).toBe("image/png");
  });

  it("falls back to JPEG for an unknown extension", async () => {
    const scan = makeScan({ fileName: "scan-07", file: "scan_07_a1b2c3" });
    mockFetch(fakeResponse({ contentType: null }));

    const image = await loadScanImage({ fileUrl }, scan, "full");

    expect(image.mimeType).toBe("image/jpeg");
  });

  it("refuses a scan that has not been uploaded yet", async () => {
    const scan = makeScan({ file: null });
    const fetchMock = mockFetch(fakeResponse({}));

    await expect(loadScanImage({ fileUrl }, scan, "full")).rejects.toThrow(/not been uploaded/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports the status of a failed request", async () => {
    const scan = makeScan({ file: "img001_a1b2c3.jpg" });
    mockFetch(fakeResponse({ status: 404 }));

    await expect(loadScanImage({ fileUrl }, scan, "full")).rejects.toThrow(/404/);
  });
});

describe("scanImageUrl", () => {
  it("returns the thumbnail url a preview can show", () => {
    const scan = makeScan({ file: "img001_a1b2c3.jpg" });

    expect(scanImageUrl({ fileUrl }, scan, "1600")).toBe(
      "https://pb.test/api/files/scans/scan00000000001/img001_a1b2c3.jpg?thumb=1600x0",
    );
  });

  it("returns null for a scan that is not on the server", () => {
    expect(scanImageUrl({ fileUrl }, makeScan({ file: null }), "full")).toBeNull();
  });
});
