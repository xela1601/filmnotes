/**
 * Boots the *exported* web bundle inside jsdom and hands back a driver for it.
 *
 * Shared by `web-walkthrough.mjs` (the core-scenario check) and `tour-jsdom.mjs` (the dry
 * run of the screenshot tour), so both drive the app through exactly the same interface the
 * Playwright driver in `screenshots.mjs` implements.
 *
 * jsdom is not a browser: it has no layout engine, so the observers and the font API below
 * are stubbed and nothing that depends on real layout (scrolling, modal position, anything
 * visual) can be checked here. That is what the Playwright run is for.
 */
import { JSDOM, VirtualConsole } from "jsdom";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Loads the bundle served at `base` into a jsdom window and returns `{ window, ui, errors }`.
 * `ui` is the driver the tour scenes are written against; `errors` collects everything the
 * page logged, so a caller can fail on a broken bundle.
 */
export async function bootJsdomApp(base) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => errors.push(`jsdom: ${error.message}`));
  virtualConsole.on("error", (...args) =>
    errors.push(`console.error: ${String(args[0]).slice(0, 200)}`),
  );

  const html = await fetch(base).then((response) => response.text());
  const bundleUrl = html.match(/src="([^"]*entry[^"]*)"/)?.[1];
  if (bundleUrl === undefined) {
    throw new Error("no bundle in index.html - run `npx expo export --platform web` first");
  }

  // The bundle is injected by hand so the stubs below are in place before it evaluates.
  const dom = new JSDOM(html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/, ""), {
    url: `${base}/`,
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    virtualConsole,
  });
  const { window } = dom;
  window.fetch = fetch;
  // Without a resolving Font Loading API, FontFaceObserver (via @expo/vector-icons) waits for
  // a text measurement that never comes and then throws.
  window.document.fonts = { load: async () => [{}], ready: Promise.resolve(), check: () => true };
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
  window.matchMedia ??= (query) => ({
    matches: false,
    media: query,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  });

  const script = window.document.createElement("script");
  script.textContent = await fetch(new URL(bundleUrl, base)).then((response) => response.text());
  window.document.body.appendChild(script);

  const find = (testId) => window.document.querySelector(`[data-testid="${testId}"]`);

  const click = (node) => {
    (node.closest('[role="button"], button') ?? node).dispatchEvent(
      new window.MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  };

  const ui = {
    async waitFor(testId, timeout = 30_000) {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        if (find(testId) !== null) return;
        await sleep(100);
      }
      throw new Error(`timeout waiting for ${testId}`);
    },
    async press(testId) {
      await ui.waitFor(testId);
      click(find(testId));
      await sleep(150);
    },
    /** Browser back - expo-router navigates on the history API, on web and in jsdom alike. */
    async back() {
      window.history.back();
      await sleep(300);
    },
    has: (testId) => find(testId) !== null,
    text: (testId) => (find(testId)?.textContent ?? "").replace(/\s+/g, " ").trim(),
    // jsdom cannot paint; the tour's screenshots happen in the Playwright driver.
    async shot() {},
    sleep,
  };

  return { window, ui, errors };
}
