/**
 * Translations of the sync feature, registered as their own i18next namespace at module
 * load – see `src/i18n/index.ts` and the app README.
 */
import de from './sync.de.json';
import en from './sync.en.json';
import { registerFeatureTranslations } from '../i18n';

export const SYNC_NAMESPACE = 'sync';

registerFeatureTranslations(SYNC_NAMESPACE, { de, en });
