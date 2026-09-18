import { uploadOneScan, type ScanUploadPort } from "./scanUpload";
import type { Scan } from "./types";

const scanFixture = (overrides: Partial<Scan> = {}): Scan => ({
  id: "scan00000000001",
  created: AT,
  updated: AT,
  deleted: null,
  owner: "user00000000001",
  rollId: "roll00000000001",
  frameId: "fram00000000001",
  fileName: "img001.jpg",
  sortIndex: 0,
  file: null,
  width: null,
  height: null,
  importedAt: AT,
  ...overrides,
});

const AT = "2026-09-21T10:00:00.000Z";

function port(overrides: Partial<ScanUploadPort<string>> = {}): {
  port: ScanUploadPort<string>;
  calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
    port: {
      createRecord: async (scan: Scan) => {
        calls.push(`create ${scan.id}`);
      },
      uploadFile: async (scan: Scan) => {
        calls.push(`upload ${scan.id}`);
        return "img001_abc.jpg";
      },
      markDeleted: async (scan: Scan) => {
        calls.push(`delete ${scan.id}`);
      },
      ...overrides,
    },
  };
}

describe("uploadOneScan", () => {
  const scan = scanFixture();

  it("creates the record, uploads the bytes and keeps the stored file name", async () => {
    const { port: uploader, calls } = port();

    const outcome = await uploadOneScan(uploader, scan, "bytes", AT);

    expect(calls).toEqual([`create ${scan.id}`, `upload ${scan.id}`]);
    expect(outcome).toEqual({
      status: "uploaded",
      scan: { ...scan, file: "img001_abc.jpg" },
    });
  });

  it("falls back to the imported name when the server answers without one", async () => {
    const { port: uploader } = port({ uploadFile: async () => null });

    const outcome = await uploadOneScan(uploader, scan, "bytes", AT);

    expect(outcome.status === "uploaded" && outcome.scan.file).toBe("img001.jpg");
  });

  it("repairs the orphan when the bytes never arrive", async () => {
    const { port: uploader, calls } = port({
      uploadFile: () => Promise.reject(new Error("413 payload too large")),
    });

    const outcome = await uploadOneScan(uploader, scan, "bytes", AT);

    // Left alone, the record would reach the app as a scan without an image.
    expect(calls).toEqual([`create ${scan.id}`, `delete ${scan.id}`]);
    expect(outcome).toEqual({
      status: "failed",
      reason: "413 payload too large",
      repaired: true,
    });
  });

  it("does not try to repair a record that was never created", async () => {
    const { port: uploader, calls } = port({
      createRecord: () => Promise.reject(new Error("400 create refused")),
    });

    expect(await uploadOneScan(uploader, scan, "bytes", AT)).toEqual({
      status: "failed",
      reason: "400 create refused",
      repaired: false,
    });
    expect(calls).toEqual([]);
  });

  it("reports the failure even when the repair fails too", async () => {
    const { port: uploader } = port({
      uploadFile: () => Promise.reject(new Error("connection lost")),
      markDeleted: () => Promise.reject(new Error("connection lost")),
    });

    expect(await uploadOneScan(uploader, scan, "bytes", AT)).toEqual({
      status: "failed",
      reason: "connection lost",
      repaired: false,
    });
  });
});
