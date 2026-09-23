/**
 * The themes the app can be switched to, and the design tokens they all share.
 *
 * Only colours change between themes. Spacing, radii and the type scale stay fixed, because a
 * theme that also moved the layout around would mean every screen has to be checked eight times
 * over - and because the point of the scale is that it is the same everywhere.
 *
 * Every theme defines a light *and* a dark palette. A theme whose whole idea is darkness (the
 * darkroom) simply declares the same palette twice and pins the scheme, so "follow the system"
 * cannot produce a white safelight.
 *
 * Contrast: the text colours are chosen against their own background, not by eye - this app is
 * read outdoors, in the sun, one-handed, while a roll is waiting.
 */

/** 4/8/12/16/24. Every gap, padding and margin in the app is one of these. */
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

/** 14/16/20/28. */
export const fontSize = { sm: 14, md: 16, lg: 20, xl: 28 } as const;

/**
 * The three weights the app uses. React Native wants them as strings, and naming them keeps the
 * meaning ("this is a heading") rather than the number, which is what a designer changes.
 */
export const fontWeight = { medium: "500", semibold: "600", bold: "700" } as const;

/** Letter spacing. `wide` is the small, upper-cased section heading. */
export const letterSpacing = { normal: 0, wide: 0.5 } as const;

/** 6/10, plus `full` for anything that should read as a pill. */
export const radius = { sm: 6, md: 10, full: 999 } as const;

export type ColorScheme = "light" | "dark";

export interface Palette {
  background: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  danger: string;
  warning: string;
  info: string;
}

export interface ThemeDefinition {
  /** Same as the key in `THEMES`; `ThemeId` is derived from those keys, so this stays a string. */
  id: string;
  /** i18n key in the common namespace, `settings.themes.<id>`. */
  nameKey: string;
  light: Palette;
  dark: Palette;
  /**
   * A theme that exists only in one scheme. "Follow the system" then does not apply to it -
   * see `resolveScheme`.
   */
  fixedScheme?: ColorScheme;
}

/* ------------------------------------------------------------------ the five with a past */

/** Kodachrome: warm reds on cream, the slide film everyone remembers as "the colours". */
const kodachrome: Pick<ThemeDefinition, "light" | "dark"> = {
  light: {
    background: "#faf6ef",
    surface: "#f0e7d8",
    border: "#cbb99b",
    text: "#2b1d12",
    textMuted: "#6b543c",
    primary: "#b23a20",
    onPrimary: "#fdf8f1",
    danger: "#8f1d12",
    warning: "#a35b00",
    info: "#7a5c1e",
  },
  dark: {
    background: "#17110c",
    surface: "#241a12",
    border: "#4a382a",
    text: "#f3e7d6",
    textMuted: "#b69a79",
    primary: "#e4693f",
    onPrimary: "#17110c",
    danger: "#ff9078",
    warning: "#e0a455",
    info: "#d8b878",
  },
};

/** Ilford HP5: no colour at all, only silver. The one that looks like the negative. */
const silver: Pick<ThemeDefinition, "light" | "dark"> = {
  light: {
    background: "#f6f6f5",
    surface: "#e6e6e4",
    border: "#b6b6b3",
    text: "#141414",
    textMuted: "#565654",
    primary: "#2b2b2b",
    onPrimary: "#f6f6f5",
    danger: "#7a1f1f",
    warning: "#6b5200",
    info: "#3d3d3d",
  },
  dark: {
    background: "#0e0e0e",
    surface: "#1c1c1c",
    border: "#3d3d3d",
    text: "#ededec",
    textMuted: "#9d9d9b",
    primary: "#dcdcda",
    onPrimary: "#0e0e0e",
    danger: "#ff9b9b",
    warning: "#e3c05a",
    info: "#c4c4c2",
  },
};

/** Agfa: the cooler, greener European colour palette, a little faded. */
const agfa: Pick<ThemeDefinition, "light" | "dark"> = {
  light: {
    background: "#f3f6f2",
    surface: "#e2eae0",
    border: "#a8bda6",
    text: "#14211a",
    textMuted: "#4c6055",
    primary: "#1f6b4f",
    onPrimary: "#f3f6f2",
    danger: "#96311f",
    warning: "#8a6000",
    info: "#2c6172",
  },
  dark: {
    background: "#0b1310",
    surface: "#14201a",
    border: "#31463b",
    text: "#e4efe7",
    textMuted: "#8fa89a",
    primary: "#4fbc8d",
    onPrimary: "#0b1310",
    danger: "#ff9a8a",
    warning: "#dfae51",
    info: "#66b7cd",
  },
};

/** Polaroid: the pale frame, soft pastels, nothing harsh. */
const polaroid: Pick<ThemeDefinition, "light" | "dark"> = {
  light: {
    background: "#fbfaf7",
    surface: "#ffffff",
    border: "#ddd9d0",
    text: "#26251f",
    textMuted: "#6f6c62",
    primary: "#376f92",
    onPrimary: "#ffffff",
    danger: "#b0473f",
    warning: "#9a6a12",
    info: "#376f92",
  },
  dark: {
    background: "#16161a",
    surface: "#212128",
    border: "#3e3e48",
    text: "#f1f0ec",
    textMuted: "#a4a3ab",
    primary: "#7fb6d6",
    onPrimary: "#16161a",
    danger: "#ff9c93",
    warning: "#e6b45c",
    info: "#7fb6d6",
  },
};

/** Darkroom: safelight red on near-black. Dark only - a white darkroom is a ruined roll. */
const darkroomPalette: Palette = {
  background: "#0a0304",
  surface: "#160709",
  border: "#571c22",
  text: "#f0cdd0",
  textMuted: "#a8767c",
  primary: "#e23b45",
  onPrimary: "#0a0304",
  danger: "#ff7b72",
  warning: "#d89a3f",
  info: "#c76a72",
};

/* ------------------------------------------------------------------ the three without one */

/** The palette the app shipped with: neutral, high contrast, no personality on purpose. */
const classic: Pick<ThemeDefinition, "light" | "dark"> = {
  light: {
    background: "#ffffff",
    surface: "#f2f2f5",
    border: "#c9c9cf",
    text: "#101014",
    textMuted: "#5a5a63",
    primary: "#1d4ed8",
    onPrimary: "#ffffff",
    danger: "#b3261e",
    warning: "#8a5300",
    info: "#1d4ed8",
  },
  dark: {
    background: "#0c0c0f",
    surface: "#1b1b20",
    border: "#3a3a42",
    text: "#f5f5f7",
    textMuted: "#a5a5ae",
    primary: "#7aa2ff",
    onPrimary: "#0c0c0f",
    danger: "#ff8a80",
    warning: "#f0b429",
    info: "#7aa2ff",
  },
};

/** Maximum legibility: pure black on pure white, for bright sun and for tired eyes. */
const contrast: Pick<ThemeDefinition, "light" | "dark"> = {
  light: {
    background: "#ffffff",
    surface: "#ffffff",
    border: "#000000",
    text: "#000000",
    textMuted: "#000000",
    primary: "#00007a",
    onPrimary: "#ffffff",
    danger: "#8a0000",
    warning: "#4d3500",
    info: "#00007a",
  },
  dark: {
    background: "#000000",
    surface: "#000000",
    border: "#ffffff",
    text: "#ffffff",
    textMuted: "#ffffff",
    primary: "#a8c7ff",
    onPrimary: "#000000",
    danger: "#ffb3ad",
    warning: "#ffd479",
    info: "#a8c7ff",
  },
};

/** True black, so an OLED screen switches the pixels off. Dark only, or it is pointless. */
const oledPalette: Palette = {
  background: "#000000",
  surface: "#0b0b0d",
  border: "#26262b",
  text: "#e9e9ec",
  textMuted: "#8e8e97",
  primary: "#8ab4ff",
  onPrimary: "#000000",
  danger: "#ff8a80",
  warning: "#f0b429",
  info: "#8ab4ff",
};

/**
 * Every theme, in the order the settings screen offers them: the neutral one first, then the
 * five that look like film, then the two utilities.
 */
export const THEME_IDS = [
  "classic",
  "kodachrome",
  "silver",
  "agfa",
  "polaroid",
  "darkroom",
  "contrast",
  "oled",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  classic: { id: "classic", nameKey: "settings.themes.classic", ...classic },
  kodachrome: { id: "kodachrome", nameKey: "settings.themes.kodachrome", ...kodachrome },
  silver: { id: "silver", nameKey: "settings.themes.silver", ...silver },
  agfa: { id: "agfa", nameKey: "settings.themes.agfa", ...agfa },
  polaroid: { id: "polaroid", nameKey: "settings.themes.polaroid", ...polaroid },
  darkroom: {
    id: "darkroom",
    nameKey: "settings.themes.darkroom",
    light: darkroomPalette,
    dark: darkroomPalette,
    fixedScheme: "dark",
  },
  contrast: { id: "contrast", nameKey: "settings.themes.contrast", ...contrast },
  oled: {
    id: "oled",
    nameKey: "settings.themes.oled",
    light: oledPalette,
    dark: oledPalette,
    fixedScheme: "dark",
  },
};

/** The one a fresh install starts with. */
export const DEFAULT_THEME_ID: ThemeId = "classic";

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && value in THEMES;
}

/** The scheme a theme actually renders in: its own, if it insists, otherwise the device's. */
export function resolveScheme(themeId: ThemeId, deviceScheme: ColorScheme): ColorScheme {
  return THEMES[themeId].fixedScheme ?? deviceScheme;
}

export function paletteFor(themeId: ThemeId, deviceScheme: ColorScheme): Palette {
  const theme = THEMES[themeId];
  return resolveScheme(themeId, deviceScheme) === "dark" ? theme.dark : theme.light;
}
