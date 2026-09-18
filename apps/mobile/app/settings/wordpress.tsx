import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { WordPressSettingsScreen } from '../../src/features/export/WordPressSettingsScreen';

/** `/settings/wordpress` – the credentials the WordPress exporter needs. */
export default function WordPressSettingsRoute() {
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen options={{ title: t('settings.wordpress') }} />
      <WordPressSettingsScreen />
    </>
  );
}
