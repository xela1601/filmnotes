import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ExportFrameScreen } from '../../../src/features/export/ExportFrameScreen';
import { EXPORT_NAMESPACE } from '../../../src/features/export/i18n';

/** `/export/frame/<id>` – export one frame to a blog or the share sheet. */
export default function ExportFrameRoute() {
  const { t } = useTranslation(EXPORT_NAMESPACE);
  const { frameId } = useLocalSearchParams<{ frameId: string }>();

  return (
    <>
      <Stack.Screen options={{ title: t('title') }} />
      <ExportFrameScreen frameId={frameId ?? ''} />
    </>
  );
}
