/**
 * The free-form note - the one field that is different for every single frame.
 *
 * Its own section, right under the exposure and above the hints, because it is the thing the
 * photographer actually came to write; everything else the app can carry over for him.
 */
import type { Frame } from "@filmnotes/domain";
import { useTranslation } from "react-i18next";

import { FRAMES_NAMESPACE } from "../i18n";
import { Section, TextField } from "../../../ui";

export interface NotesSectionProps {
  frame: Frame;
  patch: (changes: Partial<Frame>) => void;
}

export function NotesSection({ frame, patch }: NotesSectionProps) {
  const { t } = useTranslation(FRAMES_NAMESPACE);

  return (
    <Section title={t("sections.notes")} testID="frame-section-notes">
      <TextField
        label={t("fields.notes")}
        value={frame.notes}
        onChangeText={(notes) => patch({ notes })}
        placeholder={t("placeholders.notes")}
        multiline
        testID="frame-notes"
      />
    </Section>
  );
}
