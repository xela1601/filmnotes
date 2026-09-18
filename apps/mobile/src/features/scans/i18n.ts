/**
 * Translations of the scan import screen.
 *
 * Importing this module registers the `scans` namespace, so every module of this feature
 * imports it once and then uses `useTranslation('scans')`.
 */
import { registerFeatureTranslations } from '../../i18n';
import de from './scans.de.json';
import en from './scans.en.json';

export const SCANS_NAMESPACE = 'scans';

registerFeatureTranslations(SCANS_NAMESPACE, { de, en });
