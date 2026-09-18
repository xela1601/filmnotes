/**
 * Process-wide registry of export targets.
 *
 * The app looks targets up by id (an `ExportLog.target`, a settings entry) and lists them for the
 * export screen, so the registry is a module-level map rather than something that is passed
 * around. Registering the same id twice replaces the previous entry, which lets a host swap an
 * implementation – in tests, or for a target that is configured at runtime.
 *
 * Registration erases the config type (see `ErasedExporter`): a caller that only knows an id
 * cannot know the config type either, so the wrapper parses whatever it is handed with the
 * exporter's own `configSchema` before the exporter sees it. That check used to be the caller's
 * job, and the type system did not enforce it.
 */
import type { ErasedExporter, Exporter } from "./types";

const exporters = new Map<string, ErasedExporter>();

/** Wraps an exporter so its config is validated at the boundary, whoever calls it. */
function erase<C>(exporter: Exporter<C>): ErasedExporter {
  return {
    ...exporter,
    // `async` on purpose: a config that does not parse has to *reject*, like every other
    // failure of an export, not throw synchronously into the caller's call site.
    exportFrame: async (input, config, deps) =>
      exporter.exportFrame(input, exporter.configSchema.parse(config), deps),
  };
}

/** Adds an exporter, replacing an exporter that was registered under the same id before. */
export function registerExporter<C>(exporter: Exporter<C>): void {
  exporters.set(exporter.id, erase(exporter));
}

/** The exporter registered for `id`, or undefined if nothing is registered for it. */
export function getExporter(id: string): ErasedExporter | undefined {
  return exporters.get(id);
}

/** Every registered exporter, in registration order. The array is a copy. */
export function listExporters(): ErasedExporter[] {
  return [...exporters.values()];
}
