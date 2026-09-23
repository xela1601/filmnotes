import Constants from "expo-constants";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text } from "react-native";

import { SUPPORTED_LANGUAGES, setAppLanguage, type LocaleSetting } from "../../src/i18n";
import { confirmDestructive } from "../../src/lib/confirm";
import { useStore } from "../../src/store/store";
import {
  Button,
  ListItem,
  Screen,
  Section,
  SelectField,
  THEMES,
  THEME_IDS,
  useTheme,
  type SelectOption,
  type ThemeId,
} from "../../src/ui";

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { palette, fontSize } = useTheme();
  const locale = useStore((state) => state.settings.locale);
  const themeId = useStore((state) => state.settings.themeId);
  const updateSettings = useStore((state) => state.updateSettings);
  const resetAll = useStore((state) => state.resetAll);

  // Derived from SUPPORTED_LANGUAGES, like the theme list below: a language added to the
  // resource table has to appear here by existing, not by someone remembering this screen.
  const languageOptions: SelectOption<LocaleSetting>[] = [
    { value: "system", label: t("settings.languages.system") },
    ...SUPPORTED_LANGUAGES.map((language) => ({
      value: language,
      label: t(`settings.languages.${language}`),
    })),
  ];

  // Built from THEME_IDS rather than listed here, so a new theme appears by existing.
  const themeOptions: SelectOption<ThemeId>[] = THEME_IDS.map((id) => ({
    value: id,
    label: t(THEMES[id].nameKey),
  }));

  const changeLanguage = (next: LocaleSetting | null) => {
    const value = next ?? "system";
    updateSettings({ locale: value });
    void setAppLanguage(value);
  };

  const confirmReset = () => {
    confirmDestructive({
      title: t("settings.reset"),
      message: t("settings.resetConfirm"),
      confirmLabel: t("actions.confirm"),
      cancelLabel: t("actions.cancel"),
      onConfirm: resetAll,
    });
  };

  return (
    <Screen testID="settings-screen">
      <Section title={t("settings.language")}>
        <SelectField
          label={t("settings.language")}
          value={locale}
          options={languageOptions}
          onChange={changeLanguage}
          testID="settings-language"
        />
      </Section>

      <Section title={t("settings.theme")}>
        <SelectField
          label={t("settings.theme")}
          value={themeId}
          options={themeOptions}
          onChange={(next) => updateSettings({ themeId: next ?? "classic" })}
          testID="settings-theme"
        />
        <Text style={{ color: palette.textMuted, fontSize: fontSize.sm }}>
          {t("settings.themeHint")}
        </Text>
      </Section>

      <Section title={t("app.title")}>
        <ListItem
          title={t("settings.server")}
          onPress={() => router.push("/settings/server")}
          testID="settings-server"
        />
        <ListItem
          title={t("settings.wordpress")}
          onPress={() => router.push("/settings/wordpress")}
          testID="settings-wordpress"
        />
      </Section>

      <Button
        title={t("settings.reset")}
        variant="danger"
        onPress={confirmReset}
        testID="settings-reset"
      />

      <Text testID="settings-version" style={{ color: palette.textMuted, fontSize: fontSize.sm }}>
        {t("settings.version")} {Constants.expoConfig?.version ?? "–"}
      </Text>
    </Screen>
  );
}
