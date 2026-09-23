/**
 * The domain package depends on nothing.
 *
 * That is the whole point of it: the rules about film, exposure and scans have to be testable
 * without a device and reusable from the app, the CLI and anything that comes later. The moment
 * one file reaches for `react-native`, `expo-file-system` or `node:fs`, that stops being true for
 * every consumer at once - and it happens by autocomplete, not by decision.
 *
 * So this walks the sources rather than trusting the manifest: `package.json` declaring no
 * dependencies says nothing about an import that resolves through the workspace root anyway.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = __dirname;

/** Every `from "…"` and `require("…")` specifier in a file. */
function importsOf(source: string): string[] {
  const specifiers = [
    ...source.matchAll(/(?:^|\n)\s*(?:import|export)[^'"\n]*?from\s*["']([^"']+)["']/g),
    ...source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g),
    ...source.matchAll(/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g),
    // A bare side-effect import: `import "./polyfill";`
    ...source.matchAll(/(?:^|\n)\s*import\s+["']([^"']+)["']/g),
  ];
  return specifiers.map((match) => match[1] as string);
}

// The tests themselves are excluded: they run in Node and are allowed to read files, and they
// are not part of what a consumer imports. `fixtures.ts` is not excluded - it ships as
// `@filmnotes/domain/testing`.
const sourceFiles = readdirSync(SRC)
  .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
  .map((name) => ({ name, code: readFileSync(join(SRC, name), "utf8") }));

describe("@filmnotes/domain", () => {
  it("has sources to check", () => {
    expect(sourceFiles.length).toBeGreaterThan(10);
  });

  it.each(sourceFiles.map(({ name }) => name))("%s imports nothing outside the package", (name) => {
    const file = sourceFiles.find((candidate) => candidate.name === name);
    const foreign = importsOf(file?.code ?? "").filter(
      (specifier) => !specifier.startsWith("./") && !specifier.startsWith("../"),
    );

    // Named rather than a bare `toEqual([])`, so a failure says which import in which file.
    expect({ file: name, foreign }).toEqual({ file: name, foreign: [] });
  });
});
