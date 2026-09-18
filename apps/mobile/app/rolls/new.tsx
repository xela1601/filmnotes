import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

import { ROLLS_NAMESPACE } from "../../src/features/rolls/i18n";

import { RollForm } from "../../src/features/rolls/RollFormScreen";

/** `/rolls/new` – create a roll. */
export default function NewRollRoute() {
  const { t } = useTranslation(ROLLS_NAMESPACE);

  return (
    <>
      <Stack.Screen options={{ title: t("new") }} />
      <RollForm mode="create" />
    </>
  );
}
