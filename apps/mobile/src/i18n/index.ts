import { getLocales } from "expo-localization";
import i18next, { type i18n as I18nInstance } from "i18next";
import { initReactI18next } from "react-i18next";

import {
  DEFAULT_LANGUAGE,
  DEFAULT_NAMESPACE,
  NAMESPACES,
  RESOURCES,
  SUPPORTED_LANGUAGES,
  type AppLanguage,
} from "./resources";

export { DEFAULT_LANGUAGE, DEFAULT_NAMESPACE, SUPPORTED_LANGUAGES, type AppLanguage };

/** What `Settings.locale` can hold: an explicit language or "follow the device". */
export type LocaleSetting = "system" | AppLanguage;

function isSupported(value: string | null | undefined): value is AppLanguage {
  return SUPPORTED_LANGUAGES.includes(value as AppLanguage);
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
  resources: RESOURCES,
  lng: deviceLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  ns: NAMESPACES,
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
 * Adds a namespace at runtime, for anything that is not part of the shipped table in
 * `./resources` - a plugin, a test, a screen loaded on demand.
 *
 * Takes whichever languages it is given instead of a fixed pair, so it does not become the next
 * place a new language has to be remembered.
 */
export function registerFeatureTranslations(
  namespace: string,
  resources: Partial<Record<AppLanguage, object>>,
): void {
  for (const [language, bundle] of Object.entries(resources)) {
    i18n.addResourceBundle(language, namespace, bundle, true, true);
  }
}

export default i18n;
