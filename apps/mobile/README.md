# `@filmnotes/mobile`

The filmnotes Expo app (iOS, Android, web). Offline-first: everything works without a
server, sync to PocketBase is optional.

## Run

All commands are run from this directory; inside the Docker sandbox prefix every
network-touching command with `../../sandbox/proxy/with-proxy.sh`.

```bash
npm run start      # Expo dev server (choose the platform interactively)
npm run ios        # iOS simulator
npm run android    # Android emulator / device
npm run web        # browser on http://localhost:8081
npm test           # Jest (jest-expo + @testing-library/react-native)
```

From the repository root:

```bash
npm test -w @filmnotes/mobile        # this workspace's suites
npm test                             # every workspace
npx tsc -p apps/mobile --noEmit      # type check
sandbox/mise run web                 # = npm run web in this workspace
```

Build smoke test (also the check that Metro can compile the workspace packages, which
ship TypeScript sources):

```bash
npx expo export --platform web       # writes dist/
```

## Layout

```
app/                 expo-router route tree (routes only – no other files, see "Tests")
  _layout.tsx        root stack: i18n init, store hydration gate, preset seeding, theme
  (tabs)/            rolls (index), equipment, settings
src/store/           zustand store (persisted), pure selectors, React hooks
src/i18n/            i18next setup, `common` namespace for de + en
src/ui/              shared UI kit (theme, fields, buttons, lists, IssueList)
src/lib/             clock, secure storage, confirm dialog, preset access
src/features/        feature screens – owned by the Wave 2 tickets (T-006 … T-012)
src/testing/         record builders for tests
tests/               tests for files under app/
```

## State

`src/store/store.ts` holds every entity in normalised maps plus an **outbox** of pending
local changes:

- `upsert` / `softDelete` stamp `updated` (and `deleted`) and queue an outbox entry.
- `applyRemote` writes records coming from the server without touching the outbox.
- `seedPresets` inserts the equipment and film stock presets once per bundle id and
  deliberately creates **no** outbox entries – seed data is pushed lazily by the sync
  engine (T-008) only when the server is still empty.

Persistence uses `AsyncStorage` on native and `localStorage` on web, under the key
`filmnotes-v1`. Tests create isolated stores with `createAppStore(memoryStorage)`.

Credentials never go into the store: `src/lib/secureStore.ts` keeps them in
`expo-secure-store` (native) or `localStorage` (web).

## i18n

German is the default, English is second; the initial language comes from
`expo-localization` and can be overridden in the settings. Feature modules add their own
namespace at module load:

```ts
registerFeatureTranslations('rolls', { de, en });
// …then in the components:
const { t } = useTranslation('rolls');
```

Validation issues from `@filmnotes/domain` are translated in the `common` namespace under
`validation.<code>`; `<IssueList>` does that for you.

## End-to-end check of the web build

```bash
npm run check:web        # exports dist/ and walks the core scenario through the bundle
```

`e2e/web-walkthrough.mjs` serves the exported bundle and drives the spec's core scenario
(create a roll from a preset, add the first frame, see a plausibility warning) in a DOM.
It covers what component tests cannot: metro's output, the expo-router entry, store
hydration, i18n and the presets together. jsdom has no layout engine, so anything that
depends on real measurement belongs on a device or in a browser.

## Tests

- `preset: 'jest-expo'`, discovered automatically by the root Jest config.
- `@testing-library/react-native` 13 with the **synchronous** `render` / `fireEvent` API.
  Version 14 is not usable yet: it depends on `test-renderer`, whose `react-reconciler`
  requires react `^19.3.0` while Expo SDK 57 pins react `19.2.3`, which makes npm install
  a second copy of React.
- Tests for route files live in `tests/`, not next to the route: expo-router turns *every*
  file under `app/` into a route, so `app/(tabs)/settings.test.tsx` would become a
  `/settings.test` screen.
