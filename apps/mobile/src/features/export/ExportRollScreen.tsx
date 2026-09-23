/**
 * Export of a whole roll (spec §3.3, "Export ... roll level multi-select").
 *
 * Only frames whose scan is on the server are offered – the rest has nothing to attach. They are
 * all selected by default, because the usual case after a scan import is "export everything", and
 * the exports run strictly one after the other: a WordPress upload is slow and a share sheet has
 * to be answered before the next one opens. A frame that fails does not stop the run; it ends up
 * in a list under the result.
 */
import type { Id, Roll } from "@filmnotes/domain";
import { listExporters, shareExporter } from "@filmnotes/exporters";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { useShallow } from "zustand/react/shallow";

import { exportErrorReason } from "./exportMessages";
import { isExporterReady, settingsRouteFor } from "./exporterConfig";
import { pairExportableFrames } from "./exportModel";
import { EXPORT_NAMESPACE } from "./i18n";
import { useFrameExporter } from "./useFrameExporter";
import { useEntity, useSettings } from "../../store/hooks";
import { selectFramesForRoll, selectScansForRoll } from "../../store/selectors";
import { useStore } from "../../store/store";
import { Button, EmptyState, Screen, Section, SwitchField, useTheme } from "../../ui";

/** One frame that could not be exported, with the message to show for it. */
interface ExportFailure {
  frameId: Id;
  frameNo: number;
  message: string;
}

export interface ExportRollScreenProps {
  rollId: Id;
}

export function ExportRollScreen({ rollId }: ExportRollScreenProps) {
  const { t } = useTranslation(EXPORT_NAMESPACE);
  const roll = useEntity("rolls", rollId);

  if (roll === undefined || roll.deleted !== null) {
    return (
      <Screen testID="export-roll">
        <EmptyState title={t("rollNotFound")} testID="export-roll-not-found" />
      </Screen>
    );
  }

  return <ExportRoll roll={roll} />;
}

function ExportRoll({ roll }: { roll: Roll }) {
  const { t } = useTranslation(EXPORT_NAMESPACE);
  const { palette, fontSize } = useTheme();
  const settings = useSettings();
  const exportFrame = useFrameExporter();

  // Both selectors build a new array of stable records on every call, so they are
  // shallow-compared; the pairs are derived afterwards, because a selector that returns fresh
  // objects can never compare equal and would re-render for ever.
  const frames = useStore(useShallow((state) => selectFramesForRoll(state, roll.id)));
  const scans = useStore(useShallow((state) => selectScansForRoll(state, roll.id)));
  const exportable = useMemo(() => pairExportableFrames(frames, scans), [frames, scans]);
  const exporters = useMemo(() => listExporters(), []);

  const [exporterId, setExporterId] = useState<string>(shareExporter.id);
  const [selected, setSelected] = useState<Id[]>(() => exportable.map((entry) => entry.frame.id));
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [failures, setFailures] = useState<ExportFailure[]>([]);
  const [result, setResult] = useState<{ ok: number; total: number } | null>(null);

  /** Targets that cannot run yet because something is missing from the settings. */
  const unready = exporters.filter((exporter) => !isExporterReady(exporter, settings));
  const available = (id: string): boolean => !unready.some((exporter) => exporter.id === id);

  const toggle = (frameId: Id, checked: boolean): void => {
    setSelected((current) =>
      checked ? [...current, frameId] : current.filter((id) => id !== frameId),
    );
  };

  const run = async (): Promise<void> => {
    const queue = exportable.filter((entry) => selected.includes(entry.frame.id));
    setRunning(true);
    setDone(0);
    setTotal(queue.length);
    setFailures([]);
    setResult(null);

    const failed: ExportFailure[] = [];
    let finished = 0;
    for (const entry of queue) {
      try {
        await exportFrame({ frame: entry.frame, exporterId });
        finished += 1;
      } catch (caught) {
        failed.push({
          frameId: entry.frame.id,
          frameNo: entry.frame.frameNo,
          message: exportErrorReason(t, caught),
        });
      }
      setDone(finished + failed.length);
    }

    setFailures(failed);
    setResult({ ok: finished, total: queue.length });
    setRunning(false);
  };

  const muted = { color: palette.textMuted, fontSize: fontSize.sm };

  if (exportable.length === 0) {
    return (
      <Screen testID="export-roll">
        <EmptyState title={t("roll.noFrames")} testID="export-roll-no-frames" />
      </Screen>
    );
  }

  return (
    <Screen testID="export-roll">
      <Section title={t("target")}>
        {exporters.map((exporter) => (
          <Button
            key={exporter.id}
            title={t(exporter.nameKey)}
            variant={exporter.id === exporterId ? "primary" : "secondary"}
            disabled={!available(exporter.id) || running}
            onPress={() => setExporterId(exporter.id)}
            testID={`export-target-${exporter.id}`}
          />
        ))}
        {unready.map((exporter) => {
          const route = settingsRouteFor(exporter.id);
          return (
            <View key={exporter.id}>
              <Text testID={`export-${exporter.id}-hint`} style={muted}>
                {t("notConfigured", { target: t(exporter.nameKey) })}
              </Text>
              {route !== null && (
                <Button
                  title={t("configure", { target: t(exporter.nameKey) })}
                  variant="secondary"
                  onPress={() => router.push(route)}
                  testID={`export-configure-${exporter.id}`}
                />
              )}
            </View>
          );
        })}
      </Section>

      <Section title={t("roll.frames")}>
        {exportable.map(({ frame, scan }) => (
          <SwitchField
            key={frame.id}
            label={`#${frame.frameNo} · ${scan.fileName}`}
            value={selected.includes(frame.id)}
            onChange={(checked) => toggle(frame.id, checked)}
            testID={`export-frame-${frame.id}`}
          />
        ))}
        <View style={styles.row}>
          <Button
            title={t("roll.selectAll")}
            variant="secondary"
            onPress={() => setSelected(exportable.map((entry) => entry.frame.id))}
            testID="export-select-all"
          />
          <Button
            title={t("roll.selectNone")}
            variant="secondary"
            onPress={() => setSelected([])}
            testID="export-select-none"
          />
        </View>
      </Section>

      <View style={styles.actions}>
        <Button
          title={t("roll.run", { count: selected.length })}
          onPress={() => void run()}
          disabled={running || selected.length === 0 || !available(exporterId)}
          testID="export-roll-run"
        />
        {running && (
          <Text testID="export-progress" style={{ color: palette.text, fontSize: fontSize.md }}>
            {t("roll.progress", { done, total })}
          </Text>
        )}
        {result !== null && (
          <Text testID="export-roll-result" style={{ color: palette.text, fontSize: fontSize.md }}>
            {t("roll.done", { ok: result.ok, total: result.total })}
          </Text>
        )}
        {failures.length > 0 && (
          <View style={styles.failures}>
            <Text style={{ color: palette.danger, fontSize: fontSize.sm }}>
              {t("roll.failures")}
            </Text>
            {failures.map((failure) => (
              <Text
                key={failure.frameId}
                testID={`export-failure-${failure.frameId}`}
                style={{ color: palette.danger, fontSize: fontSize.sm }}
              >
                {t("roll.failure", { frameNo: failure.frameNo, message: failure.message })}
              </Text>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  actions: { gap: 12 },
  failures: { gap: 4 },
});
