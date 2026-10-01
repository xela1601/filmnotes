import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

import { ServerSettingsScreen } from "../../src/sync/ServerSettingsScreen";

/** `/settings/server` – where the app syncs to. Without a title the header showed the route. */
export default function ServerSettingsRoute() {
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen options={{ title: t("settings.server") }} />
      <ServerSettingsScreen />
    </>
  );
}
