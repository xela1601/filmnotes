/**
 * Process-wide registry of export targets.
 *
 * The app looks targets up by id (an `ExportLog.target`, a settings entry) and lists them for the
 * export screen, so the registry is a module-level map rather than something that is passed
 * around. Registering the same id twice replaces the previous entry, which lets a host swap an
 * implementation – in tests, or for a target that is configured at runtime.
 *
 * Registered exporters are kept as `Exporter<unknown>`: a caller that only knows an id cannot know
 * the config type either, so it validates the stored settings with `configSchema` and hands the
 * result straight back to `exportFrame`.
 */
import type { Exporter } from "./types";

const exporters = new Map<string, Exporter<unknown>>();

/** Adds an exporter, replacing an exporter that was registered under the same id before. */
export function registerExporter(exporter: Exporter<unknown>): void {
  exporters.set(exporter.id, exporter);
}

/** The exporter registered for `id`, or undefined if nothing is registered for it. */
export function getExporter(id: string): Exporter<unknown> | undefined {
  return exporters.get(id);
}

/** Every registered exporter, in registration order. The array is a copy. */
export function listExporters(): Exporter<unknown>[] {
  return [...exporters.values()];
}
