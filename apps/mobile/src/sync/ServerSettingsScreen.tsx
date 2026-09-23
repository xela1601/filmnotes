/**
 * Settings screen for the optional PocketBase server: address, login, manual sync.
 *
 * The app is fully usable without a server, so nothing here is required. Credentials go
 * into secure storage (`src/lib/secureStore.ts`); only the URL and the email address are
 * kept in the persisted store.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { createPocketBaseClient } from "./client";
import { SYNC_NAMESPACE } from "./i18n";
import { useSync } from "./useSync";
import { setSecret } from "../lib/secureStore";
import { useStore } from "../store/store";
import { Button, Screen, Section, TextField, spacing, useTheme } from "../ui";

/** Formats the last sync timestamp in the device's own format. */
function formatTime(iso: string, language: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(language);
}

export function ServerSettingsScreen() {
  const { t, i18n } = useTranslation(SYNC_NAMESPACE);
  const { palette, fontSize } = useTheme();
  const settings = useStore((state) => state.settings);
  const lastSyncAt = useStore((state) => state.lastSyncAt);
  const updateSettings = useStore((state) => state.updateSettings);
  const setLastSyncAt = useStore((state) => state.setLastSyncAt);
  const { status, lastResult, syncNow, isConfigured } = useSync();

  const [url, setUrl] = useState(settings.serverUrl ?? "");
  const [email, setEmail] = useState(settings.serverEmail ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const connect = async (): Promise<void> => {
    const trimmedUrl = url.trim();
    const trimmedEmail = email.trim();
    if (trimmedUrl === "" || trimmedEmail === "" || password === "") {
      setError(t("missingFields"));
      return;
    }

    setConnecting(true);
    setError(null);
    try {
      const auth = await createPocketBaseClient(trimmedUrl).authWithPassword(
        trimmedEmail,
        password,
      );
      await setSecret("serverToken", auth.token);
      // Kept so a sync can log in again once the token has expired.
      await setSecret("serverPassword", password);
      updateSettings({ serverUrl: trimmedUrl, serverEmail: trimmedEmail });
      setPassword("");
    } catch {
      setError(t("connectFailed"));
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async (): Promise<void> => {
    await setSecret("serverToken", null);
    await setSecret("serverPassword", null);
    updateSettings({ serverUrl: null, serverEmail: null });
    // A later connection may point at a different server, so the watermark goes too.
    setLastSyncAt(null);
    setPassword("");
    setError(null);
  };

  const muted = { color: palette.textMuted, fontSize: fontSize.sm };

  return (
    <Screen title={t("server")} testID="server-settings-screen">
      <Section title={t("connection")}>
        {isConfigured ? (
          <Text testID="sync-connected" style={{ color: palette.text, fontSize: fontSize.md }}>
            {t("connectedAs", { email: settings.serverEmail ?? "" })}
          </Text>
        ) : (
          <Text testID="sync-disconnected" style={muted}>
            {t("notConnected")}
          </Text>
        )}

        <TextField
          label={t("url")}
          value={url}
          onChangeText={setUrl}
          placeholder={t("urlPlaceholder")}
          testID="sync-url"
        />
        <TextField label={t("email")} value={email} onChangeText={setEmail} testID="sync-email" />
        <TextField
          label={t("password")}
          value={password}
          onChangeText={setPassword}
          secret
          testID="sync-password"
        />

        <View style={styles.row}>
          <Button
            title={t("connect")}
            onPress={() => void connect()}
            disabled={connecting}
            testID="sync-connect"
          />
          {isConfigured && (
            <Button
              title={t("disconnect")}
              variant="secondary"
              onPress={() => void disconnect()}
              testID="sync-disconnect"
            />
          )}
        </View>

        {error !== null && (
          <Text testID="sync-error" style={{ color: palette.danger, fontSize: fontSize.sm }}>
            {error}
          </Text>
        )}
      </Section>

      {isConfigured && (
        <Section title={t("syncNow")}>
          <Button
            title={status === "running" ? t("syncing") : t("syncNow")}
            onPress={() => void syncNow()}
            disabled={status === "running"}
            testID="sync-now"
          />

          <Text testID="sync-last" style={muted}>
            {t("lastSync", {
              time: lastSyncAt === null ? t("never") : formatTime(lastSyncAt, i18n.language),
            })}
          </Text>

          {lastResult !== null && (
            <View style={styles.summary}>
              <Text testID="sync-result" style={muted}>
                {t("result", { pushed: lastResult.pushed, pulled: lastResult.pulled })}
              </Text>
              {lastResult.conflictsLocalWon > 0 && (
                <Text testID="sync-conflicts" style={muted}>
                  {t("conflictsLocalWon", { count: lastResult.conflictsLocalWon })}
                </Text>
              )}
              {lastResult.conflictsRemoteWon > 0 && (
                <Text testID="sync-conflicts-remote" style={muted}>
                  {t("conflictsRemoteWon", { count: lastResult.conflictsRemoteWon })}
                </Text>
              )}
              {lastResult.errors.length > 0 && (
                <Text testID="sync-failed" style={{ color: palette.danger, fontSize: fontSize.sm }}>
                  {t("syncFailed")}
                </Text>
              )}
            </View>
          )}
        </Section>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.md, flexWrap: "wrap" },
  summary: { gap: spacing.xs },
});
