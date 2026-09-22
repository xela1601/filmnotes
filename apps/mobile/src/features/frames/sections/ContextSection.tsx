/**
 * Everything around the exposure: support, light, subject, where and when, and the free notes.
 *
 * The date and time fields show the *local* wall clock (`takenAtFields`) and refuse anything the
 * calendar does not have (`parseTakenAt`); the screen above turns an invalid pair into a disabled
 * save button.
 */
import type { Frame, Support } from "@filmnotes/domain";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text } from "react-native";

import { useLabelledOptions } from "./labels";
import { LIGHT_OPTIONS, SUBJECT_OPTIONS, type TakenAt } from "../frameForm";
import { FRAMES_NAMESPACE } from "../i18n";
import { Button, Section, SelectField, TextField, useTheme } from "../../../ui";

/** How the camera was held - the input of the camera-shake rule. */
const SUPPORTS: Support[] = ["handheld", "braced", "tripod", "beanbag"];

export interface ContextSectionProps {
  frame: Frame;
  patch: (changes: Partial<Frame>) => void;
  onLocationName: (name: string) => void;
  onUseCurrentPosition: () => void;
  locating: boolean;
  locationHint: string | null;
  takenDate: string;
  takenTime: string;
  setTakenDate: (value: string) => void;
  setTakenTime: (value: string) => void;
  takenAt: TakenAt;
}

export function ContextSection({
  frame,
  patch,
  onLocationName,
  onUseCurrentPosition,
  locating,
  locationHint,
  takenDate,
  takenTime,
  setTakenDate,
  setTakenTime,
  takenAt,
}: ContextSectionProps) {
  const { t } = useTranslation(FRAMES_NAMESPACE);
  const { palette, fontSize } = useTheme();
  const labelled = useLabelledOptions();

  const coordinates = frame.location;
  // `frame.location` is null for every new frame, and then `coordinates?.lat` is *undefined* -
  // neither null nor a number. Both have to be checked, or this renders "undefined, undefined".
  const hasCoordinates =
    coordinates !== null && coordinates.lat !== null && coordinates.lon !== null;

  const hint = (testID: string, text: string, color: string) => (
    <Text testID={testID} style={[styles.hint, { color, fontSize: fontSize.sm }]}>
      {text}
    </Text>
  );

  return (
    <Section title={t("sections.context")} testID="frame-section-context">
      <SelectField<Support>
        label={t("fields.support")}
        value={frame.support}
        options={labelled(SUPPORTS, "support")}
        onChange={(support) => patch({ support })}
        nullable
        testID="frame-support"
      />
      <SelectField<string>
        label={t("fields.light")}
        value={frame.light}
        options={labelled(LIGHT_OPTIONS, "light")}
        onChange={(light) => patch({ light })}
        nullable
        testID="frame-light"
      />
      <SelectField<string>
        label={t("fields.subject")}
        value={frame.subject}
        options={labelled(SUBJECT_OPTIONS, "subject")}
        onChange={(subject) => patch({ subject })}
        nullable
        testID="frame-subject"
      />
      <TextField
        label={t("fields.locationName")}
        value={frame.location?.name ?? ""}
        onChangeText={onLocationName}
        placeholder={t("placeholders.locationName")}
        testID="frame-location-name"
      />
      <Button
        title={locating ? t("location.locating") : t("location.useCurrent")}
        variant="secondary"
        disabled={locating}
        onPress={onUseCurrentPosition}
        testID="frame-location-button"
      />
      {hasCoordinates &&
        hint(
          "frame-location-coords",
          `${String(coordinates?.lat ?? "")}, ${String(coordinates?.lon ?? "")}`,
          palette.textMuted,
        )}
      {locationHint !== null && hint("frame-location-hint", locationHint, palette.warning)}
      <TextField
        label={t("fields.date")}
        value={takenDate}
        onChangeText={setTakenDate}
        placeholder={t("placeholders.date")}
        testID="frame-taken-date"
      />
      {takenAt.kind === "invalid" &&
        takenAt.field === "date" &&
        hint("frame-taken-date-error", t("errors.date"), palette.danger)}
      <TextField
        label={t("fields.time")}
        value={takenTime}
        onChangeText={setTakenTime}
        placeholder={t("placeholders.time")}
        testID="frame-taken-time"
      />
      {takenAt.kind === "invalid" &&
        takenAt.field === "time" &&
        hint("frame-taken-time-error", t("errors.time"), palette.danger)}
    </Section>
  );
}

const styles = StyleSheet.create({
  hint: { fontWeight: "500" },
});
