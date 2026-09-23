/**
 * Export of a single frame (spec §2.1 step 6): pick a target, check the caption, send.
 *
 * The caption is prefilled from the settings template and stays editable, because the last
 * wording of a post is a decision no template makes. A frame without an uploaded scan can still
 * be exported – the caption alone is useful, and the scans often arrive weeks after the notes.
 */
import type { Frame, Id } from "@filmnotes/domain";
import { listExporters, shareExporter } from "@filmnotes/exporters";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, StyleSheet, Text, View } from "react-native";
import { useShallow } from "zustand/react/shallow";

import { exportErrorMessage, formatTime, targetLabel } from "./exportMessages";
import { isExporterReady, settingsRouteFor } from "./exporterConfig";
import { captionFor, selectExportLogsForFrame } from "./exportModel";
import { EXPORT_NAMESPACE } from "./i18n";
import { useFrameExporter } from "./useFrameExporter";
import { selectScanForFrame } from "../../store/selectors";
import { useEntity, useSettings } from "../../store/hooks";
import { useStore } from "../../store/store";
import { Button, EmptyState, ListItem, Screen, Section, TextField, useTheme } from "../../ui";

export interface ExportFrameScreenProps {
  frameId: Id;
}

export function ExportFrameScreen({ frameId }: ExportFrameScreenProps) {
  const { t } = useTranslation(EXPORT_NAMESPACE);
  const frame = useEntity("frames", frameId);

  if (frame === undefined || frame.deleted !== null) {
    return (
      <Screen testID="export-frame">
        <EmptyState
          title={t("frameNotFound")}
          hint={t("frameNotFoundHint")}
          testID="export-frame-not-found"
        />
      </Screen>
    );
  }

  return <ExportFrame frame={frame} />;
}

function ExportFrame({ frame }: { frame: Frame }) {
  const { t, i18n } = useTranslation(EXPORT_NAMESPACE);
  const { palette, fontSize } = useTheme();
  const settings = useSettings();
  const exportFrame = useFrameExporter();

  // The registry is filled when @filmnotes/exporters is imported and never changes afterwards.
  const exporters = useMemo(() => listExporters(), []);
  const [exporterId, setExporterId] = useState<string>(shareExporter.id);

  const builtCaption = useStore((state) => captionFor(state, frame));
  const [caption, setCaption] = useState(builtCaption ?? "");
  const scan = useStore((state) => selectScanForFrame(state, frame.id));
  // Shallow-compared: the selector builds a new array on every call.
  const logs = useStore(useShallow((state) => selectExportLogsForFrame(state, frame.id)));

  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  /** Targets that cannot run yet because something is missing from the settings. */
  const unready = exporters.filter((exporter) => !isExporterReady(exporter, settings));
  const available = (id: string): boolean => !unready.some((exporter) => exporter.id === id);

  // Scan files live on the server, so without one there is nothing to attach.
  const hasImage = scan !== null && scan.file !== null && settings.serverUrl !== null;

  const run = async (): Promise<void> => {
    setRunning(true);
    setMessage(null);
    setError(null);
    setLink(null);
    try {
      const result = await exportFrame({ frame, exporterId, caption });
      setLink(result.url);
      setMessage(result.sharePayload === null ? t("exported") : t("shared"));
    } catch (caught) {
      setError(exportErrorMessage(t, caught));
    } finally {
      setRunning(false);
    }
  };

  const muted = { color: palette.textMuted, fontSize: fontSize.sm };

  return (
    <Screen testID="export-frame">
      <Section title={t("target")}>
        {exporters.map((exporter) => (
          <Button
            key={exporter.id}
            title={t(exporter.nameKey)}
            variant={exporter.id === exporterId ? "primary" : "secondary"}
            disabled={!available(exporter.id)}
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

      <Section title={t("image")}>
        <Text testID="export-image" style={muted}>
          {hasImage && scan !== null ? t("withImage", { fileName: scan.fileName }) : t("noImage")}
        </Text>
      </Section>

      <Section title={t("caption")}>
        {builtCaption === null ? (
          <Text
            testID="export-caption-missing"
            style={{ color: palette.danger, fontSize: fontSize.sm }}
          >
            {t("captionMissing")}
          </Text>
        ) : (
          <>
            <TextField
              label={t("caption")}
              value={caption}
              onChangeText={setCaption}
              multiline
              testID="export-caption"
            />
            <Text style={muted}>{t("captionHint")}</Text>
          </>
        )}
      </Section>

      <View style={styles.actions}>
        <Button
          title={running ? t("running") : t("run")}
          onPress={() => void run()}
          disabled={running || builtCaption === null || !available(exporterId)}
          testID="export-run"
        />
        {message !== null && (
          <Text testID="export-message" style={{ color: palette.text, fontSize: fontSize.sm }}>
            {message}
          </Text>
        )}
        {link !== null && (
          <Button
            title={t("openPost")}
            variant="secondary"
            onPress={() => void Linking.openURL(link)}
            testID="export-open-post"
          />
        )}
        {error !== null && (
          <Text testID="export-error" style={{ color: palette.danger, fontSize: fontSize.sm }}>
            {error}
          </Text>
        )}
      </View>

      <Section title={t("previous")}>
        {logs.length === 0 ? (
          <Text testID="export-no-previous" style={muted}>
            {t("noPrevious")}
          </Text>
        ) : (
          logs.map((log) => (
            <ListItem
              key={log.id}
              testID={`export-log-${log.id}`}
              title={targetLabel(t, log.target)}
              subtitle={formatTime(log.exportedAt, i18n.language)}
              onPress={log.url === null ? undefined : () => void Linking.openURL(log.url ?? "")}
            />
          ))
        )}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 12 },
});
