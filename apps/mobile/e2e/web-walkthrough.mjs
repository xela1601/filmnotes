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
 * jsdom is not a browser: it has no layout engine, so the observers and the font API
 * below are stubbed. Anything that depends on real layout (scrolling, modal position)
 * cannot be checked here – use a real device or browser for that.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const port = Number(process.env.PORT ?? 8099);
const contentTypes = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.ttf': 'font/ttf',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.map': 'application/json',
};

const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  // Single-page output: unknown paths fall back to index.html.
  for (const candidate of [join(root, path), join(root, path, 'index.html'), join(root, 'index.html')]) {
    try {
      const body = await readFile(candidate);
      response.writeHead(200, { 'content-type': contentTypes[extname(candidate)] ?? 'application/octet-stream' });
      response.end(body);
      return;
    } catch {
      /* try the next candidate */
    }
  }
  response.writeHead(404).end('not found');
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, '127.0.0.1', resolve);
});
const base = `http://127.0.0.1:${port}`;

const results = [];
const pageErrors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', (error) => pageErrors.push(`jsdom: ${error.message}`));
virtualConsole.on('error', (...args) => pageErrors.push(`console.error: ${String(args[0]).slice(0, 200)}`));
process.on('unhandledRejection', (reason) => pageErrors.push(`unhandledRejection: ${String(reason).slice(0, 160)}`));

const html = await fetch(base).then((response) => response.text());
const bundleUrl = html.match(/src="([^"]*entry[^"]*)"/)?.[1];
if (bundleUrl === undefined) throw new Error('no bundle in index.html – run `npx expo export --platform web` first');

// The bundle is injected by hand so the stubs are in place before it evaluates.
const dom = new JSDOM(html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/, ''), {
  url: `${base}/`,
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  virtualConsole,
});
const { window } = dom;
window.fetch = fetch;
// Without a resolving Font Loading API, FontFaceObserver (via @expo/vector-icons) waits
// for a text measurement that never comes and then throws.
window.document.fonts = { load: async () => [{}], ready: Promise.resolve(), check: () => true };
window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
window.matchMedia ??= (query) => ({
  matches: false, media: query,
  addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {},
  dispatchEvent: () => false,
});

const script = window.document.createElement('script');
script.textContent = await fetch(new URL(bundleUrl, base)).then((response) => response.text());
window.document.body.appendChild(script);

const selector = (id) => `[data-testid="${id}"]`;
const find = (id) => window.document.querySelector(selector(id));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const textOf = (id) => (find(id)?.textContent ?? '').replace(/\s+/g, ' ').trim();

async function waitFor(id, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (find(id) !== null) return;
    await sleep(100);
  }
  throw new Error(`timeout waiting for ${id}`);
}

async function press(id) {
  await waitFor(id);
  const node = find(id);
  (node.closest('[role="button"], button') ?? node).dispatchEvent(
    new window.MouseEvent('click', { bubbles: true, cancelable: true }),
  );
  await sleep(150);
}

function check(label, passed, detail = '') {
  results.push(`${passed ? 'ok  ' : 'FAIL'} ${label}${detail ? ` – ${detail}` : ''}`);
  if (!passed) process.exitCode = 1;
}

try {
  // Step 1: the app opens on the roll list.
  await waitFor('rolls-screen');
  check('bundle boots and renders the roll list', true, textOf('rolls-screen').slice(0, 60));
  check('empty state shown', find('rolls-empty') !== null);

  // Step 2: create a roll from the Kodak Gold 200 preset.
  await press('rolls-new');
  await waitFor('roll-form');
  await press('roll-form-film-stock-open');
  await press('roll-form-film-stock-option-film0kodakgold2');
  check('film stock sets ISO 200', /\b200\b/.test(textOf('roll-form')), textOf('roll-form').slice(0, 80));
  check('exposures default to 36', textOf('roll-form-exposures').includes('36'));
  await press('roll-form-save');

  // Step 3: the roll detail shows the film and the camera; add the first frame.
  await waitFor('roll-detail');
  check('roll detail shows the film', textOf('roll-detail-title').includes('Kodak Gold 200'), textOf('roll-detail-title'));
  check('camera from the preset', textOf('roll-detail-camera').includes('7000'), textOf('roll-detail-camera'));
  check('ISO stored on the roll', textOf('roll-detail-iso').includes('200'), textOf('roll-detail-iso'));
  await press('roll-detail-add-frame');

  // Step 4: camera defaults, then a plausibility warning.
  await waitFor('frame-edit');
  check('frame defaults to program mode', textOf('frame-mode').includes('P'), textOf('frame-mode'));
  check('lens preset offered', /35\s*-\s*70/.test(textOf('frame-lens')));
  await press('frame-mode-option-M');
  await press('frame-shutter-open');
  await press('frame-shutter-option-1/15');
  await sleep(300);
  // The wording follows the UI language, which follows the system locale of the host.
  check(
    'shake warning for 1/15 hand-held',
    /(verwackl|shake risk)/i.test(textOf('frame-issues')),
    textOf('frame-issues').slice(0, 120),
  );

  await press('frame-save');
  await waitFor('roll-detail');
  check('roll progress counts the frame', /1\s*\/\s*36/.test(textOf('roll-detail-progress')), textOf('roll-detail-progress'));
} catch (error) {
  check(`walkthrough aborted: ${error.message}`, false);
} finally {
  console.log(results.join('\n'));
  if (pageErrors.length > 0) console.log(`\npage errors (${pageErrors.length}):\n${pageErrors.slice(0, 5).join('\n')}`);
  window.close();
  server.close();
}
