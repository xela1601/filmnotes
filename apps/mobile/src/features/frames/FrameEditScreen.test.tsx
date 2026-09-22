/**
 * Tests for the frame edit screen – the screen of core scenario step 4 (spec §2.1).
 *
 * The store is seeded with the shipped Minolta preset, so the equipment ids used here are the
 * real ones (`cam0minolta7000`, `lens0min3570f40`, `filt0kenkopl490`, …).
 */
import type { Camera, Frame } from "@filmnotes/domain";
import { newFrame } from "@filmnotes/domain";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Alert } from "react-native";

import { i18n } from "../../i18n";
import { selectFramesForRoll } from "../../store/selectors";
import { useStore } from "../../store/store";
import { FIXTURE_NOW, makeRoll } from "../../testing/fixtures";
import { FrameEditScreen } from "./FrameEditScreen";

jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

const roll = makeRoll();

/** Seeds presets, the roll and one frame, and points the route parameter at that frame. */
function setup(overrides: Partial<Frame> = {}): Frame {
  useStore.getState().resetAll();
  useStore.getState().seedPresets(FIXTURE_NOW);

  const camera = useStore.getState().entities.cameras["cam0minolta7000"] as Camera;
  useStore.getState().applyRemote("rolls", [roll]);

  const frame: Frame = {
    ...newFrame({ rollId: roll.id, frameNo: 1, camera, previous: null, now: FIXTURE_NOW }),
    ...overrides,
  };
  // applyRemote instead of upsert: the fixture keeps its `updated` stamp, so a later save is visible.
  useStore.getState().applyRemote("frames", [frame]);
  (useLocalSearchParams as jest.Mock).mockReturnValue({ frameId: frame.id });

  return frame;
}

/** The frame as it is stored right now. */
function stored(id: string): Frame {
  const record = useStore.getState().entities.frames[id];
  if (record === undefined) throw new Error(`frame ${id} is not in the store`);
  return record;
}

/**
 * Renders with the details open: everything below the exposure is collapsed by default (that is
 * the point of the switch), so a test about lens, filters, flash, focus or the time fields has to
 * open them first - exactly as the user does once, after which it is remembered.
 */
function renderWithDetails(): void {
  render(<FrameEditScreen />);
  fireEvent.press(screen.getByTestId("frame-details-toggle"));
}

describe("FrameEditScreen", () => {
  let frame: Frame;

  beforeEach(async () => {
    jest.clearAllMocks();
    await i18n.changeLanguage("de");
    frame = setup();
  });

  it("1. shows the frame number with the roll length and the time of the shot", () => {
    renderWithDetails();

    expect(screen.getByText(i18n.t("frames:title", { no: 1, total: 36 }))).toBeOnTheScreen();
    // The fixture is 10:00 UTC and the suite runs in Europe/Berlin: the photographer reads 12:00.
    expect(screen.getByDisplayValue("2026-09-18")).toBeOnTheScreen();
    expect(screen.getByDisplayValue("12:00")).toBeOnTheScreen();

    fireEvent.changeText(screen.getByTestId("frame-taken-time"), "11:30");
    fireEvent.press(screen.getByTestId("frame-save"));

    expect(stored(frame.id).takenAt).toBe("2026-09-18T09:30:00.000Z");
  });

  it("2. records the exposure in every mode and says who chose it", () => {
    renderWithDetails();

    // P: the camera picks both halves - but the fields stay, because the camera *shows* what it
    // picked and writing that down is the point of the app.
    expect(screen.getByTestId("frame-shutter")).toBeOnTheScreen();
    expect(screen.getByTestId("frame-aperture")).toBeOnTheScreen();
    expect(screen.getAllByText(new RegExp(i18n.t("frames:fields.chosenByCamera")))).toHaveLength(2);
    expect(screen.getByTestId("frame-program-shift")).toBeOnTheScreen();
    expect(screen.getByTestId("frame-compensation")).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId("frame-mode-option-M"));

    expect(screen.getByTestId("frame-shutter")).toBeOnTheScreen();
    expect(screen.getByTestId("frame-aperture")).toBeOnTheScreen();
    expect(screen.queryByText(new RegExp(i18n.t("frames:fields.chosenByCamera")))).toBeNull();
    expect(screen.queryByTestId("frame-program-shift")).toBeNull();
    expect(screen.queryByTestId("frame-compensation")).toBeNull();
  });

  it("2a. keeps the time the camera chose in A editable and saves it", () => {
    render(<FrameEditScreen />);

    fireEvent.press(screen.getByTestId("frame-mode-option-A"));
    fireEvent.press(screen.getByTestId("frame-shutter-open"));
    fireEvent.press(screen.getByTestId("frame-shutter-option-1/125"));
    fireEvent.press(screen.getByTestId("frame-save"));

    expect(stored(frame.id).shutterSpeed).toBe("1/125");
  });

  it("2b. keeps an aperture the lens does not have visible, so the error can be cleared", () => {
    // f/1.7 belongs to the 50 mm; the frame starts on the 35-70, whose widest stop is f/4.
    frame = setup({ exposureMode: "M", aperture: 1.7 });
    render(<FrameEditScreen />);

    // The closed field shows the stranded value instead of "–" ...
    expect(screen.getByTestId("frame-aperture")).toHaveTextContent(/1\.7/);
    expect(screen.getByTestId("frame-issues")).toHaveTextContent(
      i18n.t("common:validation.aperture_not_on_lens"),
    );

    // ... and the picker offers it too, so it is never a value you cannot get rid of.
    fireEvent.press(screen.getByTestId("frame-aperture-open"));
    expect(screen.getByTestId("frame-aperture-option-1.7")).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId("frame-aperture-option-8"));
    fireEvent.press(screen.getByTestId("frame-save"));

    expect(stored(frame.id).aperture).toBe(8);
  });

  it("1a. refuses a half-typed time instead of silently storing midnight", () => {
    renderWithDetails();

    fireEvent.changeText(screen.getByTestId("frame-taken-time"), "9:5");

    expect(screen.getByTestId("frame-taken-time-error")).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId("frame-save"));
    expect(stored(frame.id).takenAt).toBe(FIXTURE_NOW);

    fireEvent.changeText(screen.getByTestId("frame-taken-time"), "09:50");
    expect(screen.queryByTestId("frame-taken-time-error")).toBeNull();
    fireEvent.press(screen.getByTestId("frame-save"));
    expect(stored(frame.id).takenAt).toBe("2026-09-18T07:50:00.000Z");
  });

  it("1b. refuses a date the calendar does not have instead of rolling it over", () => {
    renderWithDetails();

    fireEvent.changeText(screen.getByTestId("frame-taken-date"), "2026-13-45");

    expect(screen.getByTestId("frame-taken-date-error")).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId("frame-save"));
    expect(stored(frame.id).takenAt).toBe(FIXTURE_NOW);
  });

  it("1c. clearing both fields records the frame without a time", () => {
    renderWithDetails();

    fireEvent.changeText(screen.getByTestId("frame-taken-date"), "");
    fireEvent.changeText(screen.getByTestId("frame-taken-time"), "");
    fireEvent.press(screen.getByTestId("frame-save"));

    expect(stored(frame.id).takenAt).toBeNull();
  });

  it("1d. shows no coordinates for a frame that has none", () => {
    render(<FrameEditScreen />);

    expect(screen.queryByTestId("frame-location-coords")).toBeNull();
  });

  it("0. shows the exposure and the notes, and hides the rest behind one switch", () => {
    render(<FrameEditScreen />);

    // What you touch for almost every frame.
    expect(screen.getByTestId("frame-mode")).toBeOnTheScreen();
    expect(screen.getByTestId("frame-shutter")).toBeOnTheScreen();
    expect(screen.getByTestId("frame-aperture")).toBeOnTheScreen();
    expect(screen.getByTestId("frame-notes")).toBeOnTheScreen();

    // The rest is carried over from the previous frame and is one tap away.
    expect(screen.queryByTestId("frame-section-optics")).toBeNull();
    expect(screen.queryByTestId("frame-lens")).toBeNull();
    expect(screen.queryByTestId("frame-focus-mode")).toBeNull();
    expect(screen.queryByTestId("frame-support")).toBeNull();
    expect(screen.queryByTestId("frame-compensation")).toBeNull();
    expect(screen.queryByTestId("frame-taken-date")).toBeNull();

    fireEvent.press(screen.getByTestId("frame-details-toggle"));

    expect(screen.getByTestId("frame-section-optics")).toBeOnTheScreen();
    expect(screen.getByTestId("frame-lens")).toBeOnTheScreen();
    expect(screen.getByTestId("frame-support")).toBeOnTheScreen();
    expect(screen.getByTestId("frame-taken-date")).toBeOnTheScreen();
  });

  it("0a. remembers the choice for the next frame", () => {
    const first = render(<FrameEditScreen />);
    fireEvent.press(screen.getByTestId("frame-details-toggle"));
    expect(useStore.getState().settings.frameDetailsExpanded).toBe(true);
    first.unmount();

    render(<FrameEditScreen />);

    expect(screen.getByTestId("frame-lens")).toBeOnTheScreen();
  });

  it("0b. opens the details by itself when an error is hiding in them", () => {
    // f/1.7 belongs to the 50 mm; on the 35-70 it is an error that blocks saving - and the
    // field to fix sits in the collapsed part.
    frame = setup({ exposureMode: "M", aperture: 1.7 });
    render(<FrameEditScreen />);

    expect(screen.getByTestId("frame-issues")).toHaveTextContent(
      i18n.t("common:validation.aperture_not_on_lens"),
    );
    expect(screen.getByTestId("frame-lens")).toBeOnTheScreen();
  });

  it("3. offers bulb in M but not in S", () => {
    render(<FrameEditScreen />);

    fireEvent.press(screen.getByTestId("frame-mode-option-M"));
    fireEvent.press(screen.getByTestId("frame-shutter-open"));
    expect(screen.getByTestId("frame-shutter-option-bulb")).toBeOnTheScreen();
    expect(screen.getByTestId("frame-shutter-option-1/125")).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId("frame-mode-option-S"));
    fireEvent.press(screen.getByTestId("frame-shutter-open"));
    expect(screen.queryByTestId("frame-shutter-option-bulb")).toBeNull();
    expect(screen.getByTestId("frame-shutter-option-1/125")).toBeOnTheScreen();
  });

  it("4. offers the aperture scale of the selected lens", () => {
    renderWithDetails();

    fireEvent.press(screen.getByTestId("frame-mode-option-M"));
    fireEvent.press(screen.getByTestId("frame-aperture-open"));

    // The 35-70 mm f/4 starts at f/4.
    expect(screen.getByTestId("frame-aperture-option-4")).toBeOnTheScreen();
    for (const faster of ["1.7", "2", "2.4", "2.8", "3.4"]) {
      expect(screen.queryByTestId(`frame-aperture-option-${faster}`)).toBeNull();
    }

    fireEvent.press(screen.getByTestId("frame-lens-option-lens0min50f1700"));
    fireEvent.press(screen.getByTestId("frame-aperture-open"));

    // The 50 mm f/1.7 starts at f/1.7.
    expect(screen.getByTestId("frame-aperture-option-1.7")).toBeOnTheScreen();
    expect(screen.getByTestId("frame-aperture-option-4")).toBeOnTheScreen();
  });

  it("5. warns about the linear polarizer while the focus mode is AF", () => {
    renderWithDetails();

    fireEvent.press(screen.getByTestId("frame-filters-option-filt0kenkopl490"));

    expect(screen.getByTestId("frame-issues-polarizer_blocks_af")).toHaveTextContent(
      i18n.t("validation.polarizer_blocks_af"),
    );

    fireEvent.press(screen.getByTestId("frame-focus-mode-option-M"));

    expect(screen.queryByTestId("frame-issues-polarizer_blocks_af")).toBeNull();
  });

  it("6. warns about camera shake below the hand-held limit of the lens", () => {
    render(<FrameEditScreen />);

    fireEvent.press(screen.getByTestId("frame-mode-option-M"));
    fireEvent.press(screen.getByTestId("frame-shutter-open"));
    fireEvent.press(screen.getByTestId("frame-shutter-option-1/15"));

    expect(screen.getByTestId("frame-issues-handheld_shake_risk")).toHaveTextContent("1/60", {
      exact: false,
    });
  });

  it("7. asks for head and power only once a flash is chosen", () => {
    renderWithDetails();

    expect(screen.queryByTestId("frame-flash-head")).toBeNull();
    expect(screen.queryByTestId("frame-flash-power")).toBeNull();

    fireEvent.press(screen.getByTestId("frame-flash-option-flash0min2800af"));

    expect(screen.getByTestId("frame-flash-head")).toBeOnTheScreen();
    expect(screen.getByTestId("frame-flash-power")).toBeOnTheScreen();
  });

  it("8. saves the frame and goes back", () => {
    render(<FrameEditScreen />);

    fireEvent.changeText(screen.getByTestId("frame-notes"), "Kirchturm im Gegenlicht");
    fireEvent.press(screen.getByTestId("frame-save"));

    expect(stored(frame.id).notes).toBe("Kirchturm im Gegenlicht");
    expect(stored(frame.id).updated).not.toBe(FIXTURE_NOW);
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("8. saves and opens the next frame, carrying the setup over", () => {
    render(<FrameEditScreen />);

    fireEvent.press(screen.getByTestId("frame-mode-option-A"));
    fireEvent.press(screen.getByTestId("frame-save-next"));

    const frames = selectFramesForRoll(useStore.getState(), roll.id);
    expect(frames).toHaveLength(2);

    const next = frames[1];
    expect(next?.frameNo).toBe(2);
    expect(next?.exposureMode).toBe("A");
    expect(next?.lensId).toBe("lens0min3570f40");
    expect(next?.filterIds).toEqual(["filt0hamauv49a0"]);
    expect(router.replace).toHaveBeenCalledWith(`/frames/${next?.id}`);
  });

  it('8. hides "save & next" on the last frame of the roll', () => {
    setup({ frameNo: 36 });
    render(<FrameEditScreen />);

    expect(screen.getByTestId("frame-save")).toBeOnTheScreen();
    expect(screen.queryByTestId("frame-save-next")).toBeNull();
  });

  it("9. soft-deletes the frame after a confirmation", () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    render(<FrameEditScreen />);

    fireEvent.press(screen.getByTestId("frame-delete"));
    expect(stored(frame.id).deleted).toBeNull();

    const buttons = alert.mock.calls[0]?.[2];
    const confirm = buttons?.find((button) => button.style === "destructive");
    expect(confirm).toBeDefined();
    // The alert's callback runs outside React, so the resulting store write needs act().
    act(() => confirm?.onPress?.());

    expect(stored(frame.id).deleted).not.toBeNull();
    expect(router.back).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });

  it("10. blocks saving while an error is open", () => {
    setup({ focalLengthMm: 200 });
    render(<FrameEditScreen />);

    expect(screen.getByTestId("frame-issues-focal_length_out_of_range")).toBeOnTheScreen();
    expect(screen.getByTestId("frame-save")).toBeDisabled();
  });

  it("10. still saves with a warning or an information", () => {
    setup({ exposureMode: "M", shutterSpeed: "1/15", exposureCompensationEv: 1 });
    render(<FrameEditScreen />);

    expect(screen.getByTestId("frame-issues-handheld_shake_risk")).toBeOnTheScreen();
    expect(screen.getByTestId("frame-issues-compensation_ignored_in_m")).toBeOnTheScreen();
    expect(screen.getByTestId("frame-save")).toBeEnabled();
  });
});
