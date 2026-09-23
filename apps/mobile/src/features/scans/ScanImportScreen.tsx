/**
 * Scan import and review: spec §2.1 step 5 and §3.3.
 *
 * The lab hands the developed roll back as a folder of images or one ZIP. The files are
 * matched to the recorded frames by natural filename order, the photographer corrects the
 * mapping next to their own frame notes, and only then is anything uploaded.
 *
 * Import needs a configured server, because the image files are stored there and never on
 * the device; without one the screen explains that and links to the server settings.
 */
import { naturalCompare } from "@filmnotes/domain";
import type { Frame, Id, Roll, RollStatus, ScanAssignment } from "@filmnotes/domain";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { StyleSheet, Text, View } from "react-native";
import { useShallow } from "zustand/react/shallow";

import { SCANS_NAMESPACE } from "./i18n";
import { assignTo, buildAssignments, moveAssignment } from "./importModel";
import { expandZip, isZip, pickScanFiles, type PickedFile } from "./pickScans";
import { openServerSession } from "../../sync/session";
import { uploadScans, type FailedUpload, type UploadScansResult } from "./uploadScans";
import { now } from "../../lib/clock";
import { useEntity } from "../../store/hooks";
import { selectFramesForRoll, selectScansForRoll } from "../../store/selectors";
import { useStore } from "../../store/store";
import {
  Button,
  EmptyState,
  Screen,
  Section,
  SelectField,
  radius,
  spacing,
  useTheme,
  type SelectOption,
} from "../../ui";

/** Scans arriving means the lab is done, so these states move on to `developed`. */
const AWAITING_SCANS: RollStatus[] = ["shot", "at_lab"];

export interface ScanImportScreenProps {
  rollId: Id;
}

export function ScanImportScreen({ rollId }: ScanImportScreenProps) {
  const { t } = useTranslation(SCANS_NAMESPACE);
  const roll = useEntity("rolls", rollId);

  if (roll === undefined || roll.deleted !== null) {
    return (
      <Screen testID="scan-import">
        <EmptyState title={t("notFound")} hint={t("notFoundHint")} testID="scan-import-not-found" />
      </Screen>
    );
  }

  return <ScanImport roll={roll} />;
}

/**
 * One line per file that did not make it, with the reason.
 *
 * A bare list of names is what the import used to show for everything from a rejected HEIC to a
 * dropped connection - the format rejection in particular is documented behaviour that the user
 * had no way of recognising.
 */
function failureText(t: TFunction, failure: FailedUpload): string {
  if (failure.reason === "unsupported_format") {
    return t("failureReason_unsupported_format", { file: failure.name, detail: failure.detail });
  }
  return failure.detail === null
    ? t("failureReason_upload_failed_plain", { file: failure.name })
    : t("failureReason_upload_failed", { file: failure.name, detail: failure.detail });
}

function ScanImport({ roll }: { roll: Roll }) {
  const { t } = useTranslation(SCANS_NAMESPACE);
  const { palette, fontSize } = useTheme();
  const serverUrl = useStore((state) => state.settings.serverUrl);
  // Shallow-compared: the selector builds a new array on every call.
  const frames = useStore(useShallow((state) => selectFramesForRoll(state, roll.id)));
  const rollScans = useStore(useShallow((state) => selectScansForRoll(state, roll.id)));
  const upsert = useStore((state) => state.upsert);

  /** The picked files in natural name order, so index == `ScanAssignment.sortIndex`. */
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [assignments, setAssignments] = useState<ScanAssignment[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadScansResult | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      [...assignments]
        .sort((a, b) => a.sortIndex - b.sortIndex)
        .flatMap((assignment) => {
          const file = files[assignment.sortIndex];
          return file === undefined ? [] : [{ assignment, file }];
        }),
    [assignments, files],
  );

  const pick = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const picked = await pickScanFiles();
      // A cancelled picker keeps whatever the review already holds.
      if (picked.length === 0) return;

      const expanded: PickedFile[] = [];
      for (const file of picked) {
        if (isZip(file)) expanded.push(...(await expandZip(file)));
        else expanded.push(file);
      }
      expanded.sort((a, b) => naturalCompare(a.name, b.name));

      setFiles(expanded);
      setAssignments(buildAssignments(expanded, frames));
      setResult(null);
      setAdvanced(false);
    } catch {
      setError(t("pickFailed"));
    } finally {
      setBusy(false);
    }
  };

  const upload = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const session = await openServerSession();
      if (session === null) {
        setError(t("needCredentials"));
        return;
      }

      const outcome = await uploadScans({
        client: session.client,
        ownerId: session.ownerId,
        rollId: roll.id,
        files,
        assignments,
        upsert,
        now,
        // Lets a second press retry the failures instead of duplicating what already worked.
        existingScans: rollScans,
      });
      setResult(outcome);

      if (outcome.uploaded > 0 && AWAITING_SCANS.includes(roll.status)) {
        upsert("rolls", { ...roll, status: "developed" });
        setAdvanced(true);
      }
    } catch {
      setError(t("uploadFailed"));
    } finally {
      setBusy(false);
    }
  };

  if (serverUrl === null) {
    return (
      <Screen testID="scan-import">
        <EmptyState
          title={t("needServer")}
          hint={t("needServerHint")}
          testID="scan-import-need-server"
        />
        <Button
          title={t("openServerSettings")}
          onPress={() => router.push("/settings/server")}
          testID="scan-import-server-link"
        />
      </Screen>
    );
  }

  const muted = { color: palette.textMuted, fontSize: fontSize.sm };

  return (
    <Screen testID="scan-import">
      {frames.length === 0 && (
        <EmptyState title={t("noFrames")} hint={t("noFramesHint")} testID="scan-import-no-frames" />
      )}

      <Section title={t("sections.files")}>
        {rows.length === 0 ? (
          <EmptyState title={t("empty")} hint={t("emptyHint")} testID="scan-import-empty" />
        ) : (
          rows.map(({ assignment, file }) => (
            <ScanRow
              key={assignment.sortIndex}
              file={file}
              assignment={assignment}
              frames={frames}
              onMove={(direction) =>
                setAssignments((current) =>
                  moveAssignment(current, frames, assignment.sortIndex, direction),
                )
              }
              onAssign={(frameId) =>
                setAssignments((current) =>
                  assignTo(current, frames, assignment.sortIndex, frameId),
                )
              }
            />
          ))
        )}
        <Button
          title={rows.length === 0 ? t("pick") : t("pickAgain")}
          onPress={() => void pick()}
          disabled={busy}
          testID="scan-import-pick"
        />
      </Section>

      {rows.length > 0 && (
        <Section title={t("sections.upload")}>
          <Text testID="scan-import-count" style={muted}>
            {t("fileCount", { count: rows.length })}
          </Text>
          <Button
            title={busy ? t("uploading") : t("upload")}
            onPress={() => void upload()}
            disabled={busy}
            testID="scan-import-upload"
          />
          {result !== null && (
            <View style={styles.summary}>
              <Text
                testID="scan-import-result"
                style={{ color: palette.text, fontSize: fontSize.md }}
              >
                {t("result", { uploaded: result.uploaded, total: rows.length })}
              </Text>
              {result.skipped > 0 && (
                <Text testID="scan-import-skipped" style={muted}>
                  {t("resultSkipped", { count: result.skipped })}
                </Text>
              )}
              {result.failed.length > 0 && (
                <View testID="scan-import-failed">
                  <Text style={{ color: palette.danger, fontSize: fontSize.sm }}>
                    {t("resultFailed")}
                  </Text>
                  {result.failed.map((failure) => (
                    <Text
                      key={failure.name}
                      testID={`scan-import-failed-${failure.name}`}
                      style={{ color: palette.danger, fontSize: fontSize.sm }}
                    >
                      {failureText(t, failure)}
                    </Text>
                  ))}
                </View>
              )}
              {advanced && (
                <Text testID="scan-import-status" style={muted}>
                  {t("statusAdvanced")}
                </Text>
              )}
            </View>
          )}
        </Section>
      )}

      {error !== null && (
        <Text testID="scan-import-error" style={{ color: palette.danger, fontSize: fontSize.sm }}>
          {error}
        </Text>
      )}
    </Screen>
  );
}

interface ScanRowProps {
  file: PickedFile;
  assignment: ScanAssignment;
  frames: Frame[];
  onMove: (direction: 1 | -1) => void;
  onAssign: (frameId: Id | null) => void;
}

/** One file next to the frame it would go onto, with the corrections for that pair. */
function ScanRow({ file, assignment, frames, onMove, onAssign }: ScanRowProps) {
  const { t } = useTranslation(SCANS_NAMESPACE);
  const { palette, fontSize } = useTheme();
  const testID = `scan-row-${assignment.sortIndex}`;

  const frame = frames.find((candidate) => candidate.id === assignment.frameId);
  const summary =
    frame === undefined
      ? t("unassigned")
      : [t("assignedTo", { frameNo: frame.frameNo }), frame.notes]
          .filter((part) => part !== "")
          .join(" · ");

  const options: SelectOption<string>[] = frames.map((candidate) => ({
    value: candidate.id,
    label: t("frameOption", { frameNo: candidate.frameNo }),
  }));

  return (
    <View testID={testID} style={[styles.row, { borderColor: palette.border }]}>
      <Image
        testID={`${testID}-thumb`}
        source={{ uri: file.uri }}
        contentFit="cover"
        style={styles.thumb}
      />
      <View style={styles.body}>
        <Text
          testID={`${testID}-name`}
          numberOfLines={1}
          style={[styles.name, { color: palette.text, fontSize: fontSize.md }]}
        >
          {file.name}
        </Text>
        <Text
          testID={`${testID}-frame-summary`}
          numberOfLines={2}
          style={{ color: palette.textMuted, fontSize: fontSize.sm }}
        >
          {summary}
        </Text>
        <SelectField
          label={t("frameField")}
          value={assignment.frameId}
          options={options}
          onChange={onAssign}
          nullable
          testID={`${testID}-frame`}
        />
      </View>
      <View style={styles.controls}>
        <Button
          title={t("controls.up")}
          variant="secondary"
          onPress={() => onMove(-1)}
          testID={`${testID}-up`}
        />
        <Button
          title={t("controls.down")}
          variant="secondary"
          onPress={() => onMove(1)}
          testID={`${testID}-down`}
        />
        <Button
          title={t("controls.unassign")}
          variant="secondary"
          onPress={() => onAssign(null)}
          testID={`${testID}-unassign`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 72, height: 72, borderRadius: radius.sm },
  body: { flex: 1, gap: spacing.xs },
  name: { fontWeight: "600" },
  controls: { gap: spacing.xs },
  summary: { gap: spacing.xs },
});
