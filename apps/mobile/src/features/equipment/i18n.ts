/**
 * Translations of the equipment screens.
 *
 * Importing this module registers the `equipment` namespace, so every module of this
 * feature imports it once and then uses `useTranslation('equipment')`.
 */
import { registerFeatureTranslations } from "../../i18n";
import de from "./equipment.de.json";
import en from "./equipment.en.json";

export const EQUIPMENT_NAMESPACE = "equipment";

registerFeatureTranslations(EQUIPMENT_NAMESPACE, { de, en });
