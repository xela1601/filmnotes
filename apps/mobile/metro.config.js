// Workspace-aware Metro config: the app lives in apps/mobile but its dependencies
// (and the TypeScript sources of @filmnotes/*) are hoisted to the monorepo root.
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..", "..");

const config = getDefaultConfig(projectRoot);

// Watch the whole workspace so changes in packages/* trigger a rebuild.
config.watchFolders = [workspaceRoot];

// Resolve from both the app's and the workspace root's node_modules.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// @filmnotes/* packages ship TypeScript sources and use the "exports" field.
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
