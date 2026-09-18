/**
 * Translations of the export screens, registered as their own i18next namespace at module
 * load – see `src/i18n/index.ts`.
 *
 * The exporter names live under `exporters.<id>`, which is the `nameKey` every exporter of
 * `@filmnotes/exporters` carries, so a new target only needs a key here.
 */
import de from "./export.de.json";
import en from "./export.en.json";
import { registerFeatureTranslations } from "../../i18n";

export const EXPORT_NAMESPACE = "export";

registerFeatureTranslations(EXPORT_NAMESPACE, { de, en });
