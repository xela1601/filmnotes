/**
 * Runs every workspace's own jest config as a project.
 *
 * The workspace globs are resolved here instead of handing them to Jest directly:
 * Jest fails hard on a `projects` pattern that currently matches nothing (e.g. `apps/*`
 * before the Expo app exists), which would break the root test run between tickets.
 */
const { existsSync, readdirSync } = require("node:fs");
const { join } = require("node:path");

const workspaceRoots = ["packages", "apps", "tools"];

const projects = workspaceRoots.flatMap((root) => {
  const dir = join(__dirname, root);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(dir, entry.name))
    .filter((path) => existsSync(join(path, "jest.config.js")));
});

module.exports = {
  projects,
  // Before the workers exist, so they inherit it - see the file for why that matters.
  globalSetup: "<rootDir>/jest.globalSetup.js",
};
