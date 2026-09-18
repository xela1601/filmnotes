/** Focus mode, what the AF lamp said, drive mode and the beep. */
import type { AfResult, Camera, DriveMode, FocusMode, Frame } from "@filmnotes/domain";
import { useTranslation } from "react-i18next";

import { useLabelledOptions } from "./labels";
import { FRAMES_NAMESPACE } from "../i18n";
import { Section, SelectField, SwitchField } from "../../../ui";

/** AF feedback the Minolta gives through its viewfinder lamp. */
const AF_RESULTS: AfResult[] = ["green", "red_blink", "manual"];

export interface FocusSectionProps {
  frame: Frame;
  camera: Camera;
  patch: (changes: Partial<Frame>) => void;
}

export function FocusSection({ frame, camera, patch }: FocusSectionProps) {
  const { t } = useTranslation(FRAMES_NAMESPACE);
  const labelled = useLabelledOptions();

  return (
    <Section title={t("sections.focus")} testID="frame-section-focus">
      <SelectField<FocusMode>
        label={t("fields.focusMode")}
        value={frame.focusMode}
        options={labelled(camera.focusModes, "focusModes")}
        onChange={(focusMode) => patch({ focusMode })}
        nullable
        testID="frame-focus-mode"
      />
      <SelectField<AfResult>
        label={t("fields.afResult")}
        value={frame.afResult}
        options={labelled(AF_RESULTS, "afResults")}
        onChange={(afResult) => patch({ afResult })}
        nullable
        testID="frame-af-result"
      />
      <SelectField<DriveMode>
        label={t("fields.driveMode")}
        value={frame.driveMode}
        options={labelled(camera.driveModes, "driveModes")}
        onChange={(driveMode) => patch({ driveMode })}
        nullable
        testID="frame-drive-mode"
      />
      <SwitchField
        label={t("fields.beepWarning")}
        value={frame.beepWarning}
        onChange={(beepWarning) => patch({ beepWarning })}
        testID="frame-beep-warning"
      />
    </Section>
  );
}
