# T-013 – Scan-import CLI (`@filmnotes/scan-import`)

**Wave:** 3
**Depends on:** T-002 (`matchScansToFrames`, `naturalCompare`), T-004 (schema)
**Owns:** `tools/scan-import/**`

**Goal:** Desktop routine for the lab hand-off: `npx filmnotes-import --server URL --email … --roll <rollId> <folder|zip>` lists the roll's frames, proposes the file→frame mapping, asks for confirmation (or `--yes`), uploads to PocketBase and prints a summary. Same logic as the app import, usable from a terminal or a cron-like script.

**Interfaces consumed:** `matchScansToFrames`, `ScanAssignment`, `newId` (domain); PocketBase REST via the `pocketbase` SDK (Node ≥ 20 has `fetch`/`FormData`/`Blob`).

**Interfaces produced:**
```ts
// src/args.ts      parseArgs(argv): { server: string; email: string; password: string | undefined; roll: string; source: string; yes: boolean; dryRun: boolean }  // password also from env FILMNOTES_PASSWORD
// src/files.ts     listImageFiles(source: string): Promise<{ name: string; path: string; mimeType: string }[]>   // folder (recursive, jpg/jpeg/png/tif/tiff/webp) or .zip (extract to a temp dir with fflate)
// src/plan.ts      planImport(files, frames): ScanAssignment[]; renderPlan(assignments, frames): string   // table: idx | file | → #frameNo | first 40 chars of notes
// src/upload.ts    uploadPlan(pb, ownerId, rollId, files, assignments, log): Promise<{ uploaded: number; failed: string[] }>
// src/main.ts      main(argv, io): Promise<number>   // exit code; io = { stdout, stderr, prompt(question): Promise<string> }
bin: filmnotes-import → dist/cli.js (tsc build), or run with `npx tsx src/cli.ts`
```

## Files

```
tools/scan-import/package.json (name @filmnotes/scan-import, bin, deps: @filmnotes/domain, pocketbase, fflate; dev: tsx), tsconfig.json, jest.config.js, README.md
tools/scan-import/src/args.ts, args.test.ts, files.ts, files.test.ts, plan.ts, plan.test.ts, upload.ts, upload.test.ts, main.ts, main.test.ts, cli.ts
```

## Steps

- [ ] **Step 1: args.test.ts** – parses flags, defaults `yes false`, errors on missing `--roll`/source, reads env password. Implement, commit `feat(cli): argument parsing`.
- [ ] **Step 2: files.test.ts** – temp folder with `b2.JPG`, `a10.jpeg`, `notes.txt`, sub/`c.png` → 3 images with mime types; zip fixture → extracted images; sorted with `naturalCompare`. Implement, commit `feat(cli): list image files from folder or zip`.
- [ ] **Step 3: plan.test.ts** – renders the table with surplus files marked `(unassigned)`. Implement, commit `feat(cli): import plan rendering`.
- [ ] **Step 4: upload.test.ts** – fake `pb` object (`collection().create`, `.update` with FormData) → creates scan record then uploads file; failure of one file reported, others continue. Implement, commit `feat(cli): upload scans`.
- [ ] **Step 5: main.test.ts** – full flow with fakes: prints plan, `prompt` answers `n` → exit 1 nothing uploaded; `--yes` → uploads and prints summary; `--dry-run` never uploads. Implement `main.ts`, `cli.ts` (`main(process.argv.slice(2), realIo).then(process.exit)`). Commit `feat(cli): scan import command`.
- [ ] **Step 6: README** – usage, env vars, example for the drugstore-CD workflow. Commit `docs(cli): usage`.

**Done when:** tests green; integrator check against the local PocketBase from T-004 with 3 JPEGs.
