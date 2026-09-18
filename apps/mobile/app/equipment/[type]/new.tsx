import { Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";

import { EquipmentEditRoute } from "../../../src/features/equipment/EquipmentEditScreen";
import { isEquipmentType } from "../../../src/features/equipment/descriptors";

/** `/equipment/<type>/new` – add a piece of equipment of that type. */
export default function NewEquipmentRoute() {
  const { t } = useTranslation("equipment");
  const { type } = useLocalSearchParams<{ type: string }>();
  const singular = isEquipmentType(type ?? "") ? t(`typesSingular.${type}`) : t("title");

  return (
    <>
      <Stack.Screen options={{ title: t("newTitle", { type: singular }) }} />
      <EquipmentEditRoute type={type} id="new" />
    </>
  );
}
