import { getLocales } from "expo-localization";
import i18next, { type i18n as I18nInstance } from "i18next";
import { initReactI18next } from "react-i18next";

import de from "./common.de.json";
import en from "./common.en.json";

/** Languages the UI ships with; `de` is the default. */
export const SUPPORTED_LANGUAGES = ["de", "en"] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** What `Settings.locale` can hold: an explicit language or "follow the device". */
export type LocaleSetting = "system" | AppLanguage;

export const DEFAULT_LANGUAGE: AppLanguage = "de";
export const DEFAULT_NAMESPACE = "common";

function isSupported(value: string | null | undefined): value is AppLanguage {
  return value === "de" || value === "en";
}

/** The device language, or the default when the device speaks something else. */
export function deviceLanguage(): AppLanguage {
  try {
    for (const locale of getLocales()) {
      if (isSupported(locale.languageCode)) return locale.languageCode;
    }
  } catch {
    // expo-localization is unavailable (e.g. in a bare Node test environment).
  }
  return DEFAULT_LANGUAGE;
}

/** Turns the persisted locale setting into a concrete language. */
export function resolveLanguage(locale: LocaleSetting): AppLanguage {
  return locale === "system" ? deviceLanguage() : locale;
}

void i18next.use(initReactI18next).init({
  resources: {
    de: { [DEFAULT_NAMESPACE]: de },
    en: { [DEFAULT_NAMESPACE]: en },
  },
  lng: deviceLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  ns: [DEFAULT_NAMESPACE],
  defaultNS: DEFAULT_NAMESPACE,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export const i18n: I18nInstance = i18next;

/** Applies the persisted locale setting to the running i18next instance. */
export async function setAppLanguage(locale: LocaleSetting): Promise<void> {
  const language = resolveLanguage(locale);
  if (i18n.language !== language) await i18n.changeLanguage(language);
}

/**
 * Feature modules call this at module load to add their own namespace, e.g.
 * `registerFeatureTranslations('rolls', { de, en })` and then `useTranslation('rolls')`.
 */
export function registerFeatureTranslations(
  namespace: string,
  resources: { de: object; en: object },
): void {
  i18n.addResourceBundle("de", namespace, resources.de, true, true);
  i18n.addResourceBundle("en", namespace, resources.en, true, true);
}

export default i18n;
