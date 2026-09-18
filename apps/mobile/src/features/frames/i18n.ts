/** Registers the `frames` namespace; importing this module is enough. */
import { registerFeatureTranslations } from '../../i18n';

import de from './frames.de.json';
import en from './frames.en.json';

export const FRAMES_NAMESPACE = 'frames';

registerFeatureTranslations(FRAMES_NAMESPACE, { de, en });
