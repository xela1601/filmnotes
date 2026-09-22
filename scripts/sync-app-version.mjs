/**
 * Carries the version `changeset version` wrote into the two files that are not workspaces.
 *
 * `apps/mobile/app.json` is what Expo builds into the app (and what the "Einstellungen" screen
 * shows), and the repository root carries the product version for anyone looking at it from the
 * outside. Neither is touched by changesets, so this runs right after it - see `npm run release`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Two spaces and a final newline, which is what Prettier leaves these files in. */
function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

const version = readJson(join(root, "apps", "mobile", "package.json")).version;

const appJsonPath = join(root, "apps", "mobile", "app.json");
const appJson = readJson(appJsonPath);
if (appJson.expo.version !== version) {
  appJson.expo.version = version;
  writeJson(appJsonPath, appJson);
  console.log(`app.json     -> ${version}`);
}

const rootPackagePath = join(root, "package.json");
const rootPackage = readJson(rootPackagePath);
if (rootPackage.version !== version) {
  rootPackage.version = version;
  writeJson(rootPackagePath, rootPackage);
  console.log(`package.json -> ${version}`);
}
