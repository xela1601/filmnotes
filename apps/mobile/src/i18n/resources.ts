/**
 * Every translated string the app ships, in one table.
 *
 * The texts themselves stay with their feature (`features/rolls/rolls.de.json` and so on) - that
 * is where you edit them and where a new key is added, without touching this file. What lives
 * here is only the wiring: which language knows which namespace.
 *
 * That is deliberate. The registration used to sit in each feature's own `i18n.ts`, hard-coded as
 * `{ de, en }`, which meant a third language had to be added in six places and silently fell back
 * to German in any namespace that was forgotten. Here, adding a language is one block below, and
 * `resources.test.ts` fails if that block is missing a namespace.
 */
import { EQUIPMENT_NAMESPACE } from "../features/equipment/i18n";
import equipmentDe from "../features/equipment/equipment.de.json";
import equipmentEn from "../features/equipment/equipment.en.json";
import { EXPORT_NAMESPACE } from "../features/export/i18n";
import exportDe from "../features/export/export.de.json";
import exportEn from "../features/export/export.en.json";
import { FRAMES_NAMESPACE } from "../features/frames/i18n";
import framesDe from "../features/frames/frames.de.json";
import framesEn from "../features/frames/frames.en.json";
import { ROLLS_NAMESPACE } from "../features/rolls/i18n";
import rollsDe from "../features/rolls/rolls.de.json";
import rollsEn from "../features/rolls/rolls.en.json";
import { SCANS_NAMESPACE } from "../features/scans/i18n";
import scansDe from "../features/scans/scans.de.json";
import scansEn from "../features/scans/scans.en.json";
import { SYNC_NAMESPACE } from "../sync/i18n";
import syncDe from "../sync/sync.de.json";
import syncEn from "../sync/sync.en.json";
import commonDe from "./common.de.json";
import commonEn from "./common.en.json";

/** The namespace a `t("…")` without a prefix resolves in. */
export const DEFAULT_NAMESPACE = "common";

/**
 * Language → namespace → strings.
 *
 * To add a language: put its JSON files next to the existing ones, import them above, and add one
 * block here with every namespace filled in.
 */
export const RESOURCES = {
  de: {
    [DEFAULT_NAMESPACE]: commonDe,
    [EQUIPMENT_NAMESPACE]: equipmentDe,
    [EXPORT_NAMESPACE]: exportDe,
    [FRAMES_NAMESPACE]: framesDe,
    [ROLLS_NAMESPACE]: rollsDe,
    [SCANS_NAMESPACE]: scansDe,
    [SYNC_NAMESPACE]: syncDe,
  },
  en: {
    [DEFAULT_NAMESPACE]: commonEn,
    [EQUIPMENT_NAMESPACE]: equipmentEn,
    [EXPORT_NAMESPACE]: exportEn,
    [FRAMES_NAMESPACE]: framesEn,
    [ROLLS_NAMESPACE]: rollsEn,
    [SCANS_NAMESPACE]: scansEn,
    [SYNC_NAMESPACE]: syncEn,
  },
} as const;

/** Languages the UI ships with, derived from the table so the two cannot disagree. */
export const SUPPORTED_LANGUAGES = Object.keys(RESOURCES) as readonly AppLanguage[];
export type AppLanguage = keyof typeof RESOURCES;

/** The one every other language falls back to. */
export const DEFAULT_LANGUAGE: AppLanguage = "de";

/** The namespaces of the table - a union, so indexing it stays checked rather than `any`. */
export type Namespace = keyof (typeof RESOURCES)[AppLanguage];

/** The namespaces i18next is initialised with; the default one has to come first. */
export const NAMESPACES: readonly Namespace[] = Object.keys(
  RESOURCES[DEFAULT_LANGUAGE],
) as Namespace[];
