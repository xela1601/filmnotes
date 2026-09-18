#!/usr/bin/env node
/**
 * The `filmnotes-import` binary.
 *
 * It runs the TypeScript sources through tsx instead of a compiled `dist/cli.js`, because the
 * workspace packages of this monorepo are source packages: `@filmnotes/domain` points its `main`
 * at `src/index.ts` with extensionless, bundler-style imports, which plain Node cannot load (the
 * app uses Metro, the tests use ts-jest, and this CLI uses tsx).
 *
 * `npm run build -w @filmnotes/scan-import` (`tsc -b`) still type-checks the workspace and emits
 * declarations; it just is not what the binary runs.
 */
require("tsx/cjs");
require("../src/cli.ts");
