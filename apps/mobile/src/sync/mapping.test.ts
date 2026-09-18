import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { RemoteRecord } from "./client";
import { fromRemote, toRemote } from "./mapping";
import { makeFrame, makeRoll, makeScan } from "../testing/fixtures";

const OWNER = "user00000000001";

describe("toRemote", () => {
  it("adds owner and clientUpdated and keeps the client id", () => {
    const roll = makeRoll({ updated: "2026-09-18T10:05:00.000Z" });

    const remote = toRemote("rolls", roll, OWNER);

    expect(remote.id).toBe(roll.id);
    expect(remote.owner).toBe(OWNER);
    expect(remote.clientUpdated).toBe("2026-09-18T10:05:00.000Z");
  });

  it("keeps every entity field of a frame, including the location object", () => {
    const frame = makeFrame({
      location: { name: "Isar", lat: 48.1, lon: 11.5 },
      shutterSpeed: "1/125",
      aperture: 5.6,
      filterIds: ["filt0hamauv49a0"],
      notes: "backlit",
    });

    const remote = toRemote("frames", frame, OWNER);

    expect(remote.location).toEqual({ name: "Isar", lat: 48.1, lon: 11.5 });
    expect(remote.shutterSpeed).toBe("1/125");
    expect(remote.aperture).toBe(5.6);
    expect(remote.filterIds).toEqual(["filt0hamauv49a0"]);
    expect(remote.notes).toBe("backlit");
  });

  it("propagates a soft delete", () => {
    const roll = makeRoll({ deleted: "2026-09-18T11:00:00.000Z" });

    expect(toRemote("rolls", roll, OWNER).deleted).toBe("2026-09-18T11:00:00.000Z");
  });
});

describe("fromRemote", () => {
  it("prefers clientUpdated over the server updated timestamp", () => {
    const remote: RemoteRecord = {
      ...toRemote("rolls", makeRoll({ updated: "2026-09-18T10:05:00.000Z" }), OWNER),
      updated: "2026-09-18 12:00:00.000Z",
    };

    expect(fromRemote("rolls", remote).updated).toBe("2026-09-18T10:05:00.000Z");
  });

  it("falls back to the server updated timestamp when clientUpdated is empty", () => {
    const remote: RemoteRecord = {
      ...toRemote("rolls", makeRoll(), OWNER),
      clientUpdated: "",
      updated: "2026-09-18 12:00:00.000Z",
    };

    expect(fromRemote("rolls", remote).updated).toBe("2026-09-18T12:00:00.000Z");
  });

  it("normalises PocketBase date strings and empty values", () => {
    const remote: RemoteRecord = {
      ...toRemote("frames", makeFrame({ takenAt: null, lensId: null }), OWNER),
      created: "2026-09-18 09:00:00.000Z",
      deleted: "",
      takenAt: "",
      lensId: "",
      location: null,
    };

    const frame = fromRemote("frames", remote);

    expect(frame.created).toBe("2026-09-18T09:00:00.000Z");
    expect(frame.deleted).toBeNull();
    expect(frame.takenAt).toBeNull();
    expect(frame.lensId).toBeNull();
    expect(frame.location).toBeNull();
  });

  it("keeps a text field the server sent as a number", () => {
    const remote: RemoteRecord = { ...toRemote("frames", makeFrame(), OWNER), notes: 125 };

    expect(fromRemote("frames", remote).notes).toBe("125");
  });

  it('drops a text field the server sent as an object instead of storing "[object Object]"', () => {
    const remote: RemoteRecord = {
      ...toRemote("frames", makeFrame(), OWNER),
      notes: { expand: "nested record" },
      owner: { id: OWNER },
    };

    const frame = fromRemote("frames", remote);

    expect(frame.notes).toBe("");
    expect(frame.owner).toBeNull();
  });

  it("takes the owner from the remote record and drops unknown fields", () => {
    const remote: RemoteRecord = {
      ...toRemote("rolls", makeRoll(), OWNER),
      collectionId: "pbc_rolls",
      collectionName: "rolls",
      expand: {},
    };

    const roll = fromRemote("rolls", remote);

    expect(roll.owner).toBe(OWNER);
    expect(roll).not.toHaveProperty("collectionId");
    expect(roll).not.toHaveProperty("clientUpdated");
  });
});

describe("round trip", () => {
  it("keeps all fields of a frame", () => {
    const frame = makeFrame({
      takenAt: "2026-09-18T10:02:00.000Z",
      lensId: "lens0min3570f40",
      focalLengthMm: 50,
      exposureMode: "A",
      shutterSpeed: "1/125",
      aperture: 8,
      exposureCompensationEv: -0.5,
      programShift: true,
      aeLock: true,
      focusMode: "AF",
      afResult: "green",
      driveMode: "S",
      flashId: "flash0min2800af",
      flashHead: "bounce",
      flashPower: "Hi",
      flashOk: true,
      filterIds: ["filt0hamauv49a0"],
      lensHood: true,
      support: "tripod",
      beepWarning: true,
      light: "backlight",
      subject: "portrait",
      location: { name: "Isar", lat: 48.1371, lon: 11.5754 },
      notes: "metered for the shadows",
    });

    expect(fromRemote("frames", toRemote("frames", frame, OWNER))).toEqual({
      ...frame,
      owner: OWNER,
    });
  });

  it("keeps all fields of a roll", () => {
    const roll = makeRoll({
      isoSource: "manual",
      isoSet: 400,
      pushPullEv: 1,
      status: "developed",
      unloadedAt: "2026-09-20T10:00:00.000Z",
      lab: "Photolab",
      notes: "pushed one stop",
    });

    expect(fromRemote("rolls", toRemote("rolls", roll, OWNER))).toEqual({
      ...roll,
      owner: OWNER,
    });
  });

  it("keeps all fields of a scan, including the server file name", () => {
    const scan = makeScan({ file: "img001_abc.jpg", width: 1800, height: 1200, frameId: null });

    expect(fromRemote("scans", toRemote("scans", scan, OWNER))).toEqual({
      ...scan,
      owner: OWNER,
    });
  });
});

describe("the payload fixture the backend smoke test posts", () => {
  /**
   * `backend/test/smoke.test.mjs` hand-wrote its request bodies, so the one thing an integration
   * test is for - that what this client *actually sends* is what the server accepts - was not
   * covered. It now posts these records, and this test keeps them equal to `toRemote`'s output.
   *
   * Regenerate after a mapping change: `UPDATE_FIXTURES=1 npx jest mapping.test`.
   */
  const fixturePath = join(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "backend",
    "test",
    "fixtures",
    "remote-records.json",
  );

  const payloads = {
    rolls: toRemote("rolls", makeRoll({ id: "roll0smoketest2" }), OWNER),
    frames: toRemote(
      "frames",
      makeFrame({ id: "fram0smoketest2", rollId: "roll0smoketest2" }),
      OWNER,
    ),
    scans: toRemote(
      "scans",
      makeScan({ id: "scan0smoketest2", rollId: "roll0smoketest2", frameId: null, file: null }),
      OWNER,
    ),
  };

  it("matches the checked-in fixture", () => {
    const serialised = `${JSON.stringify(payloads, null, 2)}\n`;
    if (process.env.UPDATE_FIXTURES === "1") {
      mkdirSync(dirname(fixturePath), { recursive: true });
      writeFileSync(fixturePath, serialised);
    }

    expect(readFileSync(fixturePath, "utf8")).toBe(serialised);
  });
});
