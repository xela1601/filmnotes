# T-008 – Sync engine (app ↔ PocketBase)

**Wave:** 2
**Depends on:** T-004 (schema), T-005 (store)
**Owns:** `apps/mobile/src/sync/**`, `apps/mobile/app/settings/server.tsx`

**Goal:** Optional two-way sync of all collections with a PocketBase server: push the outbox, pull changes since the last sync, last-write-wins by `updated`, soft deletes, plus a settings screen for server URL + login and a "Sync now" action. The app must keep working with no server configured.

**Interfaces consumed:** store (`outbox`, `applyRemote`, `removeFromOutbox`, `setLastSyncAt`, settings), `secureStore`, `PB_COLLECTION` (T-001), backend field conventions (`owner`, `deleted`, `clientUpdated`, camelCase fields; see T-004 table).

**Interfaces produced:**

```ts
// src/sync/client.ts – thin, mockable wrapper around the `pocketbase` SDK
export interface RemoteRecord { id: Id; [field: string]: unknown }
export interface SyncClient {
  authWithPassword(email: string, password: string): Promise<{ token: string; userId: Id }>;
  authWithToken(token: string): Promise<{ userId: Id } | null>;    // validates via authRefresh, null if invalid
  list(collection: string, sinceIso: string | null): Promise<RemoteRecord[]>;   // filter: updated > since (server time), all pages
  create(collection: string, record: RemoteRecord): Promise<RemoteRecord>;
  update(collection: string, id: Id, record: RemoteRecord): Promise<RemoteRecord>;
  uploadFile(collection: string, id: Id, field: string, file: { uri?: string; blob?: Blob; name: string; type: string }): Promise<RemoteRecord>;  // used by T-009
  fileUrl(collection: string, id: Id, fileName: string, thumb?: string): string;
}
export function createPocketBaseClient(baseUrl: string): SyncClient

// src/sync/mapping.ts (pure)
toRemote<K>(collection: K, record: EntityOf<K>, ownerId: Id): RemoteRecord   // adds owner, clientUpdated = record.updated, keeps id; drops nothing else
fromRemote<K>(collection: K, remote: RemoteRecord): EntityOf<K>              // updated = clientUpdated ?? updated; owner from remote

// src/sync/engine.ts (pure w.r.t. store: takes state + callbacks)
export interface SyncResult { pushed: number; pulled: number; conflictsLocalWon: number; errors: string[] }
runSync(deps: { client: SyncClient; ownerId: Id; getState: () => AppState; applyRemote; removeFromOutbox; setLastSyncAt; now: () => ISODateTime }): Promise<SyncResult>
//  1. push: for each outbox entry → try update; on 404 → create. Local record wins if local.updated >= remote.clientUpdated, otherwise remote is applied locally and counted in conflictsLocalWon=false (pull below fixes it).
//  2. pull: for each collection list(since = lastSyncAt) → fromRemote → apply only if remote.updated > local.updated or local missing.
//  3. seed upload: if lastSyncAt === null and server has 0 cameras, push all local seeded equipment/filmStocks.
//  4. setLastSyncAt(serverTimeStart) where serverTimeStart = now() captured before step 1 (minus 5 s safety margin).

// src/sync/useSync.ts
useSync(): { status: 'idle'|'running'|'error'|'no_server'; lastResult: SyncResult | null; syncNow(): Promise<void>; isConfigured: boolean }
// Auto-sync: on app foreground (AppState change to 'active') if configured and last run > 60 s ago.
```

## Files

```
src/sync/client.ts
src/sync/mapping.ts, mapping.test.ts
src/sync/engine.ts, engine.test.ts        (fake SyncClient with in-memory collections)
src/sync/useSync.ts, useSync.test.ts
src/sync/i18n.ts (+ sync.de.json, sync.en.json)
src/sync/ServerSettingsScreen.tsx, ServerSettingsScreen.test.tsx
app/settings/server.tsx → <ServerSettingsScreen/>
```

Dependency: `pocketbase` (JS SDK ≥ 0.26) in `apps/mobile/package.json`.

## Steps

- [ ] **Step 1: mapping.test.ts (failing)** – round trip for a `Frame` and a `Roll` keeps all fields; `toRemote` sets `owner`, `clientUpdated`; `fromRemote` prefers `clientUpdated`; `location` object survives JSON field. Implement, commit `feat(app): sync record mapping`.
- [ ] **Step 2: engine.test.ts (failing)** with a `FakeSyncClient` (Map per collection, records get `updated = fakeServerNow()` on write):
  1. pushes 2 outbox entries (one create, one update), clears them, `pushed === 2`.
  2. pulls a remote frame absent locally → applied.
  3. conflict: local roll `updated 10:00`, remote `clientUpdated 10:05` → remote wins locally, not overwritten on server; reverse → local wins.
  4. soft delete propagates (remote `deleted` set).
  5. first sync against empty server uploads seeded equipment (cameras > 0 afterwards), second sync does not re-upload.
  6. a failing `update` (throws) is collected in `errors`, other entries still processed, failed entry stays in outbox.
  7. `setLastSyncAt` called with a timestamp ≤ the start time.
     Implement `engine.ts`, commit `feat(app): sync engine with last-write-wins`.
- [ ] **Step 3: client.ts** – implement over `pocketbase` SDK (`pb.collection(name).getFullList({ filter: since ? \`updated > "${since}"\` : '' , sort: 'updated' })`, `create`, `update`, `authWithPassword`, `authRefresh`, `pb.files.getURL`). Upload via `FormData` (`{ uri, name, type }`on native,`Blob`on web). No unit test beyond a construction smoke test (SDK is mocked in useSync tests). Commit`feat(app): PocketBase client adapter`.
- [ ] **Step 4: useSync.test.ts** – `no_server` when `settings.serverUrl` null; `syncNow` runs engine with token from `secureStore` and stores result; AppState foreground triggers sync at most once per 60 s (mock timers). Implement, commit `feat(app): sync hook with foreground auto-sync`.
- [ ] **Step 5: ServerSettingsScreen.test.tsx** – fields URL, email, password; "Connect" calls `authWithPassword`, stores token + email + URL (`secureStore` mocked), shows "connected as <email>"; "Disconnect" clears; "Sync now" shows result summary `pushed/pulled`; last sync time displayed. Implement + translations (`sync.de.json`: `server: "Server"`, `connect: "Verbinden"`, `syncNow: "Jetzt synchronisieren"`, `lastSync: "Zuletzt: {{time}}"`, …). Commit `feat(app): server settings and manual sync`.

**Done when:** tests green, `tsc` clean, manual check by the integrator against the local PocketBase from T-004: create roll offline → connect → sync → record visible in PocketBase admin.
