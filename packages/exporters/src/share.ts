/**
 * Share package exporter.
 *
 * It builds nothing but the payload for the OS share sheet: the caption that the caller already
 * assembled with `buildCaption`, plus the image as it is. Handing that payload to `expo-sharing`,
 * `navigator.share` or the clipboard is the app layer's job, because only it may touch native
 * modules – this package stays framework-free.
 */
import { z } from 'zod';
import type { Exporter, ExporterDeps, ExportInput, ExportResult } from './types';

/** The share target needs no settings; the schema exists so every exporter has one. */
export const shareConfigSchema = z.object({});
export type ShareConfig = z.infer<typeof shareConfigSchema>;

export const shareExporter: Exporter<ShareConfig> = {
  id: 'share',
  nameKey: 'exporters.share',
  configSchema: shareConfigSchema,
  requiresImage: false,
  exportFrame(input: ExportInput, _config: ShareConfig, _deps: ExporterDeps): Promise<ExportResult> {
    return Promise.resolve({
      externalId: null,
      url: null,
      sharePayload: { text: input.caption, image: input.image },
    });
  },
};
