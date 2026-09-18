/**
 * Preset data for the first launch.
 *
 * The data itself and the loaders live in `@filmnotes/presets` (T-003); this module
 * only adds the pseudo bundle id under which the film stock catalogue is recorded in
 * `seededBundleIds`, because film stocks are shipped outside the equipment bundles.
 */
export type { PresetBundle, PresetRecord } from "@filmnotes/presets";
export {
  loadEquipmentPresets,
  loadFilmStockPresets,
  materialize,
  seedRecords,
} from "@filmnotes/presets";

/** Film stocks are not part of an equipment bundle; they seed under this bundle id. */
export const FILM_STOCK_BUNDLE_ID = "film-stocks";
