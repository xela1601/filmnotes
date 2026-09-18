/**
 * Pure model of the export screens: what an exporter is handed for one frame.
 *
 * Everything here is a plain function of the store state, so the screens stay thin and the
 * interesting part – which caption a frame produces, which WordPress config the settings add up
 * to – is unit-tested without rendering anything.
 */
import { buildCaption, type ExportLog, type Frame, type Id, type Scan } from '@filmnotes/domain';
import {
  wordPressConfigSchema,
  type ExportImage,
  type ExportInput,
  type WordPressConfig,
} from '@filmnotes/exporters';

import { resolveLanguage } from '../../i18n';
import {
  selectActive,
  selectEquipmentForCaption,
  selectScansForRoll,
  type CaptionEquipment,
} from '../../store/selectors';
import type { AppState, Settings } from '../../store/store';

/** The caption of a frame, built with the template, hashtags and locale from the settings. */
function captionWith(
  settings: Settings,
  frame: Frame,
  equipment: CaptionEquipment,
): string {
  return buildCaption({
    frame,
    roll: equipment.roll,
    camera: equipment.camera,
    lens: equipment.lens,
    filters: equipment.filters,
    filmStock: equipment.filmStock,
    // `undefined` keeps the defaults of `buildCaption`; an empty hashtag list in the settings
    // means "the defaults", because there is no UI to switch hashtags off entirely.
    template: settings.captionTemplate ?? undefined,
    hashtags: settings.hashtags.length === 0 ? undefined : settings.hashtags,
    locale: resolveLanguage(settings.locale),
  });
}

/**
 * The caption of a frame as the export screens preview it, or `null` when the frame's roll,
 * camera or film stock is unknown (a half-synced state) and no caption can be built.
 */
export function captionFor(state: AppState, frame: Frame): string | null {
  const equipment = selectEquipmentForCaption(state, frame);
  if (equipment === null) return null;
  return captionWith(state.settings, frame, equipment);
}

/**
 * Everything an exporter looks at for one frame, or `null` when the records around the frame are
 * incomplete. `image` is null for a frame without an uploaded scan – only an exporter with
 * `requiresImage` refuses that. `caption` overrides the built caption with the edited one.
 */
export function exportInputFor(
  state: AppState,
  frame: Frame,
  image: ExportImage | null,
  caption?: string,
): ExportInput | null {
  const equipment = selectEquipmentForCaption(state, frame);
  if (equipment === null) return null;

  return {
    frame,
    roll: equipment.roll,
    camera: equipment.camera,
    lens: equipment.lens,
    filters: equipment.filters,
    filmStock: equipment.filmStock,
    caption: caption ?? captionWith(state.settings, frame, equipment),
    image,
  };
}

/** True once site url and user name are stored; the app password lives in the secure store. */
export function isWordPressConfigured(settings: Settings): boolean {
  return settings.wordpressSiteUrl !== null && settings.wordpressUsername !== null;
}

/**
 * The WordPress exporter config from the settings plus the secret, or `null` when something is
 * missing or malformed.
 *
 * Post status, categories and tags are not in the settings yet, so every export is created as a
 * draft without taxonomy – which is what the spec asks for (publishing stays manual).
 */
export function wordPressConfigFor(
  settings: Settings,
  appPassword: string | null,
): WordPressConfig | null {
  if (appPassword === null || appPassword === '') return null;

  const candidate = {
    siteUrl: settings.wordpressSiteUrl ?? '',
    username: settings.wordpressUsername ?? '',
    appPassword,
    status: 'draft',
    categoryIds: [],
    tagIds: [],
  };

  const parsed = wordPressConfigSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

/**
 * The scan assigned to a frame, or null when none is. A frame has at most one scan; if an import
 * ever left two, the first by sort index wins, which is the one the review screen shows.
 */
export function selectScanForFrame(state: AppState, frame: Frame): Scan | null {
  return selectScansForRoll(state, frame.rollId).find((scan) => scan.frameId === frame.id) ?? null;
}

/** Past exports of a frame, most recent first. */
export function selectExportLogsForFrame(state: AppState, frameId: Id): ExportLog[] {
  return selectActive(state, 'exportLogs')
    .filter((log) => log.frameId === frameId)
    .sort((a, b) => b.exportedAt.localeCompare(a.exportedAt));
}
