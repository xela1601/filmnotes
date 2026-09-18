# T-014 – Workflow & deployment docs

**Wave:** 3 (last)
**Depends on:** all other tickets merged
**Owns:** `README.md`, `docs/workflow.md`, `docs/deployment.md`

**Goal:** The owner (and later open-source users) can install, run and use the whole system from the docs alone, and the shooting → lab → import → export routine is written down as a checklist.

## Files & content

- [ ] **`README.md`** – what it is (2 paragraphs), screenshots placeholder section (list which screens to capture), monorepo layout (from spec §3), quick start (`npm install`, `npm test`, `npm run web -w @filmnotes/mobile`, backend `fetch-pb` + `start:dev`), building for devices (`npx expo run:ios` / `run:android`, EAS notes), licence MIT, link to `docs/`.
- [ ] **`docs/workflow.md`** – the routine, as numbered checklists with the exact screens/buttons:
  1. _Loading a roll_: create roll, pick film stock, verify ISO in the camera LCD (DX), note lab-relevant info.
  2. _In the field_: add frame → adjust only what changed → "Save & next"; tips (carry-over defaults, warnings explained: polarizer/AF, shake, flash sync).
  3. _Roll finished_: set status `shot` → rewind → `at_lab` with lab name and date; what to ask the lab (scan resolution, file naming, download vs. CD).
  4. _Scans arrive_: download ZIP / copy from CD → app "Import scans" (or CLI command with example) → check mapping against notes (thumbnails vs. notes) → upload → status `developed`.
  5. _Publishing_: per frame export to WordPress (draft → review in WP → publish) or share package (Instagram/Mastodon); hashtag/template settings; where export logs are shown.
  6. _Sync & backup_: when sync happens, how to force it, backing up `pb_data`.
- [ ] **`docs/deployment.md`** – PocketBase on the home server with docker compose behind the existing reverse proxy (HTTPS required for web app + app on other networks), creating the superuser and the single app user, environment variables, updating PocketBase versions (migrations run automatically), restoring from backup, exposing the web build (`npx expo export --platform web` → static `dist/` served by any web server), CORS note (PocketBase allows all origins by default), troubleshooting (401 → token expired, re-login).
- [ ] Verify every command in the docs actually exists in the repo scripts (`grep` the package.json files). Commit `docs: workflow, deployment and project README`.
