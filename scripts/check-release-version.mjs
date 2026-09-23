#!/usr/bin/env node
/**
 * Does every workspace carry the version we are about to publish?
 *
 *   node scripts/check-release-version.mjs 0.2.0-alpha.0
 *
 * All `@filmnotes/*` workspaces are a fixed changesets group, so they move together and one
 * manifest left behind means the tag describes something that does not exist. Checking a single
 * manifest would not notice that, which is why this walks all of them - plus `app.json`, the
 * version Expo builds into the app and the one a user can actually read on their device.
 *
 * Exits 0 when everything matches, 1 with a list of the offenders when it does not.
 */
import { globSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const expected = process.argv[2];
if (!expected) {
  console.error("usage: node scripts/check-release-version.mjs <version>");
  process.exit(2);
}

const readJson = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));

/** Every workspace manifest, resolved from the globs in the root package.json. */
function workspaceManifests() {
  const { workspaces } = readJson("package.json");
  return workspaces.flatMap((pattern) => globSync(`${pattern}/package.json`, { cwd: root })).sort();
}

const found = workspaceManifests().map((path) => {
  const { name, version } = readJson(path);
  return { path, name, version };
});

// app.json is not a manifest but carries the same number; scripts/sync-app-version.mjs writes it.
found.push({
  path: "apps/mobile/app.json",
  name: "expo.version",
  version: readJson("apps/mobile/app.json").expo.version,
});

const wrong = found.filter((entry) => entry.version !== expected);

for (const { path, name, version } of found) {
  console.log(`${version === expected ? "ok  " : "BAD "} ${version.padEnd(16)} ${name}  (${path})`);
}

if (wrong.length > 0) {
  console.error(
    `\n${wrong.length} of ${found.length} say something other than ${expected}. ` +
      "Run `npm run release` and commit the result before tagging.",
  );
  process.exit(1);
}

console.log(`\nAll ${found.length} say ${expected}.`);
