import { renderHook } from "@testing-library/react-native";

import { SCAN_THUMB_SIZE, useScanThumb } from "./useScanThumb";
import { useStore } from "../../store/store";
import { makeScan } from "../../testing/fixtures";

// `src/sync/client.ts` pulls in the ESM-only `pocketbase` SDK, which jest-expo does not
// transform; only the URL builder matters here.
jest.mock("../../sync/client", () => ({
  createPocketBaseClient: (baseUrl: string) => ({
    fileUrl: (collection: string, id: string, fileName: string, thumb?: string, token?: string) =>
      `${baseUrl}/api/files/${collection}/${id}/${fileName}?thumb=${String(thumb)}` +
      (token === undefined ? "" : `&token=${token}`),
  }),
}));

// The file field is protected; the token comes from a logged-in session, which has its own test.
const mockFileToken = jest.fn<string | null, []>(() => "file-token");
jest.mock("../../sync/useFileToken", () => ({ useFileToken: () => mockFileToken() }));

const FRAME_ID = "frame0000000001";
const SERVER = "https://pb.test";

/** `scan00000000003` – the store only accepts 15-character ids. */
const scanId = (index: number): string => `scan${String(index).padStart(11, "0")}`;

function configureServer(): void {
  useStore.getState().updateSettings({ serverUrl: SERVER });
}

function thumb(frameId = FRAME_ID): string | null {
  return renderHook(() => useScanThumb(frameId)).result.current;
}

describe("useScanThumb", () => {
  beforeEach(() => {
    useStore.getState().resetAll();
    mockFileToken.mockReturnValue("file-token");
  });

  it("has no thumbnail until the file token has arrived", () => {
    configureServer();
    useStore
      .getState()
      .upsert("scans", makeScan({ id: scanId(1), frameId: FRAME_ID, file: "a_1.jpg" }));
    mockFileToken.mockReturnValue(null);

    expect(thumb()).toBeNull();
  });

  it("has no thumbnail without a configured server", () => {
    useStore
      .getState()
      .upsert("scans", makeScan({ id: scanId(1), frameId: FRAME_ID, file: "a_1.jpg" }));

    expect(thumb()).toBeNull();
  });

  it("has no thumbnail while the scan is not uploaded yet", () => {
    configureServer();
    useStore.getState().upsert("scans", makeScan({ id: scanId(1), frameId: FRAME_ID, file: null }));

    expect(thumb()).toBeNull();
  });

  it("has no thumbnail for a frame without a scan", () => {
    configureServer();
    useStore
      .getState()
      .upsert("scans", makeScan({ id: scanId(1), frameId: "frame0000000009", file: "a_1.jpg" }));

    expect(thumb()).toBeNull();
  });

  it("builds the file url of the uploaded scan at thumbnail size", () => {
    configureServer();
    useStore
      .getState()
      .upsert("scans", makeScan({ id: scanId(1), frameId: FRAME_ID, file: "a_1.jpg" }));

    expect(thumb()).toBe(
      `${SERVER}/api/files/scans/${scanId(1)}/a_1.jpg?thumb=${SCAN_THUMB_SIZE}&token=file-token`,
    );
  });

  it("ignores a deleted scan", () => {
    configureServer();
    useStore
      .getState()
      .upsert("scans", makeScan({ id: scanId(1), frameId: FRAME_ID, file: "a_1.jpg" }));
    useStore.getState().softDelete("scans", scanId(1));

    expect(thumb()).toBeNull();
  });

  it("shows the newest import when a frame was scanned twice", () => {
    configureServer();
    const { upsert } = useStore.getState();
    upsert(
      "scans",
      makeScan({
        id: scanId(1),
        frameId: FRAME_ID,
        file: "old.jpg",
        importedAt: "2026-09-18T10:00:00.000Z",
      }),
    );
    upsert(
      "scans",
      makeScan({
        id: scanId(2),
        frameId: FRAME_ID,
        file: "new.jpg",
        importedAt: "2026-10-01T10:00:00.000Z",
      }),
    );

    expect(thumb()).toBe(
      `${SERVER}/api/files/scans/${scanId(2)}/new.jpg?thumb=${SCAN_THUMB_SIZE}&token=file-token`,
    );
  });
});
