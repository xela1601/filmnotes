/**
 * The one helper every section of the frame editor needs: option lists whose labels come from the
 * `frames` namespace, e.g. `focusModes.AF` -> "Autofokus".
 */
import { useTranslation } from "react-i18next";

import { FRAMES_NAMESPACE } from "../i18n";
import type { SelectOption } from "../../../ui";

export function useLabelledOptions(): <T extends string>(
  values: readonly T[],
  prefix: string,
) => SelectOption<T>[] {
  const { t } = useTranslation(FRAMES_NAMESPACE);
  return <T extends string>(values: readonly T[], prefix: string) =>
    values.map((value) => ({ value, label: t(`${prefix}.${value}`) }));
}
