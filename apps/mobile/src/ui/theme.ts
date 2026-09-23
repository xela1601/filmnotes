/**
 * The theme a screen renders with.
 *
 * One hook, one source: the palette comes from the theme the user picked (persisted in the
 * store) combined with the device's light/dark setting, and the scale tokens are the same for
 * every theme. Screens read `spacing.md` and `palette.border` from here instead of writing `12`
 * and a hex value into their own `StyleSheet` - which is what they used to do, in 33 places, so
 * changing the look meant finding all of them.
 */
import { useColorScheme } from "react-native";

import { useStore } from "../store/store";
import {
  DEFAULT_THEME_ID,
  fontSize,
  fontWeight,
  isThemeId,
  letterSpacing,
  paletteFor,
  radius,
  resolveScheme,
  spacing,
  THEMES,
  type ColorScheme,
  type Palette,
  type ThemeId,
} from "./themes";

export {
  DEFAULT_THEME_ID,
  fontSize,
  fontWeight,
  isThemeId,
  letterSpacing,
  paletteFor,
  radius,
  resolveScheme,
  spacing,
  THEME_IDS,
  THEMES,
  type ColorScheme,
  type Palette,
  type ThemeDefinition,
  type ThemeId,
} from "./themes";

export interface Theme {
  /** The theme the user picked. */
  id: ThemeId;
  /** The scheme actually rendered, which a fixed-scheme theme decides for itself. */
  scheme: ColorScheme;
  palette: Palette;
  spacing: typeof spacing;
  fontSize: typeof fontSize;
  fontWeight: typeof fontWeight;
  letterSpacing: typeof letterSpacing;
  radius: typeof radius;
}

/** The device setting, normalised - React Native returns null before it knows. */
function useDeviceScheme(): ColorScheme {
  return useColorScheme() === "dark" ? "dark" : "light";
}

export function useTheme(): Theme {
  const deviceScheme = useDeviceScheme();
  const stored = useStore((state) => state.settings.themeId);
  // A theme that was removed from the app (or an old persisted value) must not blank the screen.
  const id = isThemeId(stored) ? stored : DEFAULT_THEME_ID;

  return {
    id,
    scheme: resolveScheme(id, deviceScheme),
    palette: paletteFor(id, deviceScheme),
    spacing,
    fontSize,
    fontWeight,
    letterSpacing,
    radius,
  };
}

/** The palettes of the built-in light/dark theme, kept for anything that needs them directly. */
export const lightPalette: Palette = THEMES[DEFAULT_THEME_ID].light;
export const darkPalette: Palette = THEMES[DEFAULT_THEME_ID].dark;
