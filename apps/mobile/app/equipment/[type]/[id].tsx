import { Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";

import { EQUIPMENT_NAMESPACE } from "../../../src/features/equipment/i18n";

import { EquipmentEditRoute } from "../../../src/features/equipment/EquipmentEditScreen";
import { isEquipmentType } from "../../../src/features/equipment/descriptors";

/** `/equipment/<type>/<id>` – edit or delete a piece of equipment. */
export default function EditEquipmentRoute() {
  const { t } = useTranslation(EQUIPMENT_NAMESPACE);
  const { type, id } = useLocalSearchParams<{ type: string; id: string }>();
  const singular = isEquipmentType(type ?? "") ? t(`typesSingular.${type}`) : t("title");

  return (
    <>
      <Stack.Screen options={{ title: t("editTitle", { type: singular }) }} />
      <EquipmentEditRoute type={type} id={id} />
    </>
  );
}
