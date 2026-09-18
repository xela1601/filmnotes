import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { RollForm } from '../../../src/features/rolls/RollFormScreen';

/** `/rolls/<id>/edit` – change the roll's film, ISO or notes. */
export default function EditRollRoute() {
  const { t } = useTranslation('rolls');
  const { rollId } = useLocalSearchParams<{ rollId: string }>();

  return (
    <>
      <Stack.Screen options={{ title: t('edit') }} />
      <RollForm mode="edit" rollId={rollId} />
    </>
  );
}
