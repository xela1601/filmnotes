/**
 * Spacing, radii and colours come from the theme, not from the screen that happens to need them.
 *
 * This is a guard against the state the app was actually in: `spacing` and `radius` existed and
 * were exported, and not one screen imported them - 33 bare 4s, 8s and 12s duplicated the scale
 * instead, so changing it meant finding all of them. A review found that; this keeps it found.
 *
 * It reads the sources rather than rendering, because the failure is invisible at runtime: a
 * hard-coded 12 looks exactly like `spacing.md` until the day the scale changes.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const APP = join(__dirname, "..", "..");

/** Every source file of the app, tests excluded - a test may hard-code whatever it asserts. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === "node_modules" || name === "dist" ? [] : sourceFiles(path);
    }
    const isSource = /\.tsx?$/.test(name) && !name.includes(".test.");
    // themes.ts *is* the scale, and theme.ts re-exports it.
    const isTheScaleItself = name === "themes.ts" || name === "theme.ts";
    return isSource && !isTheScaleItself ? [path] : [];
  });
}

const files = [join(APP, "src"), join(APP, "app")].flatMap(sourceFiles);

/** `gap: 12`, `paddingHorizontal: 8`, `borderRadius: 6` - a scale value written out by hand. */
const HARD_CODED = /\b(?:(?:padding|margin|gap)[A-Za-z]*|borderRadius):\s*\d+\b/g;

/** `#rrggbb`, `rgb(…)`, `rgba(…)` outside the palette. */
const HARD_CODED_COLOR = /#[0-9a-fA-F]{6}\b|\brgba?\(/g;

describe("the design tokens", () => {
  it("has the app's sources in view", () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it("are not duplicated as numbers in screens", () => {
    const offenders = files
      .map((path) => ({
        path: path.slice(APP.length + 1),
        hits: readFileSync(path, "utf8").match(HARD_CODED),
      }))
      .filter(({ hits }) => hits !== null)
      .map(({ path, hits }) => `${path}: ${hits?.join(", ") ?? ""}`);

    // Use spacing.xs/sm/md/lg/xl and radius.sm/md/full from `../ui` instead.
    expect(offenders).toEqual([]);
  });

  it("are not duplicated as colours in screens", () => {
    const offenders = files
      .map((path) => ({
        path: path.slice(APP.length + 1),
        hits: readFileSync(path, "utf8").match(HARD_CODED_COLOR),
      }))
      .filter(({ hits }) => hits !== null)
      .map(({ path, hits }) => `${path}: ${hits?.join(", ") ?? ""}`);

    // Use the palette from `useTheme()`; a literal colour cannot follow the chosen theme.
    expect(offenders).toEqual([]);
  });
});
