/**
 * WordPress credentials for the export (spec §3.5).
 *
 * Only the blog address and the user name go into the persisted store; the application password
 * is a secret and lives in `src/lib/secureStore.ts`. "Test connection" asks the REST API who it
 * thinks we are, which is the cheapest call that really requires authentication – a wrong
 * password is found here instead of halfway through an export.
 */
import { basicAuthHeader } from "@filmnotes/exporters";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { EXPORT_NAMESPACE } from "./i18n";
import { getSecret, setSecret } from "../../lib/secureStore";
import { useStore } from "../../store/store";
import { Button, Screen, Section, TextField, useTheme } from "../../ui";

/** The fields of `/wp-json/wp/v2/users/me` this screen looks at. */
interface WordPressUser {
  name?: string | null;
  slug?: string | null;
}

/** Drops trailing slashes so `${base}/wp-json/...` never contains a double slash. */
function normaliseSiteUrl(siteUrl: string): string {
  return siteUrl.trim().replace(/\/+$/, "");
}

/** The `message` of a WordPress REST error, or the raw body when it is not JSON. */
function errorMessageOf(body: string, status: number): string {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed === "object" && parsed !== null && "message" in parsed) {
      const message = parsed.message;
      if (typeof message === "string" && message !== "") return message;
    }
  } catch {
    // WordPress also answers with plain text or HTML, e.g. from behind a proxy.
  }
  return body === "" ? `HTTP ${status}` : body;
}

export function WordPressSettingsScreen() {
  const { t } = useTranslation(EXPORT_NAMESPACE);
  const { palette, fontSize } = useTheme();
  const settings = useStore((state) => state.settings);
  const updateSettings = useStore((state) => state.updateSettings);

  const [siteUrl, setSiteUrl] = useState(settings.wordpressSiteUrl ?? "");
  const [username, setUsername] = useState(settings.wordpressUsername ?? "");
  const [appPassword, setAppPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  // The secret is not part of the store, so it is read once when the screen opens.
  useEffect(() => {
    let active = true;
    void getSecret("wordpressAppPassword").then((stored) => {
      if (active && stored !== null) setAppPassword(stored);
    });
    return () => {
      active = false;
    };
  }, []);

  const configured = settings.wordpressSiteUrl !== null && settings.wordpressUsername !== null;

  /** The three values an export needs, or null when the user has not filled them in. */
  const credentials = (): { siteUrl: string; username: string; appPassword: string } | null => {
    const base = normaliseSiteUrl(siteUrl);
    const user = username.trim();
    if (base === "" || user === "" || appPassword === "") return null;
    return { siteUrl: base, username: user, appPassword };
  };

  const save = async (): Promise<void> => {
    const entered = credentials();
    if (entered === null) {
      setMessage(null);
      setError(t("wordpress.missingFields"));
      return;
    }

    await setSecret("wordpressAppPassword", entered.appPassword);
    updateSettings({
      wordpressSiteUrl: entered.siteUrl,
      wordpressUsername: entered.username,
    });
    setSiteUrl(entered.siteUrl);
    setUsername(entered.username);
    setError(null);
    setMessage(t("wordpress.saved"));
  };

  const clear = async (): Promise<void> => {
    await setSecret("wordpressAppPassword", null);
    updateSettings({ wordpressSiteUrl: null, wordpressUsername: null });
    setSiteUrl("");
    setUsername("");
    setAppPassword("");
    setError(null);
    setMessage(null);
  };

  const test = async (): Promise<void> => {
    const entered = credentials();
    if (entered === null) {
      setMessage(null);
      setError(t("wordpress.missingFields"));
      return;
    }

    setTesting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`${entered.siteUrl}/wp-json/wp/v2/users/me`, {
        method: "GET",
        headers: { Authorization: basicAuthHeader(entered.username, entered.appPassword) },
      });
      if (!response.ok) {
        setError(
          t("wordpress.testFailed", {
            message: errorMessageOf(await response.text(), response.status),
          }),
        );
        return;
      }
      const user = (await response.json()) as WordPressUser;
      setMessage(t("wordpress.testOk", { name: user.name ?? user.slug ?? entered.username }));
    } catch (caught) {
      setError(
        t("wordpress.testFailed", {
          message: caught instanceof Error ? caught.message : String(caught),
        }),
      );
    } finally {
      setTesting(false);
    }
  };

  const muted = { color: palette.textMuted, fontSize: fontSize.sm };

  return (
    <Screen testID="wordpress-settings-screen">
      <Section title={t("wordpress.credentials")}>
        <Text testID="wordpress-status" style={muted}>
          {configured
            ? t("wordpress.configuredAs", { username: settings.wordpressUsername ?? "" })
            : t("wordpress.notConfigured")}
        </Text>

        <TextField
          label={t("wordpress.siteUrl")}
          value={siteUrl}
          onChangeText={setSiteUrl}
          placeholder={t("wordpress.siteUrlPlaceholder")}
          testID="wordpress-site-url"
        />
        <TextField
          label={t("wordpress.username")}
          value={username}
          onChangeText={setUsername}
          testID="wordpress-username"
        />
        <TextField
          label={t("wordpress.appPassword")}
          value={appPassword}
          onChangeText={setAppPassword}
          testID="wordpress-app-password"
          secret
        />
        <Text style={muted}>{t("wordpress.appPasswordHint")}</Text>

        <View style={styles.row}>
          <Button title={t("wordpress.save")} onPress={() => void save()} testID="wordpress-save" />
          <Button
            title={testing ? t("wordpress.testing") : t("wordpress.test")}
            variant="secondary"
            onPress={() => void test()}
            disabled={testing}
            testID="wordpress-test"
          />
        </View>

        {message !== null && (
          <Text testID="wordpress-message" style={{ color: palette.text, fontSize: fontSize.sm }}>
            {message}
          </Text>
        )}
        {error !== null && (
          <Text testID="wordpress-error" style={{ color: palette.danger, fontSize: fontSize.sm }}>
            {error}
          </Text>
        )}

        <Text style={muted}>{t("wordpress.draftsOnly")}</Text>

        <Button
          title={t("wordpress.clear")}
          variant="danger"
          onPress={() => void clear()}
          testID="wordpress-clear"
        />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
});
