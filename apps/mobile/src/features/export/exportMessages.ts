/**
 * Shared, translated wording of the export screens.
 */
import type { TFunction } from "i18next";

import { ExportPreconditionError } from "./runExport";

/**
 * The bare reason an export failed: a refused precondition has its own translated text, everything
 * else is reported with whatever the exporter (or the network) said – a WordPress error message is
 * usually the most useful thing a screen can offer. Used where the sentence around it already says
 * that something failed, e.g. per frame in the roll export.
 */
export function exportErrorReason(t: TFunction, error: unknown): string {
  if (error instanceof ExportPreconditionError) return t(`errors.${error.problem}`);
  return error instanceof Error ? error.message : String(error);
}

/** The same reason as a full sentence, for a screen that exports one frame. */
export function exportErrorMessage(t: TFunction, error: unknown): string {
  if (error instanceof ExportPreconditionError) return t(`errors.${error.problem}`);
  return t("errors.failed", { message: exportErrorReason(t, error) });
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
