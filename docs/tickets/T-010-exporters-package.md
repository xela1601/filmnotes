# T-010 – Exporters package (`@filmnotes/exporters`)

**Status:** delivered. Verified on 2026-09-23: every file the ticket names exists and the full gate is green (`npm test`, `npm run lint`, `npm run format:check`, `npm run typecheck`).

**Wave:** 2
**Depends on:** T-002 (`buildCaption`, types)
**Owns:** `packages/exporters/**`

**Goal:** Framework-free exporter interface with two implementations: WordPress (REST API, draft post with uploaded media) and Share package (caption text + image payload for the OS share sheet). New targets are added by implementing `Exporter` and registering it.

**Interfaces produced:**

```ts
// src/types.ts
export interface ExportImage { bytes: Uint8Array; mimeType: string; fileName: string }
export interface ExportInput { frame: Frame; roll: Roll; camera: Camera; lens: Lens | null; filters: Filter[]; filmStock: FilmStock; caption: string; image: ExportImage | null }
export interface ExportResult { externalId: string | null; url: string | null; sharePayload: { text: string; image: ExportImage | null } | null }
export interface Exporter<C> {
  id: string; nameKey: string;             // i18n key in the app: exporters.<id>
  configSchema: z.ZodType<C>;
  requiresImage: boolean;
  exportFrame(input: ExportInput, config: C, deps: ExporterDeps): Promise<ExportResult>;
}
export interface ExporterDeps { fetch: typeof fetch }
// src/registry.ts
registerExporter(e: Exporter<unknown>): void; getExporter(id): Exporter<unknown> | undefined; listExporters(): Exporter<unknown>[]
// src/share.ts
export const shareExporter: Exporter<{ }>            // returns sharePayload { text: caption, image }
// src/wordpress.ts
export interface WordPressConfig { siteUrl: string; username: string; appPassword: string; status: 'draft' | 'publish'; categoryIds: number[]; tagIds: number[] }
export const wordPressExporter: Exporter<WordPressConfig>
buildPostHtml(input: ExportInput, mediaUrl: string | null): string      // <figure> + <table> of metadata + notes paragraphs
buildPostTitle(input: ExportInput): string                              // "Kodak Gold 200 – #12 – Ort" (parts present)
```

## Files

```
packages/exporters/package.json (deps: @filmnotes/domain "*", zod), tsconfig.json, jest.config.js
packages/exporters/src/types.ts, registry.ts, registry.test.ts, share.ts, share.test.ts, wordpress.ts, wordpress.test.ts, index.ts
```

## Steps

- [x] **Step 1: package skeleton** like T-003. Commit `chore(exporters): package skeleton`.
- [x] **Step 2: registry.test.ts** – register/get/list, duplicate id overwrites. Implement, commit `feat(exporters): exporter registry`.
- [x] **Step 3: share.test.ts** – returns caption as text and passes the image through; `requiresImage false`. Implement, commit `feat(exporters): share package exporter`.
- [x] **Step 4: wordpress.test.ts (failing)** with a fake `fetch` recording requests:
  1. with image: first `POST {siteUrl}/wp-json/wp/v2/media` with header `Authorization: Basic base64(username:appPassword)`, `Content-Disposition: attachment; filename="<fileName>"`, `Content-Type: <mimeType>`, body = bytes → fake returns `{ id: 55, source_url: 'https://…/img.jpg' }`; then `POST …/wp-json/wp/v2/posts` JSON `{ title, content, status, featured_media: 55, categories, tags }` → returns `{ id: 101, link: 'https://…/?p=101' }`; result `{ externalId: '101', url: link }`.
  2. without image: no media call, no `featured_media`.
  3. non-2xx → throws `WordPressError` with status and body message.
  4. `siteUrl` trailing slash is normalised.
  5. `buildPostHtml` contains `<figure>` when media url given, a `<table>` with rows for film, camera, lens, focal, aperture, shutter, mode, filters, location, date (only present ones), and notes wrapped in `<p>` with line breaks → `<br>`; HTML-escapes `<`, `&`, `"`.
     Implement, commit `feat(exporters): WordPress draft post exporter`.
- [x] **Step 5: index.ts** registers both exporters on import and re-exports everything. Root `npm test` green. Commit `chore(exporters): public API`.

**Done when:** tests green, `tsc` clean, no React Native or Expo imports in this package.
