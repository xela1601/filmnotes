/**
 * Runs one frame export and records it.
 *
 * The step that must not be skipped is the `ExportLog`: it is what the frame screen shows as
 * "already exported" and what keeps a second export from being a silent duplicate. It is written
 * only after the exporter has resolved, so a failed attempt leaves no trace.
 *
 * Everything the run needs is passed in – state, store writer, clock and `fetch` – so the whole
 * function is testable with a fake exporter and without a network.
 */
import { newId, type CollectionName, type EntityOf, type Frame, type ISODateTime } from '@filmnotes/domain';
import { getExporter, type ExportImage, type ExportResult } from '@filmnotes/exporters';

import { exportInputFor } from './exportModel';
import type { AppState } from '../../store/store';

/** Why an export could not even be attempted; doubles as the i18n key `errors.<problem>`. */
export type ExportProblem =
  | 'unknownExporter'
  | 'incompleteFrame'
  | 'imageRequired'
  | 'invalidConfig';

/** An export that was refused before the exporter ran – nothing was sent anywhere. */
export class ExportPreconditionError extends Error {
  readonly problem: ExportProblem;

  constructor(problem: ExportProblem) {
    super(`export refused: ${problem}`);
    this.name = 'ExportPreconditionError';
    this.problem = problem;
  }
}

export interface RunFrameExportDeps {
  /** Id of a registered exporter, e.g. `'wordpress'` or `'share'`. */
  exporterId: string;
  frame: Frame;
  state: AppState;
  /** The stored settings for this target; validated with the exporter's own schema. */
  config: unknown;
  /** The scan bytes, or null for a frame without an uploaded scan. */
  image: ExportImage | null;
  fetch: typeof fetch;
  upsert: <K extends CollectionName>(collection: K, record: EntityOf<K>) => void;
  now: () => ISODateTime;
  /** The caption as edited in the export screen; omitted builds it from the settings. */
  caption?: string;
}

export async function runFrameExport(deps: RunFrameExportDeps): Promise<ExportResult> {
  const exporter = getExporter(deps.exporterId);
  if (exporter === undefined) throw new ExportPreconditionError('unknownExporter');

  const input = exportInputFor(deps.state, deps.frame, deps.image, deps.caption);
  if (input === null) throw new ExportPreconditionError('incompleteFrame');
  if (exporter.requiresImage && input.image === null) {
    throw new ExportPreconditionError('imageRequired');
  }

  const config = exporter.configSchema.safeParse(deps.config);
  if (!config.success) throw new ExportPreconditionError('invalidConfig');

  const result = await exporter.exportFrame(input, config.data, { fetch: deps.fetch });

  const at = deps.now();
  deps.upsert('exportLogs', {
    id: newId(),
    created: at,
    updated: at,
    deleted: null,
    owner: null,
    frameId: deps.frame.id,
    target: exporter.id,
    externalId: result.externalId,
    url: result.url,
    exportedAt: at,
  });

  return result;
}
