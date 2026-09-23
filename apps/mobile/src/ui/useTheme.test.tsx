/**
 * The hook that decides what a screen looks like.
 *
 * Everything visual goes through it, so the two failures that matter are: it ignores the user's
 * choice, or it chokes on a stored value it no longer knows (an older version's theme, a hand-
 * edited store) and leaves the app without colours at all.
 */
import { renderHook } from "@testing-library/react-native";

import { useTheme } from "./theme";
import { THEMES } from "./themes";
import { useStore } from "../store/store";

describe("useTheme", () => {
  beforeEach(() => {
    useStore.getState().resetAll();
  });

  it("starts on the default", () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.id).toBe("classic");
    expect(result.current.palette).toEqual(THEMES.classic.light);
  });

  it("follows the chosen theme", () => {
    useStore.getState().updateSettings({ themeId: "kodachrome" });

    const { result } = renderHook(() => useTheme());

    expect(result.current.id).toBe("kodachrome");
    expect(result.current.palette).toEqual(THEMES.kodachrome.light);
  });

  it("renders a dark-only theme dark, whatever the device says", () => {
    useStore.getState().updateSettings({ themeId: "darkroom" });

    const { result } = renderHook(() => useTheme());

    expect(result.current.scheme).toBe("dark");
    expect(result.current.palette.background).toBe(THEMES.darkroom.dark.background);
  });

  it("falls back instead of rendering nothing when the stored theme is gone", () => {
    // A value written by a version that shipped a theme this one does not have.
    useStore.getState().updateSettings({ themeId: "velvia" as never });

    const { result } = renderHook(() => useTheme());

    expect(result.current.id).toBe("classic");
    expect(result.current.palette.background).toBe(THEMES.classic.light.background);
  });

  it("hands out the same scale to every theme", () => {
    useStore.getState().updateSettings({ themeId: "oled" });

    const { result } = renderHook(() => useTheme());

    expect(result.current.spacing.md).toBe(12);
    expect(result.current.radius.sm).toBe(6);
    expect(result.current.fontSize.lg).toBe(20);
  });
});
