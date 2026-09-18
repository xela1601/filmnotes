import { Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";

import { SCANS_NAMESPACE } from "../../src/features/scans/i18n";
import { ScanImportScreen } from "../../src/features/scans/ScanImportScreen";

/** `/scans/<rollId>` – pick, review and upload the lab's scans of a roll. */
export default function ScanImportRoute() {
  const { t } = useTranslation(SCANS_NAMESPACE);
  const { rollId } = useLocalSearchParams<{ rollId: string }>();

  return (
    <>
      <Stack.Screen options={{ title: t("title") }} />
      <ScanImportScreen rollId={rollId ?? ""} />
    </>
  );
}
