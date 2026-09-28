/**
 * How a roll gets from the camera to its digital frames, when a lab is involved (T-024).
 *
 * A lab is data, not code: a profile says where to ask for an order's status, where the scans
 * can be downloaded, and how the lab names its files. No lab's host name, query parameter or
 * file naming appears anywhere else. A roll developed or scanned at home has no profile at all.
 *
 * Profiles describe *where* to ask, not how to read an unknown answer: a second lab whose status
 * API answers in a different shape needs code, not just another profile.
 */
import type { Id } from "./types";

/** A URL with `{name}` placeholders, and the names the caller has to supply. */
export interface LabEndpoint {
  urlTemplate: string;
  /**
   * Every placeholder of `urlTemplate`. Where a value comes from is the caller's business: the
   * roll (`orderId`), the person at the keyboard (a one-time credential), or local configuration
   * that must not be published (a branch id).
   */
  params: string[];
}

export interface LabProfile {
  id: Id;
  name: string;
  status: LabEndpoint | null;
  download: LabEndpoint | null;
  /**
   * A regular expression (source) whose first capture group is the frame number in the lab's
   * scan file names, e.g. `Neg\.Nr\.(\d+)` for `_Bild000_Neg.Nr.25.jpg`. Null when the names
   * carry none and the files are matched in their natural order.
   */
  scanFrameNumberPattern: string | null;
  notes: string;
}

const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9]*)\}/g;

function placeholdersOf(template: string): string[] {
  return [...new Set([...template.matchAll(PLACEHOLDER)].map((match) => match[1] as string))];
}

function endpointIssues(name: string, endpoint: LabEndpoint | null): string[] {
  if (!endpoint) return [];
  const used = placeholdersOf(endpoint.urlTemplate);
  return [
    ...used
      .filter((param) => !endpoint.params.includes(param))
      .map((param) => `${name}: placeholder {${param}} is not a declared parameter`),
    ...endpoint.params
      .filter((param) => !used.includes(param))
      .map((param) => `${name}: parameter ${param} does not appear in the URL`),
  ];
}

function patternIssues(pattern: string | null): string[] {
  if (pattern === null) return [];
  let compiled: RegExp;
  try {
    compiled = new RegExp(pattern);
  } catch {
    return ["scanFrameNumberPattern: not a valid regular expression"];
  }
  // A regex with n groups matches the empty alternative with n + 1 entries.
  const groups = (new RegExp(`${compiled.source}|`).exec("")?.length ?? 1) - 1;
  return groups >= 1
    ? []
    : ["scanFrameNumberPattern: needs one capture group for the frame number"];
}

/** Everything wrong with a profile, as readable sentences; empty when it can be used. */
export function labProfileIssues(profile: LabProfile): string[] {
  return [
    ...endpointIssues("status", profile.status),
    ...endpointIssues("download", profile.download),
    ...patternIssues(profile.scanFrameNumberPattern),
  ];
}

export type FilledLabUrl =
  | { ok: true; url: string }
  | { ok: false; reason: "no-endpoint" }
  | { ok: false; reason: "missing"; missing: string[] };

/** Builds the endpoint's URL, or says why not - never half a URL with a placeholder left in. */
export function fillLabTemplate(
  endpoint: LabEndpoint | null,
  values: Readonly<Record<string, string | null | undefined>>,
): FilledLabUrl {
  if (!endpoint) return { ok: false, reason: "no-endpoint" };
  const missing = endpoint.params.filter((param) => !values[param]?.trim());
  if (missing.length > 0) return { ok: false, reason: "missing", missing };
  const url = endpoint.urlTemplate.replace(PLACEHOLDER, (placeholder, param: string) =>
    endpoint.params.includes(param)
      ? encodeURIComponent((values[param] as string).trim())
      : placeholder,
  );
  return { ok: true, url };
}

/** The frame number a scan's file name carries, or null when it carries none. */
export function frameNumberFromFileName(pattern: string | null, fileName: string): number | null {
  if (pattern === null) return null;
  const captured = new RegExp(pattern).exec(fileName)?.[1];
  if (captured === undefined || !/^\d+$/.test(captured)) return null;
  const frameNo = Number(captured);
  return frameNo >= 1 ? frameNo : null;
}
