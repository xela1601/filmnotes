import { Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";

import { EQUIPMENT_NAMESPACE } from "../../../src/features/equipment/i18n";

import { EquipmentEditRoute } from "../../../src/features/equipment/EquipmentEditScreen";
import { isEquipmentType } from "../../../src/features/equipment/descriptors";

/** `/equipment/<type>/new` – add a piece of equipment of that type. */
export default function NewEquipmentRoute() {
  const { t } = useTranslation(EQUIPMENT_NAMESPACE);
  const { type } = useLocalSearchParams<{ type: string }>();
  const singular = isEquipmentType(type ?? "") ? t(`typesSingular.${type}`) : t("title");

  return (
    <>
      <Stack.Screen options={{ title: t("newTitle", { type: singular }) }} />
      <EquipmentEditRoute type={type} id="new" />
    </>
  );
}
