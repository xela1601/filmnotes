import { Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";

import { ExportRollScreen } from "../../../src/features/export/ExportRollScreen";
import { EXPORT_NAMESPACE } from "../../../src/features/export/i18n";

/** `/export/roll/<id>` – export the frames of a roll that have a scan. */
export default function ExportRollRoute() {
  const { t } = useTranslation(EXPORT_NAMESPACE);
  const { rollId } = useLocalSearchParams<{ rollId: string }>();

  return (
    <>
      <Stack.Screen options={{ title: t("title") }} />
      <ExportRollScreen rollId={rollId ?? ""} />
    </>
  );
}
