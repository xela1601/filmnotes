import {
  FLASH_ID,
  makeCamera,
  makeFilter,
  makeFlash,
  makeFrame,
  makeLens,
  makeRoll,
} from "./fixtures";
import type { FrameContext } from "./types";
import { validateFrame } from "./validation";

function context(overrides: Partial<FrameContext> = {}): FrameContext {
  return {
    camera: makeCamera(),
    roll: makeRoll(),
    lens: makeLens(),
    filters: [makeFilter()],
    flash: null,
    siblingFrames: [],
    ...overrides,
  };
}

describe("validateFrame", () => {
  it("reports nothing for a frame that matches the equipment", () => {
    expect(validateFrame(makeFrame(), context())).toEqual([]);
  });

  it("rule 1: rejects bulb outside the modes the camera allows it in", () => {
    const frame = makeFrame({ shutterSpeed: "bulb", exposureMode: "P" });
    expect(validateFrame(frame, context())).toContainEqual({
      level: "error",
      code: "bulb_only_in_m",
      field: "shutterSpeed",
      params: {},
    });
  });

  it("rule 1: accepts bulb in M", () => {
    const frame = makeFrame({ shutterSpeed: "bulb", exposureMode: "M", support: "tripod" });
    expect(validateFrame(frame, context())).toEqual([]);
  });

  it("rule 2: rejects an aperture the lens does not have", () => {
    const frame = makeFrame({ aperture: 1.7 });
    expect(validateFrame(frame, context())).toContainEqual({
      level: "error",
      code: "aperture_not_on_lens",
      field: "aperture",
      params: {},
    });
  });

  it("rule 3: rejects a filter that does not fit the lens thread", () => {
    const filter = makeFilter({ threadMm: 55 });
    const frame = makeFrame({ filterIds: [filter.id] });
    expect(validateFrame(frame, context({ filters: [filter] }))).toContainEqual({
      level: "error",
      code: "filter_thread_mismatch",
      field: "filterIds",
      params: { filter: "UV 390 (O-Haze)", filterThread: 55, lensThread: 49 },
    });
  });

  it("rule 4: warns about a filter that blocks autofocus", () => {
    const filter = makeFilter({ model: "PL (linear)", afCompatible: "no" });
    const frame = makeFrame({ focusMode: "AF", filterIds: [filter.id] });
    expect(validateFrame(frame, context({ filters: [filter] }))).toContainEqual({
      level: "warning",
      code: "polarizer_blocks_af",
      field: "focusMode",
      params: {},
    });
  });

  it("rule 5: notes that the flash forces the sync speed in M", () => {
    const frame = makeFrame({ exposureMode: "M", shutterSpeed: "1/250", flashId: FLASH_ID });
    expect(validateFrame(frame, context({ flash: makeFlash() }))).toContainEqual({
      level: "info",
      code: "flash_forces_sync_speed",
      field: "shutterSpeed",
      params: { sync: "1/100" },
    });
  });

  it("rule 6: notes that exposure compensation has no effect in M", () => {
    const frame = makeFrame({ exposureMode: "M", exposureCompensationEv: 1.5 });
    expect(validateFrame(frame, context())).toContainEqual({
      level: "info",
      code: "compensation_ignored_in_m",
      field: "exposureCompensationEv",
      params: {},
    });
  });

  it("rule 7: warns about camera shake below the hand-held limit", () => {
    const frame = makeFrame({ shutterSpeed: "1/30", support: "handheld" });
    expect(validateFrame(frame, context())).toContainEqual({
      level: "warning",
      code: "handheld_shake_risk",
      field: "shutterSpeed",
      params: { limit: "1/60" },
    });
  });

  it("rule 7: stays quiet on a tripod", () => {
    const frame = makeFrame({ shutterSpeed: "1/30", support: "tripod" });
    expect(validateFrame(frame, context())).toEqual([]);
  });

  it("rule 8: rejects a focal length the lens does not cover", () => {
    const frame = makeFrame({ focalLengthMm: 100 });
    expect(validateFrame(frame, context())).toContainEqual({
      level: "error",
      code: "focal_length_out_of_range",
      field: "focalLengthMm",
      params: {},
    });
  });

  it("rule 9a: rejects a frame number outside the roll", () => {
    const frame = makeFrame({ frameNo: 40 });
    expect(validateFrame(frame, context())).toContainEqual({
      level: "error",
      code: "frame_no_out_of_range",
      field: "frameNo",
      params: {},
    });
  });

  it("rule 9b: rejects a frame number another frame of the roll already uses", () => {
    const sibling = makeFrame({ id: "sibling0000000", frameNo: 1 });
    expect(validateFrame(makeFrame(), context({ siblingFrames: [sibling] }))).toContainEqual({
      level: "error",
      code: "frame_no_duplicate",
      field: "frameNo",
      params: {},
    });
  });

  it("rule 9b: ignores deleted siblings and the frame itself", () => {
    const frame = makeFrame();
    const deleted = makeFrame({
      id: "sibling0000000",
      frameNo: 1,
      deleted: "2026-09-19T00:00:00.000Z",
    });
    expect(validateFrame(frame, context({ siblingFrames: [deleted, frame] }))).toEqual([]);
  });

  it("rule 10: rejects a speed the camera cannot be set to in that mode", () => {
    const frame = makeFrame({ exposureMode: "M", shutterSpeed: "1/90" });
    expect(validateFrame(frame, context())).toContainEqual({
      level: "error",
      code: "shutter_not_available",
      field: "shutterSpeed",
      params: {},
    });
  });

  it("rule 10: accepts the automatic half stops in P", () => {
    const frame = makeFrame({ exposureMode: "P", shutterSpeed: "1/90" });
    expect(validateFrame(frame, context())).toEqual([]);
  });

  it("skips the lens rules when no lens is recorded", () => {
    const frame = makeFrame({
      lensId: null,
      aperture: 1.7,
      focalLengthMm: 200,
      shutterSpeed: "1/2",
    });
    expect(validateFrame(frame, context({ lens: null, filters: [] }))).toEqual([]);
  });

  it("collects several issues at once", () => {
    const frame = makeFrame({ aperture: 1.7, focalLengthMm: 100, frameNo: 0 });
    const codes = validateFrame(frame, context()).map((issue) => issue.code);
    expect(codes).toEqual([
      "aperture_not_on_lens",
      "focal_length_out_of_range",
      "frame_no_out_of_range",
    ]);
  });
});
