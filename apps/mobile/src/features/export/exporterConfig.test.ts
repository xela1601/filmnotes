/**
 * What it costs to add an export target.
 *
 * The point of these is the *third* exporter: one that nothing in the app knows about. It must
 * behave sensibly without a single `if (id === …)` anywhere - offered when it needs nothing,
 * offered but disabled when it does. Before, an unknown target was always offered and always
 * failed on the first press, because the config lookup had WordPress written into it.
 */
import {
  getExporter,
  registerExporter,
  wordPressExporter,
  type Exporter,
} from "@filmnotes/exporters";
import { z } from "zod";

import { configForExporter, isExporterReady, settingsRouteFor } from "./exporterConfig";
import { useStore, type Settings } from "../../store/store";

/** A target that needs nothing stored - the share exporter's situation. */
const selfContained: Exporter<Record<string, never>> = {
  id: "test-self-contained",
  nameKey: "exporters.testSelfContained",
  configSchema: z.object({}).strict(),
  requiresImage: false,
  exportFrame: () => Promise.resolve({ externalId: null, url: null, sharePayload: null }),
};

/** A target that needs an API key, and has no entry in the table. */
const needsAKey: Exporter<{ apiKey: string }> = {
  id: "test-needs-a-key",
  nameKey: "exporters.testNeedsAKey",
  configSchema: z.object({ apiKey: z.string().min(1) }),
  requiresImage: false,
  exportFrame: () => Promise.resolve({ externalId: null, url: null, sharePayload: null }),
};

/** The registry hands out the erased form, which is what the app actually sees. */
function registered<C>(exporter: Exporter<C>) {
  registerExporter(exporter);
  const erased = getExporter(exporter.id);
  if (erased === undefined) throw new Error(`${exporter.id} did not register`);
  return erased;
}

const settings = (): Settings => useStore.getState().settings;

describe("a target the app has never heard of", () => {
  it("is offered when its schema needs nothing", () => {
    expect(isExporterReady(registered(selfContained), settings())).toBe(true);
  });

  it("is held back when its schema needs something nobody stored", () => {
    // Not "offered and then broken": the schema is the honest answer to "can this run?".
    expect(isExporterReady(registered(needsAKey), settings())).toBe(false);
  });

  it("is handed an empty config rather than someone else's", async () => {
    await expect(configForExporter(selfContained.id, useStore.getState())).resolves.toEqual({});
  });

  it("offers no settings screen, because it has none", () => {
    expect(settingsRouteFor(selfContained.id)).toBeNull();
  });
});

describe("a target with a binding", () => {
  beforeEach(() => {
    useStore.getState().resetAll();
  });

  it("follows its own readiness rule, not its schema", () => {
    const wordpress = registered(wordPressExporter);
    expect(isExporterReady(wordpress, settings())).toBe(false);

    useStore.getState().updateSettings({
      wordpressSiteUrl: "https://example.org",
      wordpressUsername: "alex",
    });

    expect(isExporterReady(wordpress, settings())).toBe(true);
  });

  it("points at the screen that collects them", () => {
    expect(settingsRouteFor(wordPressExporter.id)).toBe("/settings/wordpress");
  });
});
