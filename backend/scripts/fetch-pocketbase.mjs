#!/usr/bin/env node
/**
 * Provides `backend/bin/pocketbase` for local development and the integration smoke test.
 *
 * Two ways to get the binary:
 *
 *  1. `FILMNOTES_PB_BIN` points at an executable (the Docker sandbox ships one at
 *     /opt/pocketbase/pocketbase) -> a symlink is created, nothing is downloaded.
 *  2. otherwise the matching release zip is downloaded from GitHub and extracted.
 *
 * The version defaults to PB_VERSION_DEFAULT below and can be overridden with `PB_VERSION`.
 * `backend/bin/` is git-ignored; the binary is never committed.
 */
import { chmodSync, lstatSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { access, constants } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PB_VERSION_DEFAULT = "0.40.4";

const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const binDir = join(backendDir, "bin");
const binPath = join(binDir, "pocketbase");

/** @returns {string} `darwin_arm64` | `darwin_amd64` | `linux_amd64` | `linux_arm64` | `windows_amd64` */
function releaseTarget(platform = process.platform, arch = process.arch) {
  const os = { darwin: "darwin", linux: "linux", win32: "windows" }[platform];
  const cpu = { arm64: "arm64", x64: "amd64" }[arch];
  if (!os || !cpu) {
    throw new Error(`unsupported platform/arch combination: ${platform}/${arch}`);
  }
  return `${os}_${cpu}`;
}

async function isExecutable(path) {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function replaceWithSymlink(target) {
  // lstat, not existsSync: a dangling symlink must be removed as well.
  try {
    lstatSync(binPath);
    rmSync(binPath, { force: true });
  } catch {
    /* nothing to remove */
  }
  symlinkSync(target, binPath);
}

async function extractZip(zipPath) {
  const unzip = spawnSync("unzip", ["-o", "-q", zipPath, "pocketbase", "-d", binDir], {
    stdio: "inherit",
  });
  if (unzip.status === 0) return "unzip";

  // No `unzip` CLI (or it failed): fall back to the pure-JS extractor.
  const { unzipSync } = await import("fflate");
  const { readFileSync } = await import("node:fs");
  const files = unzipSync(new Uint8Array(readFileSync(zipPath)), {
    filter: (file) => file.name === "pocketbase" || file.name === "pocketbase.exe",
  });
  const entry = Object.keys(files)[0];
  if (!entry) throw new Error(`no pocketbase executable inside ${zipPath}`);
  writeFileSync(binPath, Buffer.from(files[entry]));
  return "fflate";
}

async function main() {
  mkdirSync(binDir, { recursive: true });

  const provided = process.env.FILMNOTES_PB_BIN;
  if (provided && (await isExecutable(provided))) {
    replaceWithSymlink(resolve(provided));
    console.log(`pocketbase: linked ${binPath} -> ${resolve(provided)} (FILMNOTES_PB_BIN)`);
    return;
  }

  const version = process.env.PB_VERSION || PB_VERSION_DEFAULT;
  const target = releaseTarget();
  const zipName = `pocketbase_${version}_${target}.zip`;
  const url = `https://github.com/pocketbase/pocketbase/releases/download/v${version}/${zipName}`;
  const zipPath = join(binDir, zipName);

  console.log(`pocketbase: downloading ${url}`);
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`download failed: ${response.status} ${response.statusText} for ${url}`);
  }
  writeFileSync(zipPath, Buffer.from(await response.arrayBuffer()));

  // A stale symlink from a previous FILMNOTES_PB_BIN run would make the extractor
  // write through the link instead of creating a real file.
  try {
    if (lstatSync(binPath).isSymbolicLink()) rmSync(binPath, { force: true });
  } catch {
    /* no previous binary */
  }

  const how = await extractZip(zipPath);
  rmSync(zipPath, { force: true });
  chmodSync(binPath, 0o755);
  console.log(`pocketbase: ${version} (${target}) extracted with ${how} to ${binPath}`);
}

main().catch((error) => {
  console.error(`pocketbase: ${error.message}`);
  process.exitCode = 1;
});
