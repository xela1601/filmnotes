import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";

import { i18n } from "../../i18n";
import { useStore } from "../../store/store";
import { FIXTURE_NOW, makeFrame, makeRoll } from "../../testing/fixtures";
import { RollsListScreen } from "./RollsListScreen";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));

const OLDER = "roll00000000001";
const NEWER = "roll00000000002";

function twoRolls(): void {
  const { upsert } = useStore.getState();
  upsert("rolls", makeRoll({ id: OLDER, loadedAt: "2026-08-01T09:00:00.000Z" }));
  upsert("rolls", makeRoll({ id: NEWER, loadedAt: "2026-09-18T09:00:00.000Z", status: "at_lab" }));
  upsert("frames", makeFrame({ id: "frame0000000001", rollId: NEWER, frameNo: 1 }));
  upsert("frames", makeFrame({ id: "frame0000000002", rollId: NEWER, frameNo: 2 }));
}

describe("RollsListScreen", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    useStore.getState().resetAll();
    useStore.getState().seedPresets(FIXTURE_NOW);
    await i18n.changeLanguage("de");
  });

  it("explains what to do while no roll exists", () => {
    render(<RollsListScreen />);

    expect(screen.getByText(i18n.t("rolls:empty"))).toBeOnTheScreen();
    expect(screen.getByText(i18n.t("rolls:emptyHint"))).toBeOnTheScreen();
  });

  it("lists the rolls newest first with status and progress", () => {
    twoRolls();

    render(<RollsListScreen />);

    const items = screen.getAllByTestId(/^roll-item-[a-z0-9]+$/);
    expect(items.map((item) => item.props.testID)).toEqual([
      `roll-item-${NEWER}`,
      `roll-item-${OLDER}`,
    ]);
    expect(screen.getByText("Kodak Gold 200 · 2026-09-18")).toBeOnTheScreen();
    expect(screen.getByTestId(`roll-item-${NEWER}-status`)).toHaveTextContent(
      i18n.t("rolls:status.at_lab"),
    );
    expect(screen.getByText(i18n.t("rolls:progress", { shot: 2, total: 36 }))).toBeOnTheScreen();
    expect(screen.getByText(i18n.t("rolls:progress", { shot: 0, total: 36 }))).toBeOnTheScreen();
  });

  it("opens a roll", () => {
    twoRolls();

    render(<RollsListScreen />);
    fireEvent.press(screen.getByTestId(`roll-item-${OLDER}`));

    expect(router.push).toHaveBeenCalledWith(`/rolls/${OLDER}`);
  });

  it("starts a new roll from the header action", () => {
    render(<RollsListScreen />);

    fireEvent.press(screen.getByTestId("rolls-new"));

    expect(router.push).toHaveBeenCalledWith("/rolls/new");
  });

  it("hides archived rolls that were deleted", () => {
    twoRolls();
    useStore.getState().softDelete("rolls", OLDER);

    render(<RollsListScreen />);

    expect(screen.queryByTestId(`roll-item-${OLDER}`)).toBeNull();
    expect(screen.getByTestId(`roll-item-${NEWER}`)).toBeOnTheScreen();
  });
});
