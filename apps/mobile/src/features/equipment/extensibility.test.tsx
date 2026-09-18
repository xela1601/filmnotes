/**
 * The point of this feature: equipment the user creates here is ordinary user data, so
 * the other screens pick it up without a code change (ticket T-012, "Done when").
 *
 * These tests therefore drive the equipment editor and then render the screens of the
 * neighbouring features: the roll form (T-006) must offer a camera created here, and the
 * frame editor (T-007) must offer a lens created here.
 */
import type { Camera, Frame, Lens, Roll } from "@filmnotes/domain";
import { newFrame } from "@filmnotes/domain";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { useLocalSearchParams } from "expo-router";

import { FrameEditScreen } from "../frames/FrameEditScreen";
import { RollForm } from "../rolls/RollFormScreen";
import { i18n } from "../../i18n";
import { useStore } from "../../store/store";
import { FIXTURE_NOW, makeRoll } from "../../testing/fixtures";
import { EquipmentEditScreen } from "./EquipmentEditScreen";

jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

const KODAK_GOLD = "film0kodakgold2";

/** Creates a record through the equipment editor, exactly as the user would. */
function createThroughEditor(
  type: "cameras" | "lenses",
  fields: { key: string; value: string }[],
): void {
  const editor = render(<EquipmentEditScreen type={type} id={null} />);
  for (const field of fields) {
    fireEvent.changeText(screen.getByTestId(`equipment-field-${field.key}`), field.value);
  }
  fireEvent.press(screen.getByTestId("equipment-save"));
  editor.unmount();
}

function cameraNamed(model: string): Camera {
  const camera = Object.values(useStore.getState().entities.cameras).find(
    (candidate) => candidate.model === model,
  );
  if (camera === undefined) throw new Error(`camera ${model} was not created`);
  return camera;
}

function lensNamed(model: string): Lens {
  const lens = Object.values(useStore.getState().entities.lenses).find(
    (candidate) => candidate.model === model,
  );
  if (lens === undefined) throw new Error(`lens ${model} was not created`);
  return lens;
}

const rolls = (): Roll[] => Object.values(useStore.getState().entities.rolls);

describe("equipment created in the app", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    useStore.getState().resetAll();
    useStore.getState().seedPresets(FIXTURE_NOW);
    await i18n.changeLanguage("de");
  });

  it("can be loaded with film in the roll form (T-006)", () => {
    createThroughEditor("cameras", [
      { key: "make", value: "Nikon" },
      { key: "model", value: "FM2" },
    ]);
    const camera = cameraNamed("FM2");

    render(<RollForm mode="create" />);

    // The camera is offered without the roll feature knowing anything about it.
    const option = screen.getByTestId(`roll-form-camera-option-${camera.id}`);
    expect(option).toBeOnTheScreen();

    fireEvent.press(option);
    fireEvent.press(screen.getByTestId("roll-form-film-stock-open"));
    fireEvent.press(screen.getByTestId(`roll-form-film-stock-option-${KODAK_GOLD}`));
    fireEvent.press(screen.getByTestId("roll-form-save"));

    expect(rolls()).toHaveLength(1);
    expect(rolls()[0]).toMatchObject({ cameraId: camera.id, filmStockId: KODAK_GOLD, isoSet: 200 });
  });

  it("can be put in front of the camera in the frame editor (T-007)", () => {
    createThroughEditor("lenses", [
      { key: "make", value: "Voigtländer" },
      { key: "model", value: "Ultron 40mm f/2" },
      { key: "focalMinMm", value: "40" },
      { key: "focalMaxMm", value: "40" },
      { key: "maxAperture", value: "2" },
    ]);
    const lens = lensNamed("Ultron 40mm f/2");

    const roll = makeRoll();
    useStore.getState().applyRemote("rolls", [roll]);
    const camera = useStore.getState().entities.cameras["cam0minolta7000"] as Camera;
    const frame: Frame = newFrame({
      rollId: roll.id,
      frameNo: 1,
      camera,
      previous: null,
      now: FIXTURE_NOW,
    });
    useStore.getState().applyRemote("frames", [frame]);
    (useLocalSearchParams as jest.Mock).mockReturnValue({ frameId: frame.id });

    render(<FrameEditScreen />);

    // The new lens is selectable, and its focal length follows from the record alone.
    fireEvent.press(screen.getByTestId(`frame-lens-option-${lens.id}`));
    fireEvent.press(screen.getByTestId("frame-focal-length-option-40"));
    fireEvent.press(screen.getByTestId("frame-save"));

    const stored = useStore.getState().entities.frames[frame.id];
    expect(stored).toMatchObject({ lensId: lens.id, focalLengthMm: 40 });
  });

  it("keeps the record shape the other features read", () => {
    createThroughEditor("cameras", [
      { key: "make", value: "Canon" },
      { key: "model", value: "AE-1" },
    ]);
    const camera = cameraNamed("AE-1");

    // `newFrame` (T-002) reads the camera's frame defaults, the frame editor its ranges.
    const frame = newFrame({
      rollId: "roll00000000001",
      frameNo: 1,
      camera,
      previous: null,
      now: FIXTURE_NOW,
    });

    expect(frame.exposureCompensationEv).toBe(0);
    expect(frame.filterIds).toEqual([]);
    expect(camera.exposureCompensation).toEqual({ min: -3, max: 3, step: 0.5, notInModes: [] });
    expect(camera.iso.dxAuto).toBe(true);
    expect(camera.deleted).toBeNull();
    expect(camera.owner).toBeNull();
    expect(camera.id).toMatch(/^[a-z0-9]{15}$/);
  });
});
