import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Camera,
  CollectionName,
  EntityOf,
  FilmStock,
  Filter,
  Flash,
  Id,
  ISODateTime,
  Lens,
} from '@filmnotes/domain';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import * as clock from '../lib/clock';
import {
  FILM_STOCK_BUNDLE_ID,
  loadEquipmentPresets,
  loadFilmStockPresets,
  materialize,
} from '../lib/presets';

/** Storage key of the persisted slice; bump the suffix on a breaking state change. */
export const PERSIST_KEY = 'filmnotes-v1';

export const COLLECTIONS = [
  'cameras',
  'lenses',
  'filters',
  'flashes',
  'filmStocks',
  'rolls',
  'frames',
  'scans',
  'exportLogs',
] as const satisfies readonly CollectionName[];

/** All entities, normalised per collection and keyed by record id. */
export type Entities = { [K in CollectionName]: Record<Id, EntityOf<K>> };

/** One pending local change waiting to be pushed to the server (T-008). */
export interface OutboxEntry {
  collection: CollectionName;
  id: Id;
  op: 'upsert' | 'delete';
  at: ISODateTime;
}

export interface Settings {
  locale: 'system' | 'de' | 'en';
  /** PocketBase base URL. */
  serverUrl: string | null;
  /** Password and token live in secure storage, see src/lib/secureStore.ts. */
  serverEmail: string | null;
  wordpressSiteUrl: string | null;
  /** The application password lives in secure storage. */
  wordpressUsername: string | null;
  /** null = DEFAULT_CAPTION_TEMPLATE from @filmnotes/domain. */
  captionTemplate: string | null;
  hashtags: string[];
}

export interface AppState {
  entities: Entities;
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

/** The part of the state that is written to storage (everything but the actions). */
export interface PersistedState {
  entities: Entities;
  outbox: OutboxEntry[];
  lastSyncAt: ISODateTime | null;
  seededBundleIds: string[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  locale: 'system',
  serverUrl: null,
  serverEmail: null,
  wordpressSiteUrl: null,
  wordpressUsername: null,
  captionTemplate: null,
  hashtags: [],
};

export function emptyEntities(): Entities {
  return {
    cameras: {},
    lenses: {},
    filters: {},
    flashes: {},
    filmStocks: {},
    rolls: {},
    frames: {},
    scans: {},
    exportLogs: {},
  };
}

function initialPersistedState(): PersistedState {
  return {
    entities: emptyEntities(),
    outbox: [],
    lastSyncAt: null,
    seededBundleIds: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

/** Returns a copy of `entities` in which `collection` holds the given records as well. */
function withRecords<K extends CollectionName>(
  entities: Entities,
  collection: K,
  records: EntityOf<K>[],
): Entities {
  if (records.length === 0) return entities;
  const map: Record<Id, EntityOf<K>> = { ...entities[collection] };
  for (const record of records) map[record.id] = record;
  // TypeScript cannot narrow a write through the generic key K of the mapped type,
  // so the assembled object is asserted once here; `map` itself is fully typed.
  return { ...entities, [collection]: map } as Entities;
}

/** Appends an entry, replacing any earlier entry for the same collection+id. */
function queue(outbox: OutboxEntry[], entry: OutboxEntry): OutboxEntry[] {
  const kept = outbox.filter((e) => !(e.collection === entry.collection && e.id === entry.id));
  return [...kept, entry];
}

/**
 * Creates an isolated store instance.
 *
 * Pass a `StateStorage` (e.g. an in-memory one) to get a store that does not touch
 * AsyncStorage – that is how the tests keep their state private.
 */
export function createAppStore(storage?: StateStorage) {
  return create<AppState>()(
    persist(
      (set, get) => ({
        ...initialPersistedState(),

        upsert<K extends CollectionName>(collection: K, record: EntityOf<K>): void {
          const at = clock.now();
          const stored = { ...record, updated: at } as EntityOf<K>;
          set((state) => ({
            entities: withRecords(state.entities, collection, [stored]),
            outbox: queue(state.outbox, { collection, id: record.id, op: 'upsert', at }),
          }));
        },

        softDelete(collection: CollectionName, id: Id): void {
          const existing = get().entities[collection][id];
          if (!existing) return;
          const at = clock.now();
          const deleted = { ...existing, deleted: at, updated: at };
          set((state) => ({
            entities: withRecords(state.entities, collection, [deleted]),
            outbox: queue(state.outbox, { collection, id, op: 'delete', at }),
          }));
        },

        applyRemote<K extends CollectionName>(collection: K, records: EntityOf<K>[]): void {
          set((state) => ({ entities: withRecords(state.entities, collection, records) }));
        },

        removeFromOutbox(entries: OutboxEntry[]): void {
          if (entries.length === 0) return;
          const processed = new Set(entries.map((e) => `${e.collection}|${e.id}|${e.op}|${e.at}`));
          set((state) => ({
            outbox: state.outbox.filter(
              (e) => !processed.has(`${e.collection}|${e.id}|${e.op}|${e.at}`),
            ),
          }));
        },

        setLastSyncAt(at: ISODateTime | null): void {
          set({ lastSyncAt: at });
        },

        updateSettings(patch: Partial<Settings>): void {
          set((state) => ({ settings: { ...state.settings, ...patch } }));
        },

        seedPresets(now: ISODateTime): void {
          set((state) => {
            const seeded = new Set(state.seededBundleIds);
            const newlySeeded: string[] = [];
            let entities = state.entities;

            for (const bundle of loadEquipmentPresets()) {
              if (seeded.has(bundle.id)) continue;
              entities = withRecords(
                entities,
                'cameras',
                bundle.cameras.map((r) => materialize<Camera>(r, now)),
              );
              entities = withRecords(
                entities,
                'lenses',
                bundle.lenses.map((r) => materialize<Lens>(r, now)),
              );
              entities = withRecords(
                entities,
                'filters',
                bundle.filters.map((r) => materialize<Filter>(r, now)),
              );
              entities = withRecords(
                entities,
                'flashes',
                bundle.flashes.map((r) => materialize<Flash>(r, now)),
              );
              newlySeeded.push(bundle.id);
            }

            if (!seeded.has(FILM_STOCK_BUNDLE_ID)) {
              entities = withRecords(
                entities,
                'filmStocks',
                loadFilmStockPresets().map((r) => materialize<FilmStock>(r, now)),
              );
              newlySeeded.push(FILM_STOCK_BUNDLE_ID);
            }

            // Seed data is never pushed: T-008 syncs it lazily only if the server is empty.
            if (newlySeeded.length === 0) return {};
            return { entities, seededBundleIds: [...state.seededBundleIds, ...newlySeeded] };
          });
        },

        resetAll(): void {
          set(initialPersistedState());
        },
      }),
      {
        name: PERSIST_KEY,
        storage: createJSONStorage<PersistedState>(() => storage ?? AsyncStorage),
        partialize: (state): PersistedState => ({
          entities: state.entities,
          outbox: state.outbox,
          lastSyncAt: state.lastSyncAt,
          seededBundleIds: state.seededBundleIds,
          settings: state.settings,
        }),
        merge: (persisted, current): AppState => ({
          ...current,
          ...(persisted as Partial<PersistedState>),
          settings: {
            ...DEFAULT_SETTINGS,
            ...((persisted as Partial<PersistedState>).settings ?? {}),
          },
        }),
      },
    ),
  );
}

/** The app-wide store, persisted with AsyncStorage (localStorage on web). */
export const useStore = createAppStore();

export type AppStore = ReturnType<typeof createAppStore>;
