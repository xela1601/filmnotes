/** The flash unit and, once one is chosen, how it was set up. */
import type { Flash, FlashHead, Frame, Id } from "@filmnotes/domain";
import { useTranslation } from "react-i18next";

import { useLabelledOptions } from "./labels";
import { FRAMES_NAMESPACE } from "../i18n";
import { Section, SelectField, SwitchField } from "../../../ui";

export interface FlashSectionProps {
  frame: Frame;
  flash: Flash | null;
  flashes: Flash[];
  patch: (changes: Partial<Frame>) => void;
  onFlashChange: (flashId: Id | null) => void;
}

export function FlashSection({ frame, flash, flashes, patch, onFlashChange }: FlashSectionProps) {
  const { t } = useTranslation(FRAMES_NAMESPACE);
  const labelled = useLabelledOptions();

  return (
    <Section title={t("sections.flash")} testID="frame-section-flash">
      <SelectField<Id>
        label={t("fields.flash")}
        value={frame.flashId}
        options={flashes.map((candidate) => ({ value: candidate.id, label: candidate.model }))}
        onChange={onFlashChange}
        nullable
        testID="frame-flash"
      />
      {flash !== null && (
        <>
          <SelectField<FlashHead>
            label={t("fields.flashHead")}
            value={frame.flashHead}
            options={labelled(flash.headPositions, "flashHeads")}
            onChange={(flashHead) => patch({ flashHead })}
            nullable
            testID="frame-flash-head"
          />
          <SelectField<string>
            label={t("fields.flashPower")}
            value={frame.flashPower}
            options={flash.powerLevels.map((level) => ({ value: level, label: level }))}
            onChange={(flashPower) => patch({ flashPower })}
            nullable
            testID="frame-flash-power"
          />
          <SwitchField
            label={t("fields.flashOk")}
            value={frame.flashOk === true}
            onChange={(flashOk) => patch({ flashOk })}
            testID="frame-flash-ok"
          />
        </>
      )}
    </Section>
  );
}
