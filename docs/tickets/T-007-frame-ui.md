# T-007 – Frame capture & edit UI

**Wave:** 2
**Depends on:** T-002, T-003, T-005
**Owns:** `apps/mobile/src/features/frames/**`, `apps/mobile/app/frames/**`

**Goal:** The screen where the user records a frame in the field: fast, few taps, sensible defaults, dependent fields (exposure mode decides which of shutter/aperture are editable), option lists derived from the camera and lens, inline validation issues, location with optional GPS, time, notes. Also "Next frame" to save and immediately create the following frame.

**Interfaces consumed:** store/selectors/ui/i18n (T-005); `validateFrame`, `shutterSpeedsForMode`, `apertureValuesForLens`, `newFrame`, `nextFrameNo`, `isSlowerThan` (T-002).

**Interfaces produced:**

```ts
// src/features/frames/frameForm.ts (pure)
editableFields(mode: ExposureMode | null): { shutter: boolean; aperture: boolean; programShift: boolean; compensation: boolean }
//   P: shutter false, aperture false, programShift true, compensation true
//   A: aperture true, shutter false; S: shutter true, aperture false; M: both true, programShift false, compensation false; null: both true
focalLengthOptions(lens: Lens | null): number[]       // zoom: marked stops [min, …common marks…, max] e.g. 35,50,70 / 70,100,135,150,210; prime: [focal]
filterOptions(filters: Filter[], lens: Lens | null): Filter[]   // only matching thread (or all when lens null)
applyLensChange(frame: Frame, lens: Lens | null, allFilters: Filter[]): Frame  // reset focal to lens min (or null), drop filters with wrong thread, add lens.defaultFilterIds, lensHood false when !hasHood
LIGHT_OPTIONS: string[]   // sun, cloudy, shade, indoor_window, indoor_artificial, night, backlight, snow_beach
SUBJECT_OPTIONS: string[] // portrait, landscape, street, sport, macro, group, night, other
```

## Files

```
src/features/frames/i18n.ts (+ frames.de.json, frames.en.json)
src/features/frames/frameForm.ts, frameForm.test.ts
src/features/frames/useLocation.ts, useLocation.test.ts     (wraps expo-location; permission asked on demand)
src/features/frames/FrameEditScreen.tsx, FrameEditScreen.test.tsx
app/frames/[frameId].tsx → <FrameEditScreen/>
```

Add `expo-location` via `npx expo install expo-location` (declare in `apps/mobile/package.json`; app.json plugin entry with `locationWhenInUsePermission` text is a T-005-owned file – ask the integrator to add it in your final report).

## Steps

- [ ] **Step 1: frameForm.test.ts (failing)** – the `editableFields` table above; `focalLengthOptions` for 35-70 → `[35,50,70]`, 70-210 → `[70,100,135,150,210]`, 50 → `[50]`, null → `[]`; `filterOptions` filters by thread; `applyLensChange` from 35-70 (UV49) to 70-210 drops the 49 mm UV, adds the 55 mm UV, sets focal 70. Implement, commit `feat(app): frame form rules`.
- [ ] **Step 2: useLocation.test.ts** – mock `expo-location`: `requestForegroundPermissionsAsync` denied → returns `{status:'denied'}`; granted → returns `{lat, lon}` rounded to 5 decimals. Implement, commit `feat(app): on-demand GPS lookup`.
- [ ] **Step 3: FrameEditScreen.test.tsx (failing)** – store with seeded presets, one roll (Minolta, Kodak Gold 200) and one frame from `newFrame`. Assertions:
  1. header shows `#1 / 36`; time field prefilled with `takenAt` (editable `HH:mm` + date).
  2. mode P: shutter and aperture selects are disabled/hidden, program-shift switch visible; switching to M enables both and hides compensation.
  3. shutter options in M include `bulb`, in S they do not.
  4. aperture options follow the selected lens (35-70 → starts at 4; switching to 50 mm → starts at 1.7).
  5. selecting Kenko PL while focus mode AF renders the `polarizer_blocks_af` warning text; setting focus M removes it.
  6. selecting shutter `1/15` in M with handheld shows `handheld_shake_risk`.
  7. flash select shows head/power fields only when a flash is chosen.
  8. "Save" writes the frame to the store (`updated` changed) and `router.back()`; "Save & next" saves and creates frame #2 carrying over lens/filters/mode (assert via store) then `router.replace('/frames/<newId>')`; "Save & next" is hidden when `frameNo === roll.exposures`.
  9. "Delete frame" confirms then soft-deletes.
  10. errors (level `error`) disable Save; warnings/info do not.
- [ ] **Step 4: implement FrameEditScreen.tsx** – sections: _Exposure_ (mode segmented, shutter, aperture, compensation −4…+4 step 0.5, program shift, AE lock), _Optics_ (lens, focal length segmented from `focalLengthOptions`, filters multi-select, lens hood switch only when `lens.hasHood`), _Focus & drive_ (focus mode, AF result, drive), _Flash_ (flash select, head, power, flash OK), _Context_ (support, light, subject, location name + "Use current position" button showing `lat, lon` when set, date/time, notes multiline), _Issues_ (`IssueList` from `validateFrame` recomputed on every change). Keep the screen a thin composition: state = local `Frame` copy; `issues = useMemo(() => validateFrame(frame, ctx))`. Commit `feat(app): frame edit screen`.
- [ ] **Step 5: translations + route file.** `frames.de.json`: `title: "Bild {{no}} / {{total}}"`, `sections.exposure: "Belichtung"`, `fields.shutter: "Zeit"`, `fields.aperture: "Blende"`, `light.sun: "Sonne"`, …, `saveNext: "Speichern & nächstes"`; en likewise. Run tests, commit `feat(app): frame route and translations`.

**Done when:** tests 1–10 green, `tsc` clean, core scenario step 4 (spec §2.1) works in the web build.
