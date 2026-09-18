import type { StateStorage } from "zustand/middleware";

import * as clock from "../lib/clock";
import { makeFrame, makeRoll } from "../testing/fixtures";
import { createAppStore, DEFAULT_SETTINGS, emptyEntities, PERSIST_KEY } from "./store";

const T0 = "2026-09-18T10:00:00.000Z";
const T1 = "2026-09-18T11:00:00.000Z";

function createMemoryStorage(): StateStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (name) => map.get(name) ?? null,
    setItem: (name, value) => {
      map.set(name, value);
    },
    removeItem: (name) => {
      map.delete(name);
    },
  };
}

describe("app store", () => {
  let storage: ReturnType<typeof createMemoryStorage>;
  let store: ReturnType<typeof createAppStore>;
  let nowSpy: jest.SpyInstance<string, []>;

  beforeEach(() => {
    storage = createMemoryStorage();
    nowSpy = jest.spyOn(clock, "now").mockReturnValue(T0);
    store = createAppStore(storage);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  describe("upsert", () => {
    it("stores the record, stamps updated and appends an outbox entry", () => {
      store.getState().upsert("rolls", makeRoll({ updated: "2020-01-01T00:00:00.000Z" }));

      const state = store.getState();
      expect(state.entities.rolls["roll00000000001"]).toMatchObject({
        id: "roll00000000001",
        updated: T0,
      });
      expect(state.outbox).toEqual([
        { collection: "rolls", id: "roll00000000001", op: "upsert", at: T0 },
      ]);
    });

    it("keeps a single outbox entry per record and carries the newer timestamp", () => {
      store.getState().upsert("rolls", makeRoll());
      nowSpy.mockReturnValue(T1);
      store.getState().upsert("rolls", makeRoll({ notes: "second" }));

      const state = store.getState();
      expect(state.entities.rolls["roll00000000001"]?.notes).toBe("second");
      expect(state.outbox).toEqual([
        { collection: "rolls", id: "roll00000000001", op: "upsert", at: T1 },
      ]);
    });
  });

  describe("softDelete", () => {
    it("marks the record deleted and queues a delete", () => {
      store.getState().upsert("rolls", makeRoll());
      nowSpy.mockReturnValue(T1);
      store.getState().softDelete("rolls", "roll00000000001");

      const state = store.getState();
      expect(state.entities.rolls["roll00000000001"]?.deleted).toBe(T1);
      expect(state.outbox).toEqual([
        { collection: "rolls", id: "roll00000000001", op: "delete", at: T1 },
      ]);
    });

    it("ignores unknown ids", () => {
      store.getState().softDelete("rolls", "roll00000000009");
      expect(store.getState().outbox).toEqual([]);
    });
  });

  describe("applyRemote", () => {
    it("replaces records without touching the outbox", () => {
      store.getState().upsert("rolls", makeRoll());
      const outboxBefore = store.getState().outbox;

      store.getState().applyRemote("rolls", [makeRoll({ notes: "from server", updated: T1 })]);

      const state = store.getState();
      expect(state.entities.rolls["roll00000000001"]).toMatchObject({
        notes: "from server",
        updated: T1,
      });
      expect(state.outbox).toEqual(outboxBefore);
    });
  });

  describe("removeFromOutbox", () => {
    it("removes exact matches only", () => {
      store.getState().upsert("rolls", makeRoll());
      store.getState().upsert("frames", makeFrame());
      expect(store.getState().outbox).toHaveLength(2);

      store
        .getState()
        .removeFromOutbox([{ collection: "rolls", id: "roll00000000001", op: "upsert", at: T1 }]);
      expect(store.getState().outbox).toHaveLength(2);

      store
        .getState()
        .removeFromOutbox([{ collection: "rolls", id: "roll00000000001", op: "upsert", at: T0 }]);
      expect(store.getState().outbox).toEqual([
        { collection: "frames", id: "frame0000000001", op: "upsert", at: T0 },
      ]);
    });
  });

  describe("seedPresets", () => {
    it("inserts the preset equipment and film stocks without outbox entries", () => {
      store.getState().seedPresets(T0);

      const state = store.getState();
      expect(Object.keys(state.entities.cameras)).toHaveLength(1);
      expect(Object.keys(state.entities.lenses)).toHaveLength(3);
      expect(Object.keys(state.entities.filters)).toHaveLength(7);
      expect(Object.keys(state.entities.flashes)).toHaveLength(1);
      expect(Object.keys(state.entities.filmStocks).length).toBeGreaterThanOrEqual(20);

      for (const camera of Object.values(state.entities.cameras)) {
        expect(camera.owner).toBeNull();
        expect(camera.created).toBe(T0);
        expect(camera.deleted).toBeNull();
      }

      expect(state.seededBundleIds).toEqual(["minolta-7000af-kit", "film-stocks"]);
      expect(state.outbox).toEqual([]);
    });

    it("is idempotent", () => {
      store.getState().seedPresets(T0);
      const before = Object.keys(store.getState().entities.filmStocks).length;

      store.getState().seedPresets(T1);

      const state = store.getState();
      expect(Object.keys(state.entities.filmStocks)).toHaveLength(before);
      expect(Object.keys(state.entities.cameras)).toHaveLength(1);
      expect(state.seededBundleIds).toEqual(["minolta-7000af-kit", "film-stocks"]);
    });
  });

  describe("updateSettings", () => {
    it("merges the patch into the existing settings", () => {
      store.getState().updateSettings({ locale: "en" });
      store.getState().updateSettings({ serverUrl: "https://pb.example.org" });

      expect(store.getState().settings).toMatchObject({
        locale: "en",
        serverUrl: "https://pb.example.org",
        hashtags: [],
      });
    });
  });

  describe("setLastSyncAt / resetAll", () => {
    it("stores the sync timestamp and resets everything", () => {
      store.getState().upsert("rolls", makeRoll());
      store.getState().setLastSyncAt(T1);
      expect(store.getState().lastSyncAt).toBe(T1);

      store.getState().resetAll();

      const state = store.getState();
      expect(state.entities.rolls).toEqual({});
      expect(state.outbox).toEqual([]);
      expect(state.lastSyncAt).toBeNull();
      expect(state.seededBundleIds).toEqual([]);
      expect(state.settings.locale).toBe("system");
    });
  });

  describe("persistence", () => {
    it("writes the state to the provided storage under the persist key", () => {
      store.getState().upsert("rolls", makeRoll({ notes: "persisted" }));

      const raw = storage.getItem(PERSIST_KEY);
      expect(typeof raw).toBe("string");
      expect(raw as string).toContain("roll00000000001");
      expect(raw as string).toContain("persisted");
    });
  });
});

describe("rehydration", () => {
  const flushHydration = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  it("finishes on a first launch, when storage is still empty", async () => {
    // Regression: a merge that assumed a persisted object threw on the empty storage of
    // a fresh install. `persist` swallows that error, `hasHydrated()` stays false and the
    // app never leaves its hydration gate – the web build showed nothing but a spinner.
    const store = createAppStore(createMemoryStorage());

    await flushHydration();

    expect(store.persist.hasHydrated()).toBe(true);
    expect(store.getState().settings).toEqual(DEFAULT_SETTINGS);
  });

  it("restores a persisted state and fills settings added since it was written", async () => {
    const storage = createMemoryStorage();
    const roll = makeRoll({ id: "roll0hydration1" });
    storage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: {
          entities: { ...emptyEntities(), rolls: { [roll.id]: roll } },
          outbox: [],
          lastSyncAt: null,
          seededBundleIds: ["minolta-7000af-kit"],
          // An older persisted settings object: locale only.
          settings: { locale: "en" },
        },
        version: 0,
      }),
    );

    const store = createAppStore(storage);
    await flushHydration();

    expect(store.persist.hasHydrated()).toBe(true);
    expect(store.getState().entities.rolls[roll.id]).toEqual(roll);
    expect(store.getState().settings.locale).toBe("en");
    expect(store.getState().settings.serverUrl).toBeNull();
  });
});
