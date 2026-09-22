/**
 * The guided tour through the app: the routine a roll goes through, plus the edge cases
 * that are worth seeing rather than reading about.
 *
 * The scenes are written against the driver interface implemented twice:
 *   - `jsdomApp.mjs`      – no rendering, used by `tour-jsdom.mjs` to prove the steps work
 *   - `screenshots.mjs`   – Playwright/Chromium, takes the actual pictures
 *
 * They run as one sequence and share state: scene n starts where scene n-1 left off. Each
 * scene ends on the screen named by `anchor`; the runner waits for it and then shoots.
 *
 * The UI language follows the browser locale (`de-DE` when the runner sets it), which is why
 * the captions here are English and the pictures are German - and why every step addresses
 * elements by test id rather than by their label.
 */

/** The film stock and lens ids come from the seeded Minolta kit (`@filmnotes/presets`). */
const FILM_KODAK_GOLD = "film0kodakgold2";
const LENS_50MM = "lens0min50f1700";
const FILTER_POLARIZER = "filt0kenkopl490";

export const scenes = [
  {
    id: "01-rolls-empty",
    title: "The empty roll list",
    caption: "First launch: no roll yet, one button to create one.",
    anchor: "rolls-screen",
    async run(ui) {
      await ui.waitFor("rolls-screen");
    },
  },
  {
    id: "02-roll-new",
    title: "New roll from a film preset",
    caption:
      "Picking Kodak Gold 200 fills in ISO 200 and 36 exposures; the camera comes from the " +
      "seeded Minolta kit.",
    anchor: "roll-form",
    async run(ui) {
      await ui.press("rolls-new");
      await ui.waitFor("roll-form");
      await ui.press("roll-form-film-stock-open");
      await ui.press(`roll-form-film-stock-option-${FILM_KODAK_GOLD}`);
    },
  },
  {
    id: "03-roll-detail-empty",
    title: "The roll, still empty",
    caption: "Film, camera and ISO are on the roll; the frame list starts at 0 / 36.",
    anchor: "roll-detail",
    async run(ui) {
      await ui.press("roll-form-save");
      await ui.waitFor("roll-detail");
    },
  },
  {
    id: "04-frame-defaults",
    title: "A new frame starts from the camera defaults",
    caption:
      "Program mode, the 35-70 zoom, the UV filter and hand-held support are prefilled - in " +
      "the field only what actually changed has to be touched.",
    anchor: "frame-edit",
    async run(ui) {
      await ui.press("roll-detail-add-frame");
      await ui.waitFor("frame-edit");
    },
  },
  {
    id: "05-frame-exposure",
    title: "Recording the exposure",
    caption: "Manual mode opens the shutter and aperture fields: 1/125 at f/8.",
    anchor: "frame-edit",
    async run(ui) {
      await ui.press("frame-mode-option-M");
      await ui.press("frame-shutter-open");
      await ui.press("frame-shutter-option-1/125");
      await ui.press("frame-aperture-open");
      await ui.press("frame-aperture-option-8");
    },
  },
  {
    id: "06-frame-shake-warning",
    title: "Edge case: the shutter is slower than the lens allows hand-held",
    caption:
      "At 1/15 hand-held the domain rules warn about camera shake. Warnings explain, they do " +
      "not block saving.",
    anchor: "frame-issues",
    async run(ui) {
      await ui.press("frame-shutter-open");
      await ui.press("frame-shutter-option-1/15");
      await ui.waitFor("frame-issues");
    },
  },
  {
    id: "07-frame-polarizer-af",
    title: "Edge case: a linear polarizer defeats the autofocus",
    caption:
      "With the 50 mm and the linear PL filter mounted, the rules point out that autofocus " +
      "will not work - focus manually.",
    anchor: "frame-issues",
    async run(ui) {
      await ui.press(`frame-lens-option-${LENS_50MM}`);
      await ui.press(`frame-filters-option-${FILTER_POLARIZER}`);
      await ui.waitFor("frame-issues");
    },
  },
  {
    id: "08-frame-bulb-outside-m",
    title: "Edge case: bulb outside manual mode",
    caption: "The Minolta offers B only in M; picking it in P is reported straight away.",
    anchor: "frame-issues",
    async run(ui) {
      await ui.press("frame-shutter-open");
      await ui.press("frame-shutter-option-bulb");
      await ui.press("frame-mode-option-P");
      await ui.waitFor("frame-issues");
    },
  },
  {
    id: "09-roll-progress",
    title: "The roll counts the frame",
    caption: "Back on the roll: 1 / 36 frames, the newest first.",
    anchor: "roll-detail",
    async run(ui) {
      await ui.press("frame-mode-option-M");
      await ui.press("frame-save");
      await ui.waitFor("roll-detail");
    },
  },
  {
    id: "10-scan-import-without-server",
    title: "Edge case: scan import without a server",
    caption:
      "Scans live in PocketBase, so the import asks for the server connection first instead " +
      "of failing halfway through an upload.",
    anchor: "scan-import",
    async run(ui) {
      await ui.press("roll-detail-import-scans");
      await ui.waitFor("scan-import");
    },
  },
  {
    id: "11-equipment",
    title: "The equipment tab",
    caption: "The seeded Minolta kit: body, three lenses, filters, flash - all editable.",
    anchor: "equipment-screen",
    async run(ui) {
      // The scan import and the roll detail are pushed over the tabs, so the tab bar is not on
      // screen until we are back on the roll list.
      await ui.back();
      await ui.back();
      await ui.waitFor("rolls-screen");
      await ui.press("tab-equipment");
      await ui.waitFor("equipment-screen");
    },
  },
  {
    id: "12-settings",
    title: "Settings",
    caption: "Language, server, WordPress and the reset - nothing else needs configuring.",
    anchor: "settings-screen",
    async run(ui) {
      await ui.press("tab-settings");
      await ui.waitFor("settings-screen");
    },
  },
  {
    id: "13-server-settings",
    title: "The server connection",
    caption:
      "Offline by default: the app is fully usable without this screen. Sync, scans and " +
      "export are what need it.",
    anchor: "server-settings-screen",
    async run(ui) {
      await ui.press("settings-server");
      await ui.waitFor("server-settings-screen");
    },
  },
];
