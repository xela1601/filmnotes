/** Lens, focal length, filters and the hood - everything in front of the film. */
import type { Filter, Frame, Id, Lens } from "@filmnotes/domain";
import { useTranslation } from "react-i18next";

import { filterOptions, focalLengthOptions } from "../frameForm";
import { FRAMES_NAMESPACE } from "../i18n";
import { MultiSelectField, Section, SelectField, SwitchField } from "../../../ui";

export interface OpticsSectionProps {
  frame: Frame;
  lens: Lens | null;
  lenses: Lens[];
  allFilters: Filter[];
  patch: (changes: Partial<Frame>) => void;
  onLensChange: (lensId: Id | null) => void;
}

export function OpticsSection({
  frame,
  lens,
  lenses,
  allFilters,
  patch,
  onLensChange,
}: OpticsSectionProps) {
  const { t } = useTranslation(FRAMES_NAMESPACE);

  return (
    <Section title={t("sections.optics")} testID="frame-section-optics">
      <SelectField<Id>
        label={t("fields.lens")}
        value={frame.lensId}
        options={lenses.map((candidate) => ({ value: candidate.id, label: candidate.model }))}
        onChange={onLensChange}
        nullable
        testID="frame-lens"
      />
      <SelectField<number>
        label={t("fields.focalLength")}
        value={frame.focalLengthMm}
        options={focalLengthOptions(lens).map((value) => ({ value, label: `${value} mm` }))}
        onChange={(focalLengthMm) => patch({ focalLengthMm })}
        nullable
        testID="frame-focal-length"
      />
      <MultiSelectField<Id>
        label={t("fields.filters")}
        values={frame.filterIds}
        options={filterOptions(allFilters, lens).map((filter) => ({
          value: filter.id,
          label: filter.model,
        }))}
        onChange={(filterIds) => patch({ filterIds })}
        testID="frame-filters"
      />
      {lens?.hasHood === true && (
        <SwitchField
          label={t("fields.lensHood")}
          value={frame.lensHood}
          onChange={(lensHood) => patch({ lensHood })}
          testID="frame-lens-hood"
        />
      )}
    </Section>
  );
}
