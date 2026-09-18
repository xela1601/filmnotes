/**
 * Test for the settings route.
 *
 * It lives in `tests/` rather than next to the route: expo-router turns *every*
 * file under `app/` into a route, so `app/(tabs)/settings.test.tsx` would show up
 * as a `/settings.test` screen and be bundled into the app.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

import SettingsScreen from "../app/(tabs)/settings";
import { i18n } from "../src/i18n";
import { useStore } from "../src/store/store";
import { makeRoll } from "../src/testing/fixtures";

describe("settings screen", () => {
  beforeEach(async () => {
    useStore.getState().resetAll();
    await i18n.changeLanguage("de");
  });

  it("shows the language picker, the links and the app version", () => {
    render(<SettingsScreen />);

    expect(screen.getByText(i18n.t("settings.language"))).toBeOnTheScreen();
    expect(screen.getByTestId("settings-server")).toBeOnTheScreen();
    expect(screen.getByTestId("settings-wordpress")).toBeOnTheScreen();
    expect(screen.getByTestId("settings-version")).toBeOnTheScreen();
  });

  it("persists the chosen language and switches i18next", async () => {
    render(<SettingsScreen />);

    fireEvent.press(screen.getByTestId("settings-language-option-en"));

    expect(useStore.getState().settings.locale).toBe("en");
    await waitFor(() => {
      expect(i18n.language).toBe("en");
    });
  });

  it("resets the local data after confirmation", () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    useStore.getState().upsert("rolls", makeRoll());
    expect(Object.keys(useStore.getState().entities.rolls)).toHaveLength(1);

    render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId("settings-reset"));

    const buttons = alert.mock.calls[0]?.[2];
    const confirm = buttons?.find((button) => button.style === "destructive");
    expect(confirm).toBeDefined();
    confirm?.onPress?.();

    expect(useStore.getState().entities.rolls).toEqual({});
    alert.mockRestore();
  });
});
