# T-017 – Themes and design tokens

**Status:** delivered on 2026-09-23 (commits `c7bc728`, `730e92e`). Full gate green.
**Wave:** out of band — requested by the owner in conversation, written up afterwards.
**Owns:** `apps/mobile/src/ui/themes.ts`, `apps/mobile/src/ui/theme.ts`,
`apps/mobile/app/(tabs)/settings.tsx`, `apps/mobile/src/i18n/common.*.json`, every `StyleSheet`
under `apps/mobile/src` and `apps/mobile/app`

**Goal:** The app can be switched between several looks, defined in one place, and no screen
carries a colour, a spacing value, a radius or a font weight of its own.

**Where it came from:** the owner asked for a nicer-looking app with conventions and a theme
defined globally, then for five retro themes plus some non-retro ones, switchable in the settings.
Independently, an adversarial review found that `spacing` and `radius` already existed, were
exported, and were imported by not one screen — 33 bare numbers duplicated the scale. Both are the
same problem, so they were done together.

**Decisions taken with the owner:** platform-native look over a cross-platform component library
(see T-016 for the part that is still open); tokens in `theme.ts` rather than NativeWind or
Unistyles, because the file already existed and the problem was that nothing used it.

## Steps

- [x] **Step 1: the token module.** `ui/themes.ts` with `spacing`, `fontSize`, `fontWeight`,
      `letterSpacing`, `radius` and eight palettes; `THEME_IDS` is the order the picker offers.
      Only colours differ between themes, so a theme cannot move the layout.
- [x] **Step 2: the hook.** `useTheme()` combines the stored theme with the device scheme; a theme
      may pin its scheme, and an unknown stored id falls back instead of rendering nothing.
- [x] **Step 3: the setting.** `Settings.themeId`, device-local like the other display settings,
      and a picker in the settings screen built from `THEME_IDS`.
- [x] **Step 4: the sweep.** 23 files converted from literals to tokens, then 16 more for the
      typography. Two guard tests fail on a hard-coded spacing value, radius, colour, font weight
      or letter spacing anywhere under `src/` and `app/`.
- [x] **Step 5: contrast.** Every palette is measured against WCAG AA rather than admired. Caught
      the Polaroid accent at 4.38:1, a darkroom divider at 1.26:1 and a hex typo.

**Done when:** `npm test`, `npm run lint`, `npm run format:check`, `npm run typecheck` green, and
the eight themes are selectable. ✔

## What is not in it

The bar and the header are still drawn by React Navigation, so there is no Liquid Glass yet — that
is T-016, and it is blocked on one decision. `expo-glass-effect` (installed, 57.0.3) for glass
surfaces we draw ourselves is worth its own ticket once the bar is settled.
