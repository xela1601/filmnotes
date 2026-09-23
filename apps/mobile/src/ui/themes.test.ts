/**
 * What every theme has to satisfy, whoever adds the next one.
 *
 * The contrast check is the one that earns its keep: a palette can look right in a screenshot on
 * a desk and be unreadable on a phone held at arm's length in the sun, which is exactly where
 * this app is used. WCAG 2.1 AA is the yardstick - 4.5:1 for body text, 3:1 for the muted text
 * and for anything that only has to be noticed.
 */
import {
  DEFAULT_THEME_ID,
  isThemeId,
  paletteFor,
  resolveScheme,
  THEME_IDS,
  THEMES,
  type Palette,
} from "./themes";

const HEX = /^#[0-9a-f]{6}$/;

const COLOR_KEYS: (keyof Palette)[] = [
  "background",
  "surface",
  "border",
  "text",
  "textMuted",
  "primary",
  "onPrimary",
  "danger",
  "warning",
  "info",
];

/** WCAG relative luminance of an `#rrggbb` colour. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/** Every palette in the app: both schemes of every theme. */
const palettes = THEME_IDS.flatMap((id) => [
  { name: `${id}/light`, palette: paletteFor(id, "light") },
  { name: `${id}/dark`, palette: paletteFor(id, "dark") },
]);

describe("every theme", () => {
  it("is listed exactly once", () => {
    expect([...THEME_IDS].sort()).toEqual(Object.keys(THEMES).sort());
    expect(new Set(THEME_IDS).size).toBe(THEME_IDS.length);
  });

  it("includes the default", () => {
    expect(THEME_IDS).toContain(DEFAULT_THEME_ID);
  });

  it.each(palettes.map(({ name }) => name))("%s defines every colour as #rrggbb", (name) => {
    const { palette } = palettes.find((candidate) => candidate.name === name) ?? {};
    const wrong = COLOR_KEYS.filter((key) => !HEX.test(palette?.[key] ?? ""));
    // A typo in a hex value renders as a transparent or black surface rather than as an error.
    expect({ name, wrong }).toEqual({ name, wrong: [] });
  });

  it.each(palettes.map(({ name }) => name))("%s can be read in daylight", (name) => {
    const { palette } = palettes.find((candidate) => candidate.name === name) ?? {};
    if (palette === undefined) throw new Error(`no palette ${name}`);

    const ratios = {
      "text on background": contrast(palette.text, palette.background),
      "text on surface": contrast(palette.text, palette.surface),
      "label on primary": contrast(palette.onPrimary, palette.primary),
    };
    for (const [what, ratio] of Object.entries(ratios)) {
      expect({ name, what, aa: ratio >= 4.5 }).toEqual({ name, what, aa: true });
    }

    const softer = {
      "muted text on background": contrast(palette.textMuted, palette.background),
      "danger on background": contrast(palette.danger, palette.background),
      "warning on background": contrast(palette.warning, palette.background),
    };
    for (const [what, ratio] of Object.entries(softer)) {
      expect({ name, what, aa: ratio >= 3 }).toEqual({ name, what, aa: true });
    }

    // The border is a hairline between two surfaces, not the outline of a control, so WCAG's
    // 3:1 for user-interface components does not apply to it. It does have to be visible at all,
    // which is what a barely-there 1.2:1 would fail.
    expect({
      name,
      what: "border on background",
      visible: contrast(palette.border, palette.background) >= 1.3,
    }).toEqual({ name, what: "border on background", visible: true });
  });
});

describe("a theme that insists on one scheme", () => {
  it("ignores the device setting", () => {
    expect(resolveScheme("darkroom", "light")).toBe("dark");
    expect(resolveScheme("oled", "light")).toBe("dark");
    expect(paletteFor("darkroom", "light")).toEqual(paletteFor("darkroom", "dark"));
  });

  it("does not stop the others from following it", () => {
    expect(resolveScheme("classic", "light")).toBe("light");
    expect(resolveScheme("kodachrome", "dark")).toBe("dark");
  });
});

describe("isThemeId", () => {
  it("accepts what is there and refuses what is not", () => {
    expect(isThemeId("kodachrome")).toBe(true);
    // A value persisted by an older version whose theme has since been removed.
    expect(isThemeId("velvia")).toBe(false);
    expect(isThemeId(undefined)).toBe(false);
  });
});
