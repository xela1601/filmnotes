import { FIXTURE_NOW, FILTER_ID, LENS_ID, ROLL_ID, makeCamera, makeFrame } from "./fixtures";
import { newFrame, nextFrameNo } from "./frameDefaults";
import { ID_PATTERN } from "./id";
import type { Camera, Frame } from "./types";

const LATER: string = "2026-09-19T12:00:00.000Z";

describe("nextFrameNo", () => {
  it("starts at 1 on an empty roll", () => {
    expect(nextFrameNo([])).toBe(1);
  });

  it("continues after the highest frame number", () => {
    const frames = [1, 2, 3].map((frameNo) =>
      makeFrame({ id: `frame${frameNo}00000000`, frameNo }),
    );
    expect(nextFrameNo(frames)).toBe(4);
  });

  it("leaves gaps alone", () => {
    const frames = [1, 3].map((frameNo) => makeFrame({ id: `frame${frameNo}00000000`, frameNo }));
    expect(nextFrameNo(frames)).toBe(4);
  });

  it("ignores deleted frames", () => {
    const frames = [
      makeFrame({ id: "frame100000000", frameNo: 1 }),
      makeFrame({ id: "frame900000000", frameNo: 9, deleted: LATER }),
    ];
    expect(nextFrameNo(frames)).toBe(2);
  });
});

describe("newFrame without a previous frame", () => {
  const camera = makeCamera();
  const frame = newFrame({ rollId: ROLL_ID, frameNo: 1, camera, previous: null, now: LATER });

  it("generates a PocketBase shaped id", () => {
    expect(frame.id).toMatch(ID_PATTERN);
  });

  it("stamps the roll, the frame number and the timestamps", () => {
    expect(frame.rollId).toBe(ROLL_ID);
    expect(frame.frameNo).toBe(1);
    expect(frame.takenAt).toBe(LATER);
    expect(frame.created).toBe(LATER);
    expect(frame.updated).toBe(LATER);
    expect(frame.deleted).toBeNull();
    expect(frame.owner).toBeNull();
  });

  it("copies the camera defaults for a new frame", () => {
    expect(frame.exposureMode).toBe("P");
    expect(frame.driveMode).toBe("S");
    expect(frame.focusMode).toBe("AF");
    expect(frame.lensId).toBe(LENS_ID);
    expect(frame.filterIds).toEqual([FILTER_ID]);
    expect(frame.flashId).toBeNull();
    expect(frame.support).toBe("handheld");
    expect(frame.exposureCompensationEv).toBe(0);
    expect(frame.programShift).toBe(false);
    expect(frame.aeLock).toBe(false);
  });

  it("leaves everything that is shot-specific empty", () => {
    expect(frame.shutterSpeed).toBeNull();
    expect(frame.aperture).toBeNull();
    expect(frame.focalLengthMm).toBeNull();
    expect(frame.afResult).toBeNull();
    expect(frame.flashHead).toBeNull();
    expect(frame.flashPower).toBeNull();
    expect(frame.flashOk).toBeNull();
    expect(frame.lensHood).toBe(false);
    expect(frame.beepWarning).toBe(false);
    expect(frame.light).toBeNull();
    expect(frame.subject).toBeNull();
    expect(frame.location).toBeNull();
    expect(frame.notes).toBe("");
  });

  it("does not share the filter array with the camera defaults", () => {
    const cameraWithDefaults = makeCamera();
    const created = newFrame({
      rollId: ROLL_ID,
      frameNo: 1,
      camera: cameraWithDefaults,
      previous: null,
      now: LATER,
    });
    created.filterIds.push("extra0000000000");
    expect(cameraWithDefaults.defaultsForNewFrame.filterIds).toEqual([FILTER_ID]);
  });
});

describe("newFrame with a previous frame", () => {
  const camera = makeCamera();
  const previous: Frame = makeFrame({
    id: "previous000000",
    frameNo: 4,
    lensId: "otherlens00000",
    focalLengthMm: 70,
    filterIds: ["otherfilter000"],
    flashId: "otherflash0000",
    flashHead: "bounce",
    flashPower: "Hi",
    exposureMode: "M",
    focusMode: "M",
    driveMode: "C",
    support: "tripod",
    lensHood: true,
    light: "backlight",
    shutterSpeed: "1/30",
    aperture: 8,
    notes: "watch the puddle",
    location: { name: "Isar", lat: null, lon: null },
    takenAt: FIXTURE_NOW,
    afResult: "red_blink",
    flashOk: true,
    beepWarning: true,
    subject: "street",
    exposureCompensationEv: 1.5,
    programShift: true,
    aeLock: true,
  });
  const frame = newFrame({ rollId: ROLL_ID, frameNo: 5, camera, previous, now: LATER });

  it("carries the setup of the previous frame over", () => {
    expect(frame.lensId).toBe("otherlens00000");
    expect(frame.focalLengthMm).toBe(70);
    expect(frame.filterIds).toEqual(["otherfilter000"]);
    expect(frame.flashId).toBe("otherflash0000");
    expect(frame.flashHead).toBe("bounce");
    expect(frame.flashPower).toBe("Hi");
    expect(frame.exposureMode).toBe("M");
    expect(frame.focusMode).toBe("M");
    expect(frame.driveMode).toBe("C");
    expect(frame.support).toBe("tripod");
    expect(frame.lensHood).toBe(true);
    expect(frame.light).toBe("backlight");
  });

  it("does not carry the exposure of the previous frame over", () => {
    expect(frame.shutterSpeed).toBeNull();
    expect(frame.aperture).toBeNull();
    expect(frame.notes).toBe("");
    expect(frame.location).toBeNull();
    expect(frame.takenAt).toBe(LATER);
    expect(frame.afResult).toBeNull();
    expect(frame.flashOk).toBeNull();
    expect(frame.beepWarning).toBe(false);
    expect(frame.subject).toBeNull();
  });

  it("resets compensation, program shift and AE lock to the camera defaults", () => {
    expect(frame.exposureCompensationEv).toBe(0);
    expect(frame.programShift).toBe(false);
    expect(frame.aeLock).toBe(false);
  });

  it("is a new record, not a copy of the previous one", () => {
    expect(frame.id).toMatch(ID_PATTERN);
    expect(frame.id).not.toBe(previous.id);
    expect(frame.frameNo).toBe(5);
    previous.filterIds.push("yetanother0000");
    expect(frame.filterIds).toEqual(["otherfilter000"]);
  });
});

describe("newFrame with a previous frame without equipment", () => {
  it("keeps the empty setup instead of falling back to the camera defaults", () => {
    const previous = makeFrame({
      id: "previous000000",
      lensId: null,
      filterIds: [],
      flashId: null,
    });
    const frame = newFrame({
      rollId: ROLL_ID,
      frameNo: 2,
      camera: makeCamera(),
      previous,
      now: LATER,
    });
    expect(frame.lensId).toBeNull();
    expect(frame.filterIds).toEqual([]);
  });
});

describe("newFrame with a camera the admin UI blanked", () => {
  it("falls back instead of throwing when defaultsForNewFrame is missing", () => {
    // PocketBase answers `null` for an unset json field; the mapping passes that through, and
    // every new frame on that camera used to throw on the first property access.
    const camera = { ...makeCamera(), defaultsForNewFrame: null } as unknown as Camera;

    const frame = newFrame({
      rollId: "roll00000000001",
      frameNo: 1,
      camera,
      previous: null,
      now: "2026-09-18T10:00:00.000Z",
    });

    expect(frame.exposureMode).toBeNull();
    expect(frame.lensId).toBeNull();
    expect(frame.filterIds).toEqual([]);
    expect(frame.exposureCompensationEv).toBe(0);
  });
});
