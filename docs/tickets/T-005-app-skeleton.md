# T-005 – Expo app skeleton, store, i18n, shared UI (`@filmnotes/mobile`)

**Wave:** 1
**Depends on:** T-001
**Owns:** `apps/mobile/**` **except** `src/features/**` and the route files listed as "placeholder – owned by" below (create them as one-line placeholders, never touch them again).

**Goal:** An Expo app that starts on iOS, Android and web, with expo-router navigation shell, a persisted Zustand store holding all entities + outbox, i18n (de default, en), a small shared UI kit, and seeding from `@filmnotes/presets` on first launch. No feature screens yet – Wave 2 fills them.

**Interfaces produced (consumed by T-006…T-012):**

```ts
// src/store/store.ts
export interface OutboxEntry { collection: CollectionName; id: Id; op: 'upsert' | 'delete'; at: ISODateTime }
export interface Settings {
  locale: 'system' | 'de' | 'en';
  serverUrl: string | null;          // PocketBase base URL
  serverEmail: string | null;        // password/token live in secure storage, see src/lib/secureStore.ts
  wordpressSiteUrl: string | null;
  wordpressUsername: string | null;  // application password in secure storage
  captionTemplate: string | null;    // null = DEFAULT_CAPTION_TEMPLATE
  hashtags: string[];
}
export interface AppState {
  entities: { [K in CollectionName]: Record<Id, EntityOf<K>> };
  outbox: OutboxEntry[];
  lastSyncAt: ISODateTime | null;
  seededBundleIds: string[];
  settings: Settings;
  /** Local write: sets record.updated = now(), stores it, appends an outbox entry (dedupes by collection+id, keeps latest). */
  upsert<K extends CollectionName>(collection: K, record: EntityOf<K>): void;
  /** Local soft delete: sets deleted = now(), outbox op 'delete'. */
  softDelete(collection: CollectionName, id: Id): void;
  /** Remote write from sync: replaces records without touching the outbox. */
  applyRemote<K extends CollectionName>(collection: K, records: EntityOf<K>[]): void;
  /** Remove processed outbox entries (matched by collection+id+at). */
  removeFromOutbox(entries: OutboxEntry[]): void;
  setLastSyncAt(at: ISODateTime | null): void;
  updateSettings(patch: Partial<Settings>): void;
  /** Inserts presets whose bundle id is not in seededBundleIds; film stocks count as bundle 'film-stocks'. */
  seedPresets(now: ISODateTime): void;
  resetAll(): void;
}
export const useStore: UseBoundStore<StoreApi<AppState>>;        // zustand + persist, name 'filmnotes-v1'
export const createAppStore(storage?: StateStorage): typeof useStore;  // for tests: in-memory storage

// src/store/selectors.ts  (pure functions, take AppState)
selectActive<K>(state, collection: K): EntityOf<K>[]                    // deleted === null
selectRollsSorted(state): Roll[]                                         // by loadedAt desc
selectFramesForRoll(state, rollId): Frame[]                              // active, by frameNo asc
selectScansForRoll(state, rollId): Scan[]                                // active, by sortIndex
selectFrameContext(state, frame: Frame): FrameContext | null            // null if roll/camera missing
selectEquipmentForCaption(state, frame): { camera, lens, filters, filmStock, roll } | null

// src/store/hooks.ts
useEntity<K>(collection: K, id: Id | null): EntityOf<K> | undefined
useActive<K>(collection: K): EntityOf<K>[]
useSettings(): Settings

// src/lib/clock.ts
now(): ISODateTime                                                       // wrapper for tests (jest.spyOn)

// src/lib/secureStore.ts
getSecret(key: 'serverPassword' | 'serverToken' | 'wordpressAppPassword'): Promise<string | null>
setSecret(key, value: string | null): Promise<void>                      // expo-secure-store on native, localStorage on web

// src/i18n/index.ts
i18n (i18next instance, initialised with de+en 'common' namespace, language from settings or expo-localization)
registerFeatureTranslations(namespace: string, resources: { de: object; en: object }): void
// Features call registerFeatureTranslations('rolls', { de, en }) at module load and use useTranslation('rolls').
// Validation issue codes are translated in the 'common' namespace: validation.<code> (title) with {{params}}.

// src/ui/  (all accept `testID`)
<Screen title? scroll?>          safe-area + padding + optional header title
<Section title>                  grouped fields
<TextField label value onChangeText multiline? placeholder?>
<NumberField label value: number|null onChange(step?) min? max?>
<SelectField<T> label value options: {value:T; label:string}[] onChange nullable?>   // segmented for ≤ 4 options, modal picker otherwise
<MultiSelectField<T> label values options onChange>
<SwitchField label value onChange>
<Button title onPress variant?: 'primary'|'secondary'|'danger' disabled?>
<ListItem title subtitle? right? onPress>
<EmptyState title hint?>
<IssueList issues: ValidationIssue[]>   // colours by level, text via t(`validation.${code}`, params)
```

Route tree (create every file; placeholders are `export default function Placeholder(){ return null }` + a comment naming the owning ticket):

```
app/_layout.tsx                 Stack root: providers (i18n init, store hydration gate, theme), header styles
app/(tabs)/_layout.tsx          Tabs: index (rolls), equipment, settings – icons from @expo/vector-icons
app/(tabs)/index.tsx            placeholder – owned by T-006
app/(tabs)/equipment.tsx        placeholder – owned by T-012
app/(tabs)/settings.tsx         T-005: language picker, links to settings/server (T-008) & settings/wordpress (T-011), "Reset local data" (confirm), app version
app/rolls/new.tsx               placeholder – T-006
app/rolls/[rollId].tsx          placeholder – T-006
app/rolls/[rollId]/edit.tsx     placeholder – T-006
app/frames/[frameId].tsx        placeholder – T-007
app/scans/[rollId].tsx          placeholder – T-009
app/export/frame/[frameId].tsx  placeholder – T-011
app/export/roll/[rollId].tsx    placeholder – T-011
app/settings/server.tsx         placeholder – T-008
app/settings/wordpress.tsx      placeholder – T-011
app/equipment/[type]/[id].tsx   placeholder – T-012
app/equipment/[type]/new.tsx    placeholder – T-012
```

## Files

```
apps/mobile/package.json, app.json, tsconfig.json, babel.config.js, jest.config.js, metro.config.js (workspace-aware)
apps/mobile/src/store/store.ts, store.test.ts, selectors.ts, selectors.test.ts, hooks.ts
apps/mobile/src/lib/clock.ts, secureStore.ts, secureStore.web.ts
apps/mobile/src/i18n/index.ts, common.de.json, common.en.json
apps/mobile/src/ui/*.tsx (+ ui.test.tsx smoke render of each component)
apps/mobile/app/** (route tree above)
apps/mobile/README.md  (run: npm run start / ios / android / web / test)
```

## Steps

- [ ] **Step 1: scaffold.** From repo root: `npx create-expo-app@latest apps/mobile --template blank-typescript --no-install`, then set `"name": "@filmnotes/mobile"` in its package.json and run `npm install` at the root. Add: `expo-router`, `react-native-safe-area-context`, `react-native-screens`, `expo-linking`, `expo-constants`, `expo-status-bar`, `expo-localization`, `expo-secure-store`, `@react-native-async-storage/async-storage`, `zustand`, `i18next`, `react-i18next`, `react-native-web`, `react-dom`, `@expo/metro-runtime`, `@filmnotes/domain: "*"`, `@filmnotes/presets: "*"`. Dev: `jest-expo`, `@testing-library/react-native`, `@testing-library/jest-native`, `@types/react`. Use `npx expo install <pkg>` for Expo packages so versions match the SDK. Configure `app.json`: `scheme: "filmnotes"`, `web.bundler: "metro"`, `web.output: "single"`, `plugins: ["expo-router", "expo-secure-store", "expo-localization"]`, `experiments.typedRoutes: true`; `main: "expo-router/entry"`. **metro.config.js** must resolve workspace packages: `config.watchFolders = [workspaceRoot]`, `config.resolver.nodeModulesPaths = [path.resolve(projectRoot,'node_modules'), path.resolve(workspaceRoot,'node_modules')]`, and `config.resolver.unstable_enablePackageExports = true`. Since `@filmnotes/domain` ships TS source (`main: src/index.ts`), Metro + Babel compile it – verify with `npx expo export --platform web` (writes to `dist/`; must succeed). jest.config.js: `preset: 'jest-expo'`, `displayName: 'mobile'`, `transformIgnorePatterns` per jest-expo docs plus `@filmnotes/`, `setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect']`. Commit `chore(app): scaffold Expo app with router, workspaces and jest`.
- [ ] **Step 2: store.test.ts (failing)** using `createAppStore(memoryStorage)`:
  - `upsert('rolls', roll)` stores it, sets `updated` to `now()` (mock `clock.now`), appends `{collection:'rolls', id, op:'upsert'}`; second upsert of same id keeps a single outbox entry with the newer `at`.
  - `softDelete` sets `deleted`, outbox op `'delete'`.
  - `applyRemote` replaces records and leaves outbox untouched.
  - `removeFromOutbox` removes exact matches only.
  - `seedPresets(now)` inserts 1 camera, 3 lenses, 7 filters, 1 flash, ≥ 20 film stocks with `owner: null`, records `seededBundleIds = ['minolta-7000af-kit','film-stocks']`, and produces **no** outbox entries (seed data is synced lazily by T-008 only if the server has none); calling it twice does not duplicate.
  - `updateSettings({locale:'en'})` merges.
  - persistence: after actions, `memoryStorage.getItem('filmnotes-v1')` contains the roll.
- [ ] **Step 3: implement store.ts**, run, commit `feat(app): persisted entity store with outbox`.
- [ ] **Step 4: selectors.test.ts** – sorting, deleted filtering, `selectFrameContext` assembles camera/roll/lens/filters/flash/siblings (siblings exclude the frame itself). Implement, commit `feat(app): store selectors`.
- [ ] **Step 5: i18n** – `common.de.json` / `common.en.json` with keys: `app.title`, `tabs.rolls|equipment|settings`, `actions.save|cancel|delete|add|back|confirm`, `settings.language|language.system|language.de|language.en|server|wordpress|reset|resetConfirm|version`, `validation.<code>` for all 11 codes from T-002 (German and English one-liners, e.g. `polarizer_blocks_af`: "Autofokus funktioniert mit linearem Polfilter nicht – manuell fokussieren." / "Autofocus does not work with a linear polarizer – focus manually."; `handheld_shake_risk`: "Verwacklungsgefahr: länger als {{limit}} aus der Hand." …). Test: `i18n.t('tabs.rolls')` is `'Filme'` in de and `'Rolls'` in en; `registerFeatureTranslations('x',{de:{a:'A'},en:{a:'B'}})` makes `t('x:a')` work. Commit `feat(app): i18n with German default and English`.
- [ ] **Step 6: ui kit** – implement components with plain `StyleSheet`, colours from `src/ui/theme.ts` (`useColorScheme`, light/dark palettes, spacing scale 4/8/12/16/24, font sizes 14/16/20/28). `ui.test.tsx`: render each component with `@testing-library/react-native`, `fireEvent.press` on Button calls onPress, SelectField shows options and calls onChange, IssueList renders translated text. Commit `feat(app): shared UI components`.
- [ ] **Step 7: routes** – `_layout.tsx` initialises i18n from settings, waits for store hydration (`useStore.persist.onFinishHydration` → state flag), calls `seedPresets(now())` once hydrated, renders `<Stack>`. Tabs layout with three tabs and translated titles. Settings screen per the table above. Placeholders for all other routes. Test `app/(tabs)/settings.test.tsx`: changing language updates `i18n.language`. Run `npx expo export --platform web` as a build smoke test. Commit `feat(app): navigation shell and settings screen`.
- [ ] **Step 8: README** for the app workspace. Commit `docs(app): how to run and test`.

**Done when:** `npm test -w @filmnotes/mobile` green; `npx expo export --platform web` succeeds; `npx tsc -p apps/mobile --noEmit` clean.
