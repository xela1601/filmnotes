# T-012 – Equipment management UI (extensibility)

**Wave:** 3
**Depends on:** T-005, T-003
**Owns:** `apps/mobile/src/features/equipment/**`, `apps/mobile/app/(tabs)/equipment.tsx`, `apps/mobile/app/equipment/**`

**Goal:** Let the user view, add, edit and (soft) delete cameras, lenses, filters, flashes and film stocks, so the app is not tied to the Minolta preset. Forms are generated from small field descriptors per type to keep the code minimal.

**Interfaces consumed:** store (`upsert`, `softDelete`, `useActive`), ui kit, i18n (T-005); `newId` (T-001).

**Interfaces produced:**

```ts
// src/features/equipment/descriptors.ts
export type EquipmentType = 'cameras' | 'lenses' | 'filters' | 'flashes' | 'filmStocks';
export type FieldKind = 'text' | 'number' | 'boolean' | 'select' | 'multiselect' | 'stringList' | 'numberList' | 'shutterList';
export interface FieldDescriptor { key: string; kind: FieldKind; labelKey: string; required?: boolean; options?: { value: string; labelKey?: string }[]; min?: number; max?: number; step?: number }
export const DESCRIPTORS: Record<EquipmentType, FieldDescriptor[]>
//  cameras: make, model, aliases(stringList), year, format, mount, exposureModes(multiselect P/A/S/M), shutterSpeedsManual(shutterList), shutterSpeedsAutoExtra(shutterList), bulbOnlyInModes(multiselect), flashSync(text), focusModes, driveModes, metering, notes, conditionNotes(stringList) – exposureCompensation/iso/defaultsForNewFrame edited as grouped numeric fields (comp min/max/step, iso min/max) and defaults select fields
//  lenses: make, model, focalMinMm, focalMaxMm, maxAperture, minAperture, apertureValues(numberList), filterThreadMm, minFocusM, macroNote, weightG, handheldMinShutter, hasHood, defaultFilterIds(multiselect of filters)
//  filters: make, model, threadMm, type, exposureFactorEv, afCompatible(select yes/no/limited), warning, mountedOnLensId(select of lenses)
//  flashes: make, model, guideNumberIso100M, powerLevels(stringList), headPositions(multiselect direct/bounce), afIlluminator, sync, notes
//  filmStocks: name, maker, iso, process(select C41/BW/E6), color, exposures(select 24/36), dxCoded(select yes/no/unknown), notes
emptyRecord(type: EquipmentType, now: ISODateTime): EntityOf<type>
validateRecord(type, record): Record<string, 'required' | 'invalid'>
displayName(type, record): string
```

## Files

```
src/features/equipment/i18n.ts (+ equipment.de.json, equipment.en.json)
src/features/equipment/descriptors.ts, descriptors.test.ts
src/features/equipment/ListField.tsx           // editable string/number/shutter lists (chips + add input)
src/features/equipment/EquipmentListScreen.tsx, EquipmentListScreen.test.tsx   // segmented type switch + list + "+"
src/features/equipment/EquipmentEditScreen.tsx, EquipmentEditScreen.test.tsx   // renders fields from descriptors
app/(tabs)/equipment.tsx, app/equipment/[type]/[id].tsx, app/equipment/[type]/new.tsx
```

## Steps

- [ ] **Step 1: descriptors.test.ts** – every descriptor key exists on the corresponding empty record; `emptyRecord('lenses')` has `apertureValues []`, `hasHood false`; `validateRecord` requires make/model (name/maker for film), positive iso, `focalMinMm <= focalMaxMm`, parseable shutter strings in shutter lists (use `parseShutterSpeed` from domain; `bulb` allowed). Implement, commit `feat(app): equipment field descriptors`.
- [ ] **Step 2: EquipmentListScreen.test.tsx** – shows seeded Minolta camera under "Cameras", 3 lenses under "Lenses", 20+ film stocks; tapping opens `/equipment/<type>/<id>`; "+" opens `/equipment/<type>/new`. Implement, commit `feat(app): equipment list`.
- [ ] **Step 3: EquipmentEditScreen.test.tsx** – new film stock "Kodak Portra 800", iso 800, C41, colour → saved and appears in list; editing the 50 mm lens `handheldMinShutter` to `1/125` persists; invalid shutter string shows error and blocks save; delete confirms and soft-deletes (list no longer shows it). Implement generic renderer (switch on `kind`), commit `feat(app): equipment editor`.
- [ ] **Step 4: translations + routes** (`equipment.de.json`: `types.cameras: "Kameras"`, `types.lenses: "Objektive"`, `types.filters: "Filter"`, `types.flashes: "Blitze"`, `types.filmStocks: "Filme"`, field labels …). Commit `feat(app): equipment routes and translations`.

**Done when:** tests green, `tsc` clean; a new camera created in the UI can be chosen in the roll form (T-006) without code changes.
