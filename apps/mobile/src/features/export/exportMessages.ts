/**
 * Shared, translated wording of the export screens.
 */
import type { TFunction } from 'i18next';

import { ExportPreconditionError } from './runExport';

/**
 * The message for a failed export: a refused precondition has its own text, everything else is
 * shown with whatever the exporter (or the network) said – a WordPress error message is usually
 * the most useful thing the screen can offer.
 */
export function exportErrorMessage(t: TFunction, error: unknown): string {
  if (error instanceof ExportPreconditionError) return t(`errors.${error.problem}`);
  return t('errors.failed', {
    message: error instanceof Error ? error.message : String(error),
  });
}

/** An `ExportLog.target` as the UI names it; an unknown target keeps its id. */
export function targetLabel(t: TFunction, target: string): string {
  return t(`exporters.${target}`, { defaultValue: target });
}

/** A timestamp in the device's own format. */
export function formatTime(iso: string, language: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(language);
}
