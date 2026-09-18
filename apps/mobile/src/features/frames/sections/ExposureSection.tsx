/**
 * Mode, time, aperture and the two automation helpers.
 *
 * Shutter and aperture are always shown: in P and A the camera picks the time, in P and S the
 * aperture, and *reading that off the camera and writing it down* is what the app is for. The
 * label says who chose the value (see `exposureFields`).
 */
import { apertureValuesForLens, shutterSpeedsForMode } from "@filmnotes/domain";
import type { Camera, ExposureMode, Frame, Lens, ShutterSpeed } from "@filmnotes/domain";
import { useTranslation } from "react-i18next";

import { exposureFields, type SetBy } from "../frameForm";
import { FRAMES_NAMESPACE } from "../i18n";
import { NumberField, Section, SelectField, SwitchField } from "../../../ui";

export interface ExposureSectionProps {
  frame: Frame;
  camera: Camera;
  lens: Lens | null;
  patch: (changes: Partial<Frame>) => void;
}

export function ExposureSection({ frame, camera, lens, patch }: ExposureSectionProps) {
  const { t } = useTranslation(FRAMES_NAMESPACE);
  const exposure = exposureFields(frame.exposureMode);

  /** "Zeit" or "Zeit · von der Kamera gewählt". */
  const fieldLabel = (field: "shutter" | "aperture", setBy: SetBy): string =>
    setBy === "camera"
      ? `${t(`fields.${field}`)} · ${t("fields.chosenByCamera")}`
      : t(`fields.${field}`);

  return (
    <Section title={t("sections.exposure")} testID="frame-section-exposure">
      <SelectField<ExposureMode>
        label={t("fields.mode")}
        value={frame.exposureMode}
        options={camera.exposureModes.map((mode) => ({ value: mode, label: mode }))}
        onChange={(mode) => patch({ exposureMode: mode })}
        nullable
        testID="frame-mode"
      />
      <SelectField<ShutterSpeed>
        label={fieldLabel("shutter", exposure.shutter)}
        value={frame.shutterSpeed}
        options={shutterSpeedsForMode(camera, frame.exposureMode).map((speed) => ({
          value: speed,
          label: speed,
        }))}
        onChange={(speed) => patch({ shutterSpeed: speed })}
        nullable
        testID="frame-shutter"
      />
      <SelectField<number>
        label={fieldLabel("aperture", exposure.aperture)}
        value={frame.aperture}
        options={apertureValuesForLens(lens).map((value) => ({ value, label: `f/${value}` }))}
        onChange={(aperture) => patch({ aperture })}
        nullable
        testID="frame-aperture"
      />
      {exposure.compensation && (
        <NumberField
          label={t("fields.compensation")}
          value={frame.exposureCompensationEv}
          onChange={(value) => patch({ exposureCompensationEv: value ?? 0 })}
          step={camera.exposureCompensation.step}
          min={camera.exposureCompensation.min}
          max={camera.exposureCompensation.max}
          testID="frame-compensation"
        />
      )}
      {exposure.programShift && (
        <SwitchField
          label={t("fields.programShift")}
          value={frame.programShift}
          onChange={(programShift) => patch({ programShift })}
          testID="frame-program-shift"
        />
      )}
      <SwitchField
        label={t("fields.aeLock")}
        value={frame.aeLock}
        onChange={(aeLock) => patch({ aeLock })}
        testID="frame-ae-lock"
      />
    </Section>
  );
}
