/**
 * Walks the core scenario of the design spec (§2.1, steps 1-4) through the *exported*
 * web bundle: create a roll from a film preset, add the first frame, check the camera
 * defaults and see a plausibility warning appear.
 *
 * Why not only the jest suites: those render single components. This runs the bundle
 * `npx expo export` produces – metro output, the expo-router entry, store hydration,
 * i18n and the presets, all at once. It is what caught the persist merge that left the
 * app on its hydration gate on a first launch.
 *
 * Usage:
 *   npx expo export --platform web        # writes dist/
 *   node e2e/web-walkthrough.mjs          # serves dist/ and drives it
 *
 * The jsdom bootstrap and the driver live in `jsdomApp.mjs`; `tour-jsdom.mjs` uses the same
 * two for the screenshot tour.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { bootJsdomApp } from "./jsdomApp.mjs";
import { startStaticServer } from "./serve.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const server = await startStaticServer(root, Number(process.env.PORT ?? 8099));

const results = [];
process.on("unhandledRejection", (reason) =>
  results.push(`     unhandledRejection: ${String(reason).slice(0, 160)}`),
);

const { window, ui, errors } = await bootJsdomApp(server.base);
const { press, waitFor, text: textOf, has, sleep } = ui;

function check(label, passed, detail = "") {
  results.push(`${passed ? "ok  " : "FAIL"} ${label}${detail ? ` – ${detail}` : ""}`);
  if (!passed) process.exitCode = 1;
}

try {
  // Step 1: the app opens on the roll list.
  await waitFor("rolls-screen");
  check("bundle boots and renders the roll list", true, textOf("rolls-screen").slice(0, 60));
  check("empty state shown", has("rolls-empty"));

  // Step 2: create a roll from the Kodak Gold 200 preset.
  await press("rolls-new");
  await waitFor("roll-form");
  await press("roll-form-film-stock-open");
  await press("roll-form-film-stock-option-film0kodakgold2");
  check(
    "film stock sets ISO 200",
    /\b200\b/.test(textOf("roll-form")),
    textOf("roll-form").slice(0, 80),
  );
  check("exposures default to 36", textOf("roll-form-exposures").includes("36"));
  await press("roll-form-save");

  // Step 3: the roll detail shows the film and the camera; add the first frame.
  await waitFor("roll-detail");
  check(
    "roll detail shows the film",
    textOf("roll-detail-title").includes("Kodak Gold 200"),
    textOf("roll-detail-title"),
  );
  check(
    "camera from the preset",
    textOf("roll-detail-camera").includes("7000"),
    textOf("roll-detail-camera"),
  );
  check(
    "ISO stored on the roll",
    textOf("roll-detail-iso").includes("200"),
    textOf("roll-detail-iso"),
  );
  await press("roll-detail-add-frame");

  // Step 4: camera defaults, then a plausibility warning.
  await waitFor("frame-edit");
  check("frame defaults to program mode", textOf("frame-mode").includes("P"), textOf("frame-mode"));
  // The editor is collapsed to the exposure; the lens the preset mounted is behind the details.
  await press("frame-details-toggle");
  await waitFor("frame-details");
  check("lens preset offered", /35\s*-\s*70/.test(textOf("frame-lens")));
  await press("frame-mode-option-M");
  await press("frame-shutter-open");
  await press("frame-shutter-option-1/15");
  await sleep(300);
  // The wording follows the UI language, which follows the system locale of the host.
  check(
    "shake warning for 1/15 hand-held",
    /(verwackl|shake risk)/i.test(textOf("frame-issues")),
    textOf("frame-issues").slice(0, 120),
  );

  await press("frame-save");
  await waitFor("roll-detail");
  check(
    "roll progress counts the frame",
    /1\s*\/\s*36/.test(textOf("roll-detail-progress")),
    textOf("roll-detail-progress"),
  );
} catch (error) {
  check(`walkthrough aborted: ${error.message}`, false);
} finally {
  console.log(results.join("\n"));
  if (errors.length > 0)
    console.log(`\npage errors (${errors.length}):\n${errors.slice(0, 5).join("\n")}`);
  window.close();
  server.close();
}
