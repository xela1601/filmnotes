import type { SharePayload } from "@filmnotes/exporters";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { ExportRollScreen } from "./ExportRollScreen";
import { i18n } from "../../i18n";
import type { SecretKey } from "../../lib/secureStore";
import { useStore } from "../../store/store";
import { FIXTURE_NOW, makeFrame, makeRoll, makeScan } from "../../testing/fixtures";

const ROLL_ID = "roll00000000001";

const mockShareOut = jest.fn<Promise<void>, [SharePayload]>();
const mockGetSecret = jest.fn<Promise<string | null>, [SecretKey]>();

// Lazy factory bodies: they run while the screen is imported.
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));
jest.mock("./shareOut", () => ({
  shareOut: (payload: SharePayload) => mockShareOut(payload),
}));
jest.mock("../../lib/secureStore", () => ({
  getSecret: (key: string) => mockGetSecret(key as SecretKey),
  setSecret: () => Promise.resolve(),
}));
jest.mock("../../sync/client", () => ({
  createPocketBaseClient: () => ({ fileUrl: () => "https://pb.test/file" }),
}));

const frameId = (index: number): string => `frame${String(index).padStart(10, "0")}`;
const scanId = (index: number): string => `scan0${String(index).padStart(10, "0")}`;

/**
 * A roll with `frames` frames of which the first `withScan` have an uploaded scan; one further
 * frame carries a scan record that has not been uploaded yet.
 */
function seedRoll(frames: number, withScan: number): void {
  const { upsert, seedPresets } = useStore.getState();
  seedPresets(FIXTURE_NOW);
  upsert("rolls", makeRoll({ id: ROLL_ID }));
  for (let index = 1; index <= frames; index += 1) {
    upsert("frames", makeFrame({ id: frameId(index), rollId: ROLL_ID, frameNo: index }));
    if (index > withScan) continue;
    upsert(
      "scans",
      makeScan({
        id: scanId(index),
        rollId: ROLL_ID,
        frameId: frameId(index),
        sortIndex: index,
        fileName: `img00${index}.jpg`,
        file: `img00${index}_x.jpg`,
      }),
    );
  }
}

describe("ExportRollScreen", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    useStore.getState().resetAll();
    mockShareOut.mockResolvedValue(undefined);
    mockGetSecret.mockResolvedValue(null);
    await i18n.changeLanguage("de");
  });

  it("lists only the frames with an uploaded scan, all selected", () => {
    seedRoll(4, 2);

    render(<ExportRollScreen rollId={ROLL_ID} />);

    expect(screen.getByTestId(`export-frame-${frameId(1)}`)).toHaveProp("value", true);
    expect(screen.getByTestId(`export-frame-${frameId(2)}`)).toHaveProp("value", true);
    expect(screen.queryByTestId(`export-frame-${frameId(3)}`)).toBeNull();
    expect(screen.getByTestId("export-roll-run")).toHaveTextContent(
      i18n.t("export:roll.run", { count: 2 }),
    );
  });

  it("exports only the frames that are still selected", async () => {
    seedRoll(3, 3);

    render(<ExportRollScreen rollId={ROLL_ID} />);
    fireEvent(screen.getByTestId(`export-frame-${frameId(2)}`), "valueChange", false);
    fireEvent.press(screen.getByTestId("export-roll-run"));

    await waitFor(() => {
      expect(screen.getByTestId("export-roll-result")).toBeOnTheScreen();
    });
    expect(mockShareOut).toHaveBeenCalledTimes(2);
    const logs = Object.values(useStore.getState().entities.exportLogs);
    expect(logs.map((log) => log.frameId).sort()).toEqual([frameId(1), frameId(3)]);
  });

  it("clears and restores the selection", () => {
    seedRoll(2, 2);

    render(<ExportRollScreen rollId={ROLL_ID} />);
    fireEvent.press(screen.getByTestId("export-select-none"));

    expect(screen.getByTestId(`export-frame-${frameId(1)}`)).toHaveProp("value", false);
    expect(screen.getByTestId("export-roll-run")).toBeDisabled();

    fireEvent.press(screen.getByTestId("export-select-all"));
    expect(screen.getByTestId(`export-frame-${frameId(1)}`)).toHaveProp("value", true);
  });

  it("runs the exports one after the other and counts the progress", async () => {
    seedRoll(3, 3);
    const pending: (() => void)[] = [];
    mockShareOut.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          pending.push(resolve);
        }),
    );

    render(<ExportRollScreen rollId={ROLL_ID} />);
    fireEvent.press(screen.getByTestId("export-roll-run"));

    // The first export is waiting for the share sheet, so no frame is finished yet.
    await waitFor(() => {
      expect(pending).toHaveLength(1);
    });
    expect(screen.getByTestId("export-progress")).toHaveTextContent(
      i18n.t("export:roll.progress", { done: 0, total: 3 }),
    );

    pending[0]?.();
    await waitFor(() => {
      expect(screen.getByTestId("export-progress")).toHaveTextContent(
        i18n.t("export:roll.progress", { done: 1, total: 3 }),
      );
    });
    // Sequential: the second export only started after the first one had finished.
    expect(pending).toHaveLength(2);

    pending[1]?.();
    await waitFor(() => {
      expect(pending).toHaveLength(3);
    });
    pending[2]?.();

    await waitFor(() => {
      expect(screen.getByTestId("export-roll-result")).toHaveTextContent(
        i18n.t("export:roll.done", { ok: 3, total: 3 }),
      );
    });
  });

  it("collects the frames whose export failed and keeps going", async () => {
    seedRoll(3, 3);
    mockShareOut
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("no share sheet here"))
      .mockResolvedValueOnce(undefined);

    render(<ExportRollScreen rollId={ROLL_ID} />);
    fireEvent.press(screen.getByTestId("export-roll-run"));

    await waitFor(() => {
      expect(screen.getByTestId("export-roll-result")).toHaveTextContent(
        i18n.t("export:roll.done", { ok: 2, total: 3 }),
      );
    });
    expect(screen.getByTestId(`export-failure-${frameId(2)}`)).toHaveTextContent(
      i18n.t("export:roll.failure", { frameNo: 2, message: "no share sheet here" }),
    );
    // The failed hand-over leaves no export log behind.
    expect(Object.values(useStore.getState().entities.exportLogs)).toHaveLength(2);
  });

  it("disables WordPress while it is not set up", () => {
    seedRoll(1, 1);

    render(<ExportRollScreen rollId={ROLL_ID} />);

    expect(screen.getByTestId("export-target-wordpress")).toBeDisabled();
    expect(screen.getByTestId("export-target-share")).not.toBeDisabled();
  });

  it("says so when no frame of the roll has an uploaded scan", () => {
    seedRoll(2, 0);

    render(<ExportRollScreen rollId={ROLL_ID} />);

    expect(screen.getByText(i18n.t("export:roll.noFrames"))).toBeOnTheScreen();
    expect(screen.queryByTestId("export-roll-run")).toBeNull();
  });

  it("shows a hint when the roll does not exist", () => {
    render(<ExportRollScreen rollId="roll00000000404" />);

    expect(screen.getByText(i18n.t("export:rollNotFound"))).toBeOnTheScreen();
  });
});
