import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

import { RollForm } from "../../src/features/rolls/RollFormScreen";

/** `/rolls/new` – create a roll. */
export default function NewRollRoute() {
  const { t } = useTranslation("rolls");

  return (
    <>
      <Stack.Screen options={{ title: t("new") }} />
      <RollForm mode="create" />
    </>
  );
}
