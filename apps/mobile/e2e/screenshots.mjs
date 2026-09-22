/**
 * Takes the screenshots of the guided tour (`tour.mjs`) from the exported web bundle, in a
 * real Chromium, in German, in both colour schemes - and writes an index next to them.
 *
 * Usage (from apps/mobile):
 *   npx playwright install chromium          # once: downloads the browser (~150 MB)
 *   npx expo export --platform web
 *   node e2e/screenshots.mjs                 # -> docs/screenshots/{light,dark}/*.png
 *
 * Options: --out <dir>  --scheme light|dark|both  --locale de-DE  --width 414  --height 896
 *
 * Runs anywhere Chromium runs, the development sandbox included - it needs the browser (see
 * sandbox/README.md for the two prerequisites) and nothing else. `node e2e/tour-jsdom.mjs` walks
 * the very same scenes without a browser and is the check that works without any of that.
 */
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

import { startStaticServer } from "./serve.mjs";
import { scenes } from "./tour.mjs";

const here = dirname(fileURLToPath(import.meta.url));

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

const outRoot = resolve(here, option("out", join("..", "..", "..", "docs", "screenshots")));
const scheme = option("scheme", "both");
const locale = option("locale", "de-DE");
const viewport = { width: Number(option("width", 414)), height: Number(option("height", 896)) };
const schemes = scheme === "both" ? ["light", "dark"] : [scheme];

// Fontconfig wants a writable cache and prints an error per glyph run without one; $HOME is
// read-only in the development sandbox.
process.env.XDG_CACHE_HOME ??= join(tmpdir(), "filmnotes-browser-cache");
await mkdir(process.env.XDG_CACHE_HOME, { recursive: true });

const server = await startStaticServer(join(here, "..", "dist"), Number(process.env.PORT ?? 8097));
const browser = await chromium.launch();
const results = [];

/** The tour driver, on a Playwright page. Mirrors the jsdom driver in `jsdomApp.mjs`. */
function driverFor(page, shotDir) {
  const ui = {
    async waitFor(testId, timeout = 30_000) {
      await page.getByTestId(testId).first().waitFor({ state: "attached", timeout });
    },
    async press(testId) {
      const element = page.getByTestId(testId).first();
      await element.waitFor({ state: "attached" });
      // A long option list (the camera's shutter speeds) reaches past the bottom of a phone
      // screen; in jsdom, which has no layout, that can never come up.
      await element.scrollIntoViewIfNeeded().catch(() => undefined);
      // `force`: react-native-web puts the press handler on a div that Playwright does not
      // always consider stable, and there is nothing to hit-test against in a tour.
      await element.click({ force: true });
      await page.waitForTimeout(150);
    },
    async back() {
      await page.goBack();
      await page.waitForTimeout(300);
    },
    has: async (testId) => (await page.getByTestId(testId).count()) > 0,
    text: async (testId) => (await page.getByTestId(testId).first().innerText()).trim(),
    /**
     * One picture of the current screen, with `anchor` in view.
     *
     * The scroll happens here rather than in the scene: a phone screen scrolls, the point of a
     * scene is often at the bottom of it (the warning list), and `fullPage` is no help - a
     * react-native-web app scrolls *inside* a div, so the document itself is exactly one
     * viewport tall.
     */
    async shot(name, anchor) {
      if (anchor !== undefined) {
        await page
          .getByTestId(anchor)
          .first()
          .scrollIntoViewIfNeeded()
          .catch(() => undefined);
        await page.waitForTimeout(250);
      }
      await page.screenshot({ path: join(shotDir, `${name}.png`) });
    },
    sleep: (ms) => page.waitForTimeout(ms),
  };
  return ui;
}

try {
  for (const colorScheme of schemes) {
    const shotDir = join(outRoot, colorScheme);
    await mkdir(shotDir, { recursive: true });
    // Only this script's own pictures, never the directory: something else may live in it.
    for (const entry of await readdir(shotDir)) {
      if (entry.endsWith(".png")) await rm(join(shotDir, entry), { force: true });
    }

    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 2,
      locale,
      colorScheme,
      // A tour must not be able to reuse the previous run's rolls.
      storageState: undefined,
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(`${server.base}/`);

    const ui = driverFor(page, shotDir);
    await ui.waitFor("rolls-screen");

    for (const scene of scenes) {
      try {
        await scene.run(ui);
        await ui.waitFor(scene.anchor, 15_000);
        // Settles the navigation animation and any late re-render.
        await ui.sleep(400);
        await ui.shot(scene.id, scene.anchor);
        results.push(`ok   ${colorScheme}/${scene.id}.png`);
      } catch (error) {
        results.push(`FAIL ${colorScheme}/${scene.id} – ${error.message.split("\n")[0]}`);
        process.exitCode = 1;
      }
    }

    if (pageErrors.length > 0) {
      results.push(`     page errors: ${pageErrors.slice(0, 3).join(" | ")}`);
    }
    await context.close();
  }

  const index = [
    "# Screenshots",
    "",
    `Generated by \`node e2e/screenshots.mjs\` from the exported web bundle, ${locale}, ` +
      `${viewport.width}×${viewport.height}@2x. Regenerate after a UI change; do not edit by hand.`,
    "",
    ...scenes.flatMap((scene) => [
      `## ${scene.title}`,
      "",
      scene.caption,
      "",
      ...schemes.map((name) => `![${scene.title} (${name})](${name}/${scene.id}.png)`),
      "",
    ]),
  ].join("\n");
  await writeFile(join(outRoot, "README.md"), `${index}\n`);
} finally {
  console.log(results.join("\n"));
  await browser.close();
  server.close();
}
