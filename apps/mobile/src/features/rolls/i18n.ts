/**
 * Translations of the roll screens.
 *
 * Importing this module registers the `rolls` namespace, so every module of this
 * feature imports it once and then uses `useTranslation('rolls')`.
 */
import { registerFeatureTranslations } from "../../i18n";
import de from "./rolls.de.json";
import en from "./rolls.en.json";

export const ROLLS_NAMESPACE = "rolls";

registerFeatureTranslations(ROLLS_NAMESPACE, { de, en });
