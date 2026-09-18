import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { RollDetailScreen } from '../../src/features/rolls/RollDetailScreen';

/** `/rolls/<id>` – the frames of a roll and its actions. */
export default function RollDetailRoute() {
  const { t } = useTranslation('rolls');
  const { rollId } = useLocalSearchParams<{ rollId: string }>();

  return (
    <>
      <Stack.Screen options={{ title: t('title') }} />
      <RollDetailScreen rollId={rollId ?? ''} />
    </>
  );
}
