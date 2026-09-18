import type { CollectionName, EntityOf, ISODateTime } from "@filmnotes/domain";
import type { StateStorage } from "zustand/middleware";

import { runSync, type SyncDeps } from "./engine";
import { FakeSyncClient } from "./fakeClient";
import { toRemote } from "./mapping";
import * as clock from "../lib/clock";
import { createAppStore } from "../store/store";
import { makeFrame, makeRoll } from "../testing/fixtures";

const OWNER = "user00000000001";
/** The moment `runSync` is started in these tests. */
const START = "2026-09-18T12:00:00.000Z";
const WATERMARK = "2026-09-18T11:59:55.000Z";

function createMemoryStorage(): StateStorage {
  const map = new Map<string, string>();
  return {
    getItem: (name) => map.get(name) ?? null,
    setItem: (name, value) => {
      map.set(name, value);
    },
    removeItem: (name) => {
      map.delete(name);
    },
  };
}

type Harness = {
  store: ReturnType<typeof createAppStore>;
  client: FakeSyncClient;
  deps: SyncDeps;
  setLastSyncAt: jest.Mock<void, [ISODateTime | null]>;
};

function harness(): Harness {
  const store = createAppStore(createMemoryStorage());
  // The fake server clock starts at the same instant as the client clock, so the
  // watermark (START - 5 s) behaves the way it does against a real server.
  const client = new FakeSyncClient({ serverNow: START });
  const setLastSyncAt = jest.fn<void, [ISODateTime | null]>((at) =>
    store.getState().setLastSyncAt(at),
  );

  return {
    store,
    client,
    setLastSyncAt,
    deps: {
      client,
      ownerId: OWNER,
      getState: () => store.getState(),
      applyRemote: (collection, records) => store.getState().applyRemote(collection, records),
      removeFromOutbox: (entries) => store.getState().removeFromOutbox(entries),
      setLastSyncAt,
      now: () => START,
    },
  };
}

describe("runSync – push", () => {
  it("pushes the outbox, updating what exists and creating what does not", async () => {
    const { store, client, deps } = harness();
    client.seed("rolls", {
      ...toRemote("rolls", makeRoll({ notes: "on the server" }), OWNER),
      clientUpdated: "2026-09-18T09:00:00.000Z",
    });
    deps.setLastSyncAt("2026-09-18T09:30:00.000Z");

    harnessWrite(store, "rolls", makeRoll({ notes: "local" }), "2026-09-18T10:00:00.000Z");
    harnessWrite(store, "frames", makeFrame({ notes: "new frame" }), "2026-09-18T10:00:00.000Z");
    expect(store.getState().outbox).toHaveLength(2);

    const result = await runSync(deps);

    expect(result.pushed).toBe(2);
    expect(result.errors).toEqual([]);
    expect(store.getState().outbox).toEqual([]);
    expect(client.updateCalls).toEqual(["rolls/roll00000000001", "frames/frame0000000001"]);
    expect(client.createCalls).toEqual(["frames/frame0000000001"]);
    expect(client.record("rolls", "roll00000000001")?.notes).toBe("local");
    expect(client.record("frames", "frame0000000001")?.notes).toBe("new frame");
  });

  it("propagates a soft delete", async () => {
    const { store, client, deps } = harness();
    client.seed("rolls", {
      ...toRemote("rolls", makeRoll(), OWNER),
      clientUpdated: "2026-09-18T09:00:00.000Z",
    });
    deps.setLastSyncAt("2026-09-18T09:30:00.000Z");

    harnessWrite(store, "rolls", makeRoll(), "2026-09-18T10:00:00.000Z");
    const spy = jest.spyOn(clock, "now").mockReturnValue("2026-09-18T10:30:00.000Z");
    store.getState().softDelete("rolls", "roll00000000001");
    spy.mockRestore();
    expect(store.getState().outbox).toEqual([
      { collection: "rolls", id: "roll00000000001", op: "delete", at: "2026-09-18T10:30:00.000Z" },
    ]);

    const result = await runSync(deps);

    expect(result.pushed).toBe(1);
    expect(client.record("rolls", "roll00000000001")?.deleted).toBe("2026-09-18T10:30:00.000Z");
    expect(store.getState().outbox).toEqual([]);
  });

  it("collects a failing push, keeps its outbox entry and still processes the rest", async () => {
    const { store, client, deps } = harness();
    client.seed("rolls", {
      ...toRemote("rolls", makeRoll(), OWNER),
      clientUpdated: "2026-09-18T09:00:00.000Z",
    });
    client.failingUpdates.add("rolls/roll00000000001");
    deps.setLastSyncAt("2026-09-18T09:30:00.000Z");

    harnessWrite(store, "rolls", makeRoll({ notes: "local" }), "2026-09-18T10:00:00.000Z");
    harnessWrite(store, "frames", makeFrame(), "2026-09-18T10:00:00.000Z");

    const result = await runSync(deps);

    expect(result.pushed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("rolls/roll00000000001");
    expect(store.getState().outbox).toEqual([
      { collection: "rolls", id: "roll00000000001", op: "upsert", at: "2026-09-18T10:00:00.000Z" },
    ]);
    expect(client.record("frames", "frame0000000001")).toBeDefined();
  });
});

describe("runSync – pull", () => {
  it("applies a remote frame that does not exist locally", async () => {
    const { store, client, deps } = harness();
    deps.setLastSyncAt("2026-09-18T09:00:00.000Z");
    client.seed("frames", {
      ...toRemote("frames", makeFrame({ notes: "shot by the other device" }), OWNER),
      clientUpdated: "2026-09-18T11:00:00.000Z",
    });

    const result = await runSync(deps);

    expect(result.pulled).toBe(1);
    expect(store.getState().entities.frames["frame0000000001"]).toMatchObject({
      id: "frame0000000001",
      notes: "shot by the other device",
      updated: "2026-09-18T11:00:00.000Z",
      owner: OWNER,
    });
  });
});

describe("runSync – last write wins", () => {
  it("lets the newer remote record win and leaves the server untouched", async () => {
    const { store, client, deps } = harness();
    deps.setLastSyncAt("2026-09-18T09:00:00.000Z");
    client.seed("rolls", {
      ...toRemote("rolls", makeRoll({ notes: "from the server" }), OWNER),
      clientUpdated: "2026-09-18T10:05:00.000Z",
    });

    harnessWrite(store, "rolls", makeRoll({ notes: "local" }), "2026-09-18T10:00:00.000Z");

    const result = await runSync(deps);

    expect(result.conflictsLocalWon).toBe(0);
    expect(result.pushed).toBe(0);
    expect(result.pulled).toBe(1);
    expect(client.updateCalls).toEqual([]);
    expect(store.getState().entities.rolls["roll00000000001"]).toMatchObject({
      notes: "from the server",
      updated: "2026-09-18T10:05:00.000Z",
    });
    expect(client.record("rolls", "roll00000000001")?.notes).toBe("from the server");
    expect(store.getState().outbox).toEqual([]);
  });

  it("lets the newer local record win and keeps it after the pull", async () => {
    const { store, client, deps } = harness();
    deps.setLastSyncAt("2026-09-18T09:00:00.000Z");
    client.seed("rolls", {
      ...toRemote("rolls", makeRoll({ notes: "from the server" }), OWNER),
      clientUpdated: "2026-09-18T10:00:00.000Z",
    });

    harnessWrite(store, "rolls", makeRoll({ notes: "local" }), "2026-09-18T10:05:00.000Z");

    const result = await runSync(deps);

    expect(result.conflictsLocalWon).toBe(1);
    expect(result.pushed).toBe(1);
    expect(result.pulled).toBe(0);
    expect(client.record("rolls", "roll00000000001")?.notes).toBe("local");
    expect(store.getState().entities.rolls["roll00000000001"]).toMatchObject({
      notes: "local",
      updated: "2026-09-18T10:05:00.000Z",
    });
  });
});

describe("runSync – seed upload", () => {
  it("uploads the seeded equipment on the first sync and not again on the second", async () => {
    const { store, client, deps } = harness();
    store.getState().seedPresets("2026-09-18T08:00:00.000Z");
    expect(store.getState().outbox).toEqual([]);
    const localCameras = Object.keys(store.getState().entities.cameras).length;
    expect(localCameras).toBeGreaterThan(0);

    const first = await runSync(deps);

    expect(first.errors).toEqual([]);
    expect(client.count("cameras")).toBe(localCameras);
    expect(client.count("film_stocks")).toBeGreaterThan(0);
    expect(first.pushed).toBeGreaterThanOrEqual(localCameras);
    expect(store.getState().lastSyncAt).toBe(WATERMARK);

    const createsAfterFirst = client.createCalls.length;
    const second = await runSync(deps);

    expect(second.pushed).toBe(0);
    expect(second.pulled).toBe(0);
    expect(client.createCalls).toHaveLength(createsAfterFirst);
  });

  it("does not upload the seed data when the server already has cameras", async () => {
    const { store, client, deps } = harness();
    store.getState().seedPresets("2026-09-18T08:00:00.000Z");
    const [someCamera] = Object.values(store.getState().entities.cameras);
    if (someCamera === undefined) throw new Error("expected seeded cameras");
    client.seed("cameras", { ...toRemote("cameras", someCamera, OWNER) });

    const result = await runSync(deps);

    expect(result.pushed).toBe(0);
    expect(client.count("cameras")).toBe(1);
    expect(client.count("film_stocks")).toBe(0);
  });
});

describe("runSync – watermark", () => {
  it("stores a last-sync timestamp no later than the start of the run", async () => {
    const { deps, setLastSyncAt } = harness();

    await runSync(deps);

    expect(setLastSyncAt).toHaveBeenCalledTimes(1);
    const [stored] = setLastSyncAt.mock.calls[0] ?? [];
    expect(typeof stored).toBe("string");
    expect(Date.parse(String(stored))).toBeLessThanOrEqual(Date.parse(START));
    expect(stored).toBe(WATERMARK);
  });

  it("keeps the old watermark when a collection could not be listed", async () => {
    const { client, deps, setLastSyncAt } = harness();
    deps.setLastSyncAt("2026-09-18T09:00:00.000Z");
    setLastSyncAt.mockClear();
    client.failingLists.add("frames");

    const result = await runSync(deps);

    expect(result.errors).toHaveLength(1);
    expect(setLastSyncAt).not.toHaveBeenCalled();
  });
});

/** Local write at a fixed time – shorthand used by the cases above. */
function harnessWrite<K extends CollectionName>(
  store: ReturnType<typeof createAppStore>,
  collection: K,
  record: EntityOf<K>,
  at: ISODateTime,
): void {
  const spy = jest.spyOn(clock, "now").mockReturnValue(at);
  store.getState().upsert(collection, record);
  spy.mockRestore();
}
