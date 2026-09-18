/**
 * Test helpers for the PocketBase integration smoke test.
 *
 * They boot the real `backend/bin/pocketbase` binary on a free port with a throwaway
 * data directory and the repository's `pb_migrations`, so the migration is exercised
 * exactly the way it will be on the server.
 */
import { createServer } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const pocketBaseBin = join(backendDir, 'bin', 'pocketbase');
export const migrationsDir = join(backendDir, 'pb_migrations');

export const SUPERUSER_EMAIL = 'smoke-superuser@filmnotes.test';
export const SUPERUSER_PASSWORD = 'smoke-superuser-pw-123';

export function hasPocketBase() {
  return spawnSync(pocketBaseBin, ['--version'], { stdio: 'ignore' }).status === 0;
}

export const MISSING_BINARY_HINT =
  `${pocketBaseBin} is missing - run 'npm run fetch-pb -w @filmnotes/backend' first`;

/** Asks the OS for an unused TCP port and releases it again. */
function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
    });
  });
}

/**
 * Creates the first superuser. Runs before `serve` and, because --automigrate is on
 * by default, already applies the migrations to the fresh data directory.
 */
export function createSuperuser(dataDir, email = SUPERUSER_EMAIL, password = SUPERUSER_PASSWORD) {
  const result = spawnSync(
    pocketBaseBin,
    ['superuser', 'upsert', email, password, '--dir', dataDir, '--migrationsDir', migrationsDir],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(`superuser upsert failed: ${result.stderr || result.stdout}`);
  }
}

async function waitForHealth(url, child, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'no response yet';
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`pocketbase exited early with code ${child.exitCode}`);
    }
    try {
      const response = await fetch(`${url}/api/health`);
      if (response.ok) return;
      lastError = `status ${response.status}`;
    } catch (error) {
      lastError = error.message;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`pocketbase did not become healthy within ${timeoutMs} ms (${lastError})`);
}

/**
 * Starts a PocketBase instance with a superuser and the project migrations applied.
 *
 * @returns {Promise<{ url: string, dataDir: string, stop: () => Promise<void> }>}
 */
export async function startPocketBase() {
  const dataRoot = mkdtempSync(join(tmpdir(), 'filmnotes-pb-'));
  const dataDir = join(dataRoot, 'pb_data');
  createSuperuser(dataDir);

  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const child = spawn(
    pocketBaseBin,
    ['serve', '--http', `127.0.0.1:${port}`, '--dir', dataDir, '--migrationsDir', migrationsDir],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const logs = [];
  child.stdout.on('data', (chunk) => logs.push(String(chunk)));
  child.stderr.on('data', (chunk) => logs.push(String(chunk)));

  const stop = async () => {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await new Promise((r) => child.once('exit', r));
    }
    rmSync(dataRoot, { recursive: true, force: true });
  };

  try {
    await waitForHealth(url, child);
  } catch (error) {
    await stop();
    throw new Error(`${error.message}\n--- pocketbase output ---\n${logs.join('')}`);
  }

  return { url, dataDir, stop };
}

/** Throws with the response body included, which is what PocketBase puts the field errors in. */
async function asJson(response, what) {
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${what} failed: ${response.status} ${body}`);
  }
  return body ? JSON.parse(body) : null;
}

export async function loginSuperuser(url, email = SUPERUSER_EMAIL, password = SUPERUSER_PASSWORD) {
  const response = await fetch(`${url}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: email, password }),
  });
  const data = await asJson(response, 'superuser login');
  return data.token;
}

export async function createUser(url, superuserToken, email, password) {
  const response = await fetch(`${url}/api/collections/users/records`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: superuserToken },
    body: JSON.stringify({ email, password, passwordConfirm: password, verified: true }),
  });
  return asJson(response, `create user ${email}`);
}

export async function login(url, email, password) {
  const response = await fetch(`${url}/api/collections/users/auth-with-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: email, password }),
  });
  const data = await asJson(response, `login ${email}`);
  return { token: data.token, user: data.record };
}

/** Thin REST wrapper: returns { status, body } instead of throwing, so rules can be asserted. */
export async function api(url, path, { token, method = 'GET', body, headers = {} } = {}) {
  const init = { method, headers: { ...headers } };
  if (token) init.headers.authorization = token;
  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const response = await fetch(`${url}${path}`, init);
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: response.status, body: parsed };
}

/** Smallest possible valid PNG (1x1, opaque black) - enough for the upload + thumb test. */
export const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
