import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";

import { i18n } from "../../i18n";
import { useStore } from "../../store/store";
import { FIXTURE_NOW } from "../../testing/fixtures";
import { RollForm } from "./RollFormScreen";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));

const KODAK_GOLD_200 = "film0kodakgold2";
const MINOLTA_7000 = "cam0minolta7000";

/** Opens the film stock picker and takes the given stock. */
function pickFilmStock(id: string): void {
  fireEvent.press(screen.getByTestId("roll-form-film-stock-open"));
  fireEvent.press(screen.getByTestId(`roll-form-film-stock-option-${id}`));
}

describe("RollForm", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    useStore.getState().resetAll();
    useStore.getState().seedPresets(FIXTURE_NOW);
    await i18n.changeLanguage("de");
  });

  it("starts with the seeded camera and no film", () => {
    render(<RollForm mode="create" />);

    expect(
      screen.getByTestId(`roll-form-camera-option-${MINOLTA_7000}`).props.accessibilityState,
    ).toEqual(expect.objectContaining({ selected: true }));
    expect(screen.getByTestId("roll-form-film-stock-open")).toHaveTextContent("–");
  });

  it("fills the ISO from the chosen film stock", () => {
    render(<RollForm mode="create" />);

    pickFilmStock(KODAK_GOLD_200);

    expect(screen.getByDisplayValue("200")).toBeOnTheScreen();
    expect(screen.getByTestId("roll-form-film-stock-open")).toHaveTextContent(
      "Kodak Gold 200 · ISO 200",
    );
  });

  it("refuses to save without a film stock", () => {
    render(<RollForm mode="create" />);

    fireEvent.press(screen.getByTestId("roll-form-save"));

    expect(screen.getByTestId("roll-form-error-filmStockId")).toHaveTextContent(
      i18n.t("rolls:errors.required"),
    );
    expect(Object.keys(useStore.getState().entities.rolls)).toHaveLength(0);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("stores the roll and opens its detail screen", () => {
    render(<RollForm mode="create" />);

    pickFilmStock(KODAK_GOLD_200);
    fireEvent.changeText(screen.getByTestId("roll-form-lab"), "Foto Meyer");
    fireEvent.press(screen.getByTestId("roll-form-save"));

    const rolls = Object.values(useStore.getState().entities.rolls);
    expect(rolls).toHaveLength(1);
    const roll = rolls[0];
    expect(roll).toMatchObject({
      cameraId: MINOLTA_7000,
      filmStockId: KODAK_GOLD_200,
      isoSet: 200,
      isoSource: "DX",
      exposures: 36,
      status: "loaded",
      lab: "Foto Meyer",
    });
    expect(router.replace).toHaveBeenCalledWith(`/rolls/${roll?.id ?? ""}`);
  });

  it("only offers black and white stocks once that film type is chosen", () => {
    render(<RollForm mode="create" />);

    fireEvent.press(screen.getByTestId("roll-form-film-type-option-bw"));
    fireEvent.press(screen.getByTestId("roll-form-film-stock-open"));

    expect(screen.getByTestId("roll-form-film-stock-option-film0ilfordhp5p")).toBeOnTheScreen();
    expect(screen.queryByTestId(`roll-form-film-stock-option-${KODAK_GOLD_200}`)).toBeNull();
  });

  it("flags an ISO outside the supported range", () => {
    render(<RollForm mode="create" />);

    pickFilmStock(KODAK_GOLD_200);
    fireEvent.changeText(screen.getByTestId("roll-form-iso"), "20000");
    fireEvent.press(screen.getByTestId("roll-form-save"));

    expect(screen.getByTestId("roll-form-error-isoSet")).toHaveTextContent(
      i18n.t("rolls:errors.iso_range"),
    );
    expect(Object.keys(useStore.getState().entities.rolls)).toHaveLength(0);
  });

  it("edits an existing roll without creating a second one", () => {
    render(<RollForm mode="create" />);
    pickFilmStock(KODAK_GOLD_200);
    fireEvent.press(screen.getByTestId("roll-form-save"));
    const created = Object.values(useStore.getState().entities.rolls)[0];
    screen.unmount();

    render(<RollForm mode="edit" rollId={created?.id} />);

    expect(screen.getByTestId("roll-form-film-stock-open")).toHaveTextContent(
      "Kodak Gold 200 · ISO 200",
    );
    fireEvent.changeText(screen.getByTestId("roll-form-notes"), "second half pushed");
    fireEvent.press(screen.getByTestId("roll-form-save"));

    const rolls = Object.values(useStore.getState().entities.rolls);
    expect(rolls).toHaveLength(1);
    expect(rolls[0]).toMatchObject({ id: created?.id, notes: "second half pushed" });
  });

  it("shows a hint when the roll to edit is gone", () => {
    render(<RollForm mode="edit" rollId="roll00000000404" />);

    expect(screen.getByText(i18n.t("rolls:notFound"))).toBeOnTheScreen();
  });
});
