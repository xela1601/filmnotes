/**
 * Guards the shape of the translation table, not its wording.
 *
 * Both failures these catch are silent ones: i18next answers a missing key with the fallback
 * language, so a namespace forgotten in a new language looks like German text in an English app
 * rather than like an error, and a key that exists in only one language looks fine until someone
 * switches.
 */
import { DEFAULT_LANGUAGE, NAMESPACES, RESOURCES, SUPPORTED_LANGUAGES } from "./resources";

type Bundle = Record<string, unknown>;

/** Every key of a nested bundle as a dotted path, e.g. `errors.iso_range`. */
function keyPaths(bundle: Bundle, prefix = ""): string[] {
  return Object.entries(bundle).flatMap(([key, value]) => {
    const path = prefix === "" ? key : `${prefix}.${key}`;
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? keyPaths(value as Bundle, path)
      : [path];
  });
}

describe("the translation table", () => {
  it("names every language it ships, in every language", () => {
    // The settings picker builds its list from SUPPORTED_LANGUAGES and labels each entry with
    // `settings.languages.<code>`. A language without that key would show up as its own key.
    for (const language of SUPPORTED_LANGUAGES) {
      for (const inLanguage of SUPPORTED_LANGUAGES) {
        const names = (RESOURCES[inLanguage].common as { settings: { languages: object } }).settings
          .languages;
        expect({ inLanguage, named: language in names }).toEqual({ inLanguage, named: true });
      }
    }
  });

  it("ships more than one language", () => {
    expect(SUPPORTED_LANGUAGES.length).toBeGreaterThan(1);
    expect(SUPPORTED_LANGUAGES).toContain(DEFAULT_LANGUAGE);
  });

  it.each(SUPPORTED_LANGUAGES)("%s knows every namespace", (language) => {
    expect(Object.keys(RESOURCES[language]).sort()).toEqual([...NAMESPACES].sort());
  });

  it.each(NAMESPACES)("every language of %s has the same keys", (namespace) => {
    const expected = keyPaths(RESOURCES[DEFAULT_LANGUAGE][namespace]).sort();
    for (const language of SUPPORTED_LANGUAGES) {
      const actual = keyPaths(RESOURCES[language][namespace]).sort();
      // Named so a failure says which language is missing what, not just "arrays differ".
      expect({ language, namespace, keys: actual }).toEqual({
        language,
        namespace,
        keys: expected,
      });
    }
  });
});
