import { useColorScheme } from "react-native";

/** 4/8/12/16/24 spacing scale. */
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

/** 14/16/20/28 type scale. */
export const fontSize = { sm: 14, md: 16, lg: 20, xl: 28 } as const;

export const radius = { sm: 6, md: 10 } as const;

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

/** Minimalist, high contrast – the app is used outdoors. */
export const lightPalette: Palette = {
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
};

export const darkPalette: Palette = {
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
};

export type ColorScheme = "light" | "dark";

export interface Theme {
  scheme: ColorScheme;
  palette: Palette;
  spacing: typeof spacing;
  fontSize: typeof fontSize;
  radius: typeof radius;
}

/** Light/dark palette following the system setting. */
export function useTheme(): Theme {
  const scheme: ColorScheme = useColorScheme() === "dark" ? "dark" : "light";
  return {
    scheme,
    palette: scheme === "dark" ? darkPalette : lightPalette,
    spacing,
    fontSize,
    radius,
  };
}
