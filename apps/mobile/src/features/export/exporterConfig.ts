/**
 * Where an export target's stored settings come from.
 *
 * One table, keyed by exporter id. It exists so the rest of the app never asks "is this the
 * WordPress one?" again: the export screens and `useFrameExporter` go through the three functions
 * below, and a new target is added to the registry in `@filmnotes/exporters` - and, only if it
 * needs something stored, to the table here.
 *
 * A target that is not in the table is judged by its own `configSchema`: if the schema accepts an
 * empty config the target needs nothing and is offered, and if it does not, the target shows up
 * disabled with a hint. That is the useful failure - being offered and then failing at the first
 * press is what this replaced.
 */
import { wordPressExporter, type ErasedExporter } from "@filmnotes/exporters";

import { isWordPressConfigured, wordPressConfigFor } from "./exportModel";
import { getSecret } from "../../lib/secureStore";
import type { AppState, Settings } from "../../store/store";

/** How one target's settings are read and where the user enters them. */
export interface ExporterSettingsBinding {
  /** The stored config, in the shape the exporter's schema expects. May reach the keychain. */
  read(state: AppState): Promise<unknown>;
  /** Cheap and synchronous, for rendering: is enough stored to offer the target? */
  isReady(settings: Settings): boolean;
  /** The route of the screen that collects them. */
  route: string;
}

const BOUND: Readonly<Record<string, ExporterSettingsBinding>> = {
  // The site and the user are ordinary settings; the application password is a secret and lives
  // in the keychain, never in the persisted store.
  [wordPressExporter.id]: {
    read: async (state) =>
      wordPressConfigFor(state.settings, await getSecret("wordpressAppPassword")),
    isReady: isWordPressConfigured,
    route: "/settings/wordpress",
  },
};

/** The config to hand to `exportFrame`, or `{}` for a target that needs none. */
export async function configForExporter(exporterId: string, state: AppState): Promise<unknown> {
  const bound = BOUND[exporterId];
  return bound === undefined ? {} : await bound.read(state);
}

/** True when the target can run with what is stored right now. */
export function isExporterReady(exporter: ErasedExporter, settings: Settings): boolean {
  const bound = BOUND[exporter.id];
  return bound === undefined
    ? exporter.configSchema.safeParse({}).success
    : bound.isReady(settings);
}

/** The settings screen of a target, or null when it has none to offer. */
export function settingsRouteFor(exporterId: string): string | null {
  return BOUND[exporterId]?.route ?? null;
}
