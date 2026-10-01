# T-026 – UI polish: one title per screen, quiet destruction, visible feedback

**Wave:** backlog — requested by the owner on 2026-10-01: _"mach einfach, dass es schöner aussieht
und die UX besser wird. Es gibt ja mehrere verschiedene UI-Themes …"_
**Depends on:** T-017 (themes and tokens), T-024 (the roll form it touches)
**Owns:** `apps/mobile/src/ui/**`, the screens under `apps/mobile/src/features/**` and
`apps/mobile/app/**` where they use the shared components, their i18n files,
`docs/screenshots/**` (regenerated)

**Goal:** the app reads as one calm, native-feeling tool in all eight themes — not by changing the
themes, but by fixing how the screens use them.

## Decided

- **Polish, not redesign.** The eight themes, their palettes and the token scale (T-017) stay as
  they are. Changes go through the shared components in `src/ui` first, so every screen and every
  theme gets them at once; screens change only where their structure is the problem.
- **Scope: every screen**, as the owner asked, verified on the guided screenshot tour
  (`e2e/screenshots.mjs`, light and dark). The tour runs on the web build; the native iOS look is
  the owner's check on the Mac (as for T-016).
- **No new dependency, no new colour.** Icons come from the `Ionicons` set the tab bar already
  uses.

## Findings (audit 2026-10-01, from the source and the tour screenshots)

| #   | Sev | Finding                                                                                                                                                            |
| --- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | P1  | **Every screen says its title twice**: the header "Filme" over a large "Filme", "Neuer Film" over "Neuer Film", "Bild 1 / 36" over "Bild 1 / 36".                  |
| 2   | P1  | **The server settings header shows the route** `settings/server` — the route sets no title. The roll detail header says "Filme" (plural) over one roll.            |
| 3   | P1  | **Destructive actions are the loudest thing on the screen**: "Film löschen", "Bild löschen", "Lokale Daten zurücksetzen" are filled red, heavier than "Speichern". |
| 4   | P1  | **No pressed feedback anywhere**: `Button`, the segments, list rows and picker options are `Pressable`s with one static style — a tap outdoors gets no answer.     |
| 5   | P2  | **Navigation reads as action**: the roll's "Scans importieren", "Film exportieren", "Film bearbeiten" are four equal buttons; list rows have no chevron.           |
| 6   | P2  | **Labels repeat their section**: "STATUS › Status", "SPRACHE › Sprache", "ERSCHEINUNGSBILD › Erscheinungsbild", "NOTIZEN › Notizen".                               |
| 7   | P2  | **The first launch has no first step**: the empty roll list explains, but the only way on is a small "+" in the corner.                                            |
| 8   | P2  | **Hints are coloured text only**: a warning and an error differ by hue alone — and in "Silbergelatine" or "Maximaler Kontrast" the hues are nearly the same.       |
| 9   | P3  | Settings rows "Server" / "WordPress" do not say whether anything is set up.                                                                                        |

Also seen, deliberately **not** a finding: the header and tab labels render in a monospace face in
the screenshots. That is the sandbox's headless Chromium resolving `system-ui` to the only font
it has; on a device the system face is used.

## Steps

- [x] **Step 1: the shared components.** `Button`: a `danger` that is outlined, not filled; a
      pressed state for every variant. `ListItem`: pressed state, a chevron when it navigates.
      `SelectField`/`TextField`: `hideLabel` (still the accessibility label). `EmptyState`: an
      optional action. `IssueList`: an icon per level. `Screen`: a large title with an optional
      header action, for the tab roots. Tests first, in `ui.test.tsx`.
- [ ] **Step 2: one title per screen.** Tab roots: large title in the content, no header. Pushed
      screens: the title in the header only. The server route gets its title; the roll detail
      header says "Film".
- [ ] **Step 3: the screens.** Roll detail: status next to the roll, actions as navigable rows,
      delete set apart. Frame edit and the other forms: delete set apart at the end. Single-field
      sections drop the repeated label. The empty roll list offers "Ersten Film anlegen".
      Settings rows say what is configured.
- [ ] **Step 4: verify.** `npm test`, lint, format; the screenshot tour in light and dark, before
      and after, and the screenshots in `docs/screenshots` regenerated. A changeset (`minor` — the
      look changes everywhere).
