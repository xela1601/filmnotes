/**
 * The framework-free exporter contract.
 *
 * An exporter turns a single frame – together with everything the caption already knows about it
 * – into whatever the target needs: an HTTP request against a blog, a payload for the OS share
 * sheet, or something that does not exist yet. Adding a target means implementing `Exporter` and
 * registering it; nothing in this package knows about React Native, Expo or the store.
 */
import type { Camera, FilmStock, Filter, Frame, Lens, Roll } from '@filmnotes/domain';
import type { z } from 'zod';

/** An image ready to be uploaded or shared; `bytes` are the encoded file, not raw pixels. */
export interface ExportImage {
  bytes: Uint8Array;
  mimeType: string;
  fileName: string;
}

/** Everything an exporter may look at. The caption is pre-built with `buildCaption`. */
export interface ExportInput {
  frame: Frame;
  roll: Roll;
  camera: Camera;
  lens: Lens | null;
  filters: Filter[];
  filmStock: FilmStock;
  caption: string;
  /** The scan to export, or null when the frame has no image attached. */
  image: ExportImage | null;
}

/** What the app layer hands to `expo-sharing` / `navigator.share` / the clipboard. */
export interface SharePayload {
  text: string;
  image: ExportImage | null;
}

/**
 * The outcome of one export. `externalId` and `url` are filled by remote targets and end up in an
 * `ExportLog`; `sharePayload` is filled by local targets that only build data for the app layer.
 */
export interface ExportResult {
  externalId: string | null;
  url: string | null;
  sharePayload: SharePayload | null;
}

/**
 * Host capabilities an exporter is allowed to use. Passing `fetch` in instead of reaching for the
 * global keeps every exporter testable with a recording fake.
 */
export interface ExporterDeps {
  fetch: typeof fetch;
}

/** One export target. `C` is the shape of the settings the user has to provide. */
export interface Exporter<C> {
  /** Stable id, also used as the `target` of an `ExportLog`. */
  id: string;
  /** i18n key in the app: `exporters.<id>`. */
  nameKey: string;
  /** Validates the settings the app stores for this target. */
  configSchema: z.ZodType<C>;
  /** True when the target cannot export a frame without an image. */
  requiresImage: boolean;
  exportFrame(input: ExportInput, config: C, deps: ExporterDeps): Promise<ExportResult>;
}
