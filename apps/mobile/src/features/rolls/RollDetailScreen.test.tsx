import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import { Alert } from "react-native";

import { i18n } from "../../i18n";
import { useStore } from "../../store/store";
import { FIXTURE_NOW, makeFrame, makeRoll, makeScan } from "../../testing/fixtures";
import { RollDetailScreen } from "./RollDetailScreen";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));

const ROLL_ID = "roll00000000001";
const LENS_35_70 = "lens0min3570f40";

/** `frame0000000007` – the store only accepts 15-character ids. */
const frameId = (index: number): string => `frame${String(index).padStart(10, "0")}`;

function fillRoll(count: number, exposures: 24 | 36 = 36): void {
  const { upsert } = useStore.getState();
  upsert("rolls", makeRoll({ id: ROLL_ID, exposures }));
  for (let index = 1; index <= count; index += 1) {
    upsert("frames", makeFrame({ id: frameId(index), rollId: ROLL_ID, frameNo: index }));
  }
}

describe("RollDetailScreen", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    useStore.getState().resetAll();
    useStore.getState().seedPresets(FIXTURE_NOW);
    await i18n.changeLanguage("de");
  });

  it("shows film, camera, ISO and status of the roll", () => {
    fillRoll(0);

    render(<RollDetailScreen rollId={ROLL_ID} />);

    expect(screen.getByTestId("roll-detail-title")).toHaveTextContent(
      "Kodak Gold 200 · 2026-09-18",
    );
    expect(screen.getByTestId("roll-detail-camera")).toHaveTextContent("Minolta 7000 AF");
    expect(screen.getByTestId("roll-detail-iso")).toHaveTextContent("ISO 200 · DX");
    expect(screen.getByTestId("roll-detail-status-open")).toHaveTextContent(
      i18n.t("rolls:status.loaded"),
    );
  });

  it("lists the frames as one line each", () => {
    fillRoll(0);
    useStore.getState().upsert(
      "frames",
      makeFrame({
        id: frameId(1),
        rollId: ROLL_ID,
        frameNo: 1,
        shutterSpeed: "1/125",
        aperture: 8,
        notes: "Harbour crane",
      }),
    );

    render(<RollDetailScreen rollId={ROLL_ID} />);

    expect(screen.getByTestId(`frame-item-${frameId(1)}`)).toHaveTextContent(
      "#1 · 1/125 · f/8 · Harbour crane",
    );
  });

  it("opens a frame", () => {
    fillRoll(1);

    render(<RollDetailScreen rollId={ROLL_ID} />);
    fireEvent.press(screen.getByTestId(`frame-item-${frameId(1)}`));

    expect(router.push).toHaveBeenCalledWith(`/frames/${frameId(1)}`);
  });

  it("adds a frame with the next number and the camera defaults", () => {
    fillRoll(0);

    render(<RollDetailScreen rollId={ROLL_ID} />);
    fireEvent.press(screen.getByTestId("roll-detail-add-frame"));

    const frames = Object.values(useStore.getState().entities.frames);
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({
      rollId: ROLL_ID,
      frameNo: 1,
      exposureMode: "P",
      lensId: LENS_35_70,
      focusMode: "AF",
      driveMode: "S",
      support: "handheld",
    });
    expect(router.push).toHaveBeenCalledWith(`/frames/${frames[0]?.id ?? ""}`);
  });

  it("continues after the highest frame number in use", () => {
    fillRoll(0);
    useStore
      .getState()
      .upsert("frames", makeFrame({ id: frameId(3), rollId: ROLL_ID, frameNo: 3 }));

    render(<RollDetailScreen rollId={ROLL_ID} />);
    fireEvent.press(screen.getByTestId("roll-detail-add-frame"));

    const numbers = Object.values(useStore.getState().entities.frames).map((f) => f.frameNo);
    expect(numbers.sort((a, b) => a - b)).toEqual([3, 4]);
  });

  it("stops adding frames once the roll is full", () => {
    fillRoll(24, 24);

    render(<RollDetailScreen rollId={ROLL_ID} />);

    expect(screen.getByTestId("roll-detail-add-frame")).toBeDisabled();
  });

  it("advances the status of the roll", () => {
    fillRoll(0);

    render(<RollDetailScreen rollId={ROLL_ID} />);
    fireEvent.press(screen.getByTestId("roll-detail-status-open"));
    fireEvent.press(screen.getByTestId("roll-detail-status-option-developed"));

    const roll = useStore.getState().entities.rolls[ROLL_ID];
    expect(roll?.status).toBe("developed");
    expect(roll?.unloadedAt).not.toBeNull();
  });

  it("links to scan import, export and the edit form", () => {
    fillRoll(0);

    render(<RollDetailScreen rollId={ROLL_ID} />);

    fireEvent.press(screen.getByTestId("roll-detail-import-scans"));
    expect(router.push).toHaveBeenCalledWith(`/scans/${ROLL_ID}`);

    fireEvent.press(screen.getByTestId("roll-detail-export"));
    expect(router.push).toHaveBeenCalledWith(`/export/roll/${ROLL_ID}`);

    fireEvent.press(screen.getByTestId("roll-detail-edit"));
    expect(router.push).toHaveBeenCalledWith(`/rolls/${ROLL_ID}/edit`);
  });

  it("soft-deletes the roll with its frames, scans and export logs", () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    fillRoll(2);
    useStore
      .getState()
      .upsert("scans", makeScan({ id: "scan00000000001", rollId: ROLL_ID, frameId: frameId(1) }));

    render(<RollDetailScreen rollId={ROLL_ID} />);
    fireEvent.press(screen.getByTestId("roll-detail-delete"));

    const buttons = alert.mock.calls[0]?.[2];
    const confirm = buttons?.find((button) => button.style === "destructive");
    expect(confirm).toBeDefined();
    confirm?.onPress?.();

    const state = useStore.getState();
    expect(state.entities.rolls[ROLL_ID]?.deleted).not.toBeNull();
    expect(state.entities.frames[frameId(1)]?.deleted).not.toBeNull();
    expect(state.entities.frames[frameId(2)]?.deleted).not.toBeNull();
    // Left alive, the scan kept syncing and kept its file on the server for a roll that is gone.
    expect(state.entities.scans["scan00000000001"]?.deleted).not.toBeNull();
    alert.mockRestore();
  });

  it("shows a hint when the roll does not exist", () => {
    render(<RollDetailScreen rollId="roll00000000404" />);

    expect(screen.getByText(i18n.t("rolls:notFound"))).toBeOnTheScreen();
  });
});
