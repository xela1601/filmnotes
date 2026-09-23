/**
 * The i18next namespace of the export screens.
 *
 * The strings sit in `export.<language>.json` next to this file; `src/i18n/resources.ts` wires them
 * up. Modules of this feature import the constant and call `useTranslation(EXPORT_NAMESPACE)`.
 * The exporter names live under `exporters.<id>`, the `nameKey` every exporter of
 * `@filmnotes/exporters` carries, so a new target only needs a key in the JSON files.
 */
export const EXPORT_NAMESPACE = "export";
