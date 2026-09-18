/**
 * WordPress exporter: uploads the scan to the media library and creates a post from the frame.
 *
 * Authentication uses an Application Password over Basic auth, which every self-hosted WordPress
 * with the REST API supports without a plugin. The whole exporter is plain `fetch` plus string
 * building, so it runs on the app, in Node and in tests with a recording fake.
 *
 * Posts are created as drafts by default (see the spec): publishing stays a manual step in
 * WordPress, so a bad export never appears on the blog.
 */
import { z } from 'zod';
import type { Exporter, ExporterDeps, ExportImage, ExportInput, ExportResult } from './types';

export interface WordPressConfig {
  siteUrl: string;
  username: string;
  appPassword: string;
  status: 'draft' | 'publish';
  categoryIds: number[];
  tagIds: number[];
}

export const wordPressConfigSchema: z.ZodType<WordPressConfig> = z.object({
  siteUrl: z.string().url(),
  username: z.string().min(1),
  appPassword: z.string().min(1),
  status: z.enum(['draft', 'publish']),
  categoryIds: z.array(z.number().int()),
  tagIds: z.array(z.number().int()),
});

/** A WordPress REST API call that answered with a non-2xx status. */
export class WordPressError extends Error {
  readonly status: number;
  /** The raw response body, kept for the error screen and for bug reports. */
  readonly body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = 'WordPressError';
    this.status = status;
    this.body = body;
  }
}

/** The WordPress media library entry created for an upload; other fields are ignored. */
interface MediaResponse {
  id: number;
  source_url?: string | null;
}

/** The created post; `link` is the permalink, also for a draft (a preview url). */
interface PostResponse {
  id: number;
  link?: string | null;
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** UTF-8 bytes of a string, without depending on TextEncoder being available. */
function utf8Bytes(value: string): number[] {
  const bytes: number[] = [];
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return bytes;
}

/**
 * Base64 of a UTF-8 string. Hand-rolled because neither `Buffer` (Node only) nor `btoa`
 * (browser only, and ASCII only) is guaranteed on every platform this package runs on.
 */
function toBase64(value: string): string {
  const bytes = utf8Bytes(value);
  let result = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const triplet = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);
    result += BASE64_ALPHABET[(triplet >> 18) & 0x3f] ?? '';
    result += BASE64_ALPHABET[(triplet >> 12) & 0x3f] ?? '';
    result += second === undefined ? '=' : BASE64_ALPHABET[(triplet >> 6) & 0x3f] ?? '';
    result += third === undefined ? '=' : BASE64_ALPHABET[triplet & 0x3f] ?? '';
  }
  return result;
}

/** `Authorization` header value for an Application Password. */
export function basicAuthHeader(username: string, appPassword: string): string {
  return `Basic ${toBase64(`${username}:${appPassword}`)}`;
}

/** Drops trailing slashes so that `${base}/wp-json/...` never contains a double slash. */
function normaliseSiteUrl(siteUrl: string): string {
  return siteUrl.replace(/\/+$/, '');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function equipmentName(item: { make: string; model: string } | null): string | null {
  if (item === null) return null;
  const name = `${item.make} ${item.model}`.trim();
  return name === '' ? null : name;
}

/** Comma-separated names of the mounted filters, or null when none is mounted. */
function joinNames(items: { make: string; model: string }[]): string | null {
  const names = items
    .map((item) => equipmentName(item))
    .filter((name): name is string => name !== null);
  return names.length === 0 ? null : names.join(', ');
}

/** ISO timestamp → `2026-09-18`, without touching the time zone. */
function isoDate(takenAt: string | null): string | null {
  if (takenAt === null) return null;
  const match = /^\d{4}-\d{2}-\d{2}/.exec(takenAt);
  return match === null ? null : match[0];
}

/** `"Kodak Gold 200 – #12 – Munich"`, leaving out the parts the frame does not have. */
export function buildPostTitle(input: ExportInput): string {
  const location = input.frame.location?.name ?? null;
  const parts = [input.filmStock.name, `#${input.frame.frameNo}`, location === '' ? null : location];
  return parts.filter((part): part is string => part !== null && part !== '').join(' – ');
}

/** The metadata rows of the post table; a row with an unknown value is left out. */
function metadataRows(input: ExportInput): [string, string][] {
  const { frame, filmStock, camera, lens, filters } = input;
  const location = frame.location?.name ?? null;
  const candidates: [string, string | null][] = [
    ['Film', filmStock.name],
    ['Camera', equipmentName(camera)],
    ['Lens', equipmentName(lens)],
    ['Focal length', frame.focalLengthMm === null ? null : `${frame.focalLengthMm} mm`],
    ['Aperture', frame.aperture === null ? null : `f/${frame.aperture}`],
    ['Shutter', frame.shutterSpeed],
    ['Mode', frame.exposureMode],
    ['Filters', joinNames(filters)],
    ['Location', location],
    ['Date', isoDate(frame.takenAt)],
  ];
  return candidates.filter((row): row is [string, string] => row[1] !== null && row[1] !== '');
}

/** Notes → one `<p>` per blank-line-separated block, single line breaks become `<br />`. */
function notesHtml(notes: string): string[] {
  return notes
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '')
    .map((paragraph) => `<p>${escapeHtml(paragraph).split('\n').join('<br />')}</p>`);
}

/**
 * The post body: the scan as a `<figure>` (if it was uploaded), a metadata table and the notes.
 * Everything that comes from the record is HTML-escaped.
 */
export function buildPostHtml(input: ExportInput, mediaUrl: string | null): string {
  const blocks: string[] = [];

  if (mediaUrl !== null) {
    blocks.push(
      `<figure><img src="${escapeHtml(mediaUrl)}" alt="${escapeHtml(buildPostTitle(input))}" /></figure>`,
    );
  }

  const rows = metadataRows(input).map(
    ([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`,
  );
  blocks.push(['<table>', ...rows, '</table>'].join('\n'));
  blocks.push(...notesHtml(input.frame.notes));

  return blocks.join('\n');
}

/** Reads the `message` field WordPress sends with a REST error, or falls back to the raw body. */
function errorMessageOf(body: string): string {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed === 'object' && parsed !== null && 'message' in parsed) {
      const message = (parsed as { message: unknown }).message;
      if (typeof message === 'string' && message !== '') return message;
    }
  } catch {
    // Not JSON – WordPress also answers with plain text or HTML (e.g. behind a proxy).
  }
  return body;
}

async function parseJson<T>(response: Response, step: string): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    throw new WordPressError(
      `WordPress ${step} failed (${response.status}): ${errorMessageOf(body)}`,
      response.status,
      body,
    );
  }
  return (await response.json()) as T;
}

/** `POST /wp-json/wp/v2/media` with the raw bytes, as the REST API expects them. */
async function uploadMedia(
  baseUrl: string,
  image: ExportImage,
  authorization: string,
  deps: ExporterDeps,
): Promise<MediaResponse> {
  // A request body has to be a view on a non-shared ArrayBuffer, which `Uint8Array` alone does
  // not promise, so the bytes are copied into one.
  const body = new Uint8Array(image.bytes);
  const init: RequestInit = {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Disposition': `attachment; filename="${image.fileName}"`,
      'Content-Type': image.mimeType,
    },
    body,
  };
  const response = await deps.fetch(`${baseUrl}/wp-json/wp/v2/media`, init);
  return parseJson<MediaResponse>(response, 'media upload');
}

export const wordPressExporter: Exporter<WordPressConfig> = {
  id: 'wordpress',
  nameKey: 'exporters.wordpress',
  configSchema: wordPressConfigSchema,
  requiresImage: false,
  async exportFrame(
    input: ExportInput,
    config: WordPressConfig,
    deps: ExporterDeps,
  ): Promise<ExportResult> {
    const baseUrl = normaliseSiteUrl(config.siteUrl);
    const authorization = basicAuthHeader(config.username, config.appPassword);

    const media =
      input.image === null ? null : await uploadMedia(baseUrl, input.image, authorization, deps);

    const payload: Record<string, unknown> = {
      title: buildPostTitle(input),
      content: buildPostHtml(input, media?.source_url ?? null),
      status: config.status,
      categories: config.categoryIds,
      tags: config.tagIds,
    };
    if (media !== null) payload['featured_media'] = media.id;

    const init: RequestInit = {
      method: 'POST',
      headers: { Authorization: authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    };
    const response = await deps.fetch(`${baseUrl}/wp-json/wp/v2/posts`, init);
    const post = await parseJson<PostResponse>(response, 'post creation');

    return { externalId: String(post.id), url: post.link ?? null, sharePayload: null };
  },
};
