/**
 * Dry run of the screenshot tour (`tour.mjs`) in jsdom: every scene is executed and its
 * anchor checked, but nothing is painted.
 *
 * Why it exists: the pictures need a browser and this does not, so the tour stays checkable
 * wherever the tests run - in CI, on a machine without Chromium, in a sandbox without the Chrome
 * libraries. What it cannot see is anything that depends on layout: jsdom has none, which is why
 * a scene can pass here and still fail in Chromium (it found a picker whose options reached past
 * the bottom of the screen).
 *
 * Usage:
 *   npx expo export --platform web
 *   node e2e/tour-jsdom.mjs
 */
import { bootJsdomApp } from "./jsdomApp.mjs";
import { startStaticServer } from "./serve.mjs";
import { scenes } from "./tour.mjs";

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const server = await startStaticServer(root, Number(process.env.PORT ?? 8098));

process.on("unhandledRejection", (reason) => {
  console.log(`unhandledRejection: ${String(reason).slice(0, 160)}`);
});

const { window, ui, errors } = await bootJsdomApp(server.base);
const results = [];

for (const scene of scenes) {
  try {
    await scene.run(ui);
    await ui.waitFor(scene.anchor, 15_000);
    results.push(`ok   ${scene.id} – ${ui.text(scene.anchor).slice(0, 70)}`);
  } catch (error) {
    results.push(`FAIL ${scene.id} – ${error.message}`);
    process.exitCode = 1;
  }
}

console.log(results.join("\n"));
if (errors.length > 0) {
  console.log(`\npage errors (${errors.length}):\n${errors.slice(0, 5).join("\n")}`);
}
window.close();
server.close();
