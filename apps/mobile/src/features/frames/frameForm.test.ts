import { makeFilter, makeFrame, makeLens } from "../../testing/fixtures";
import {
  LIGHT_OPTIONS,
  SUBJECT_OPTIONS,
  applyLensChange,
  exposureFields,
  parseTakenAt,
  takenAtFields,
  filterOptions,
  focalLengthOptions,
} from "./frameForm";

/** The three lenses of the shipped Minolta preset. */
const zoom3570 = makeLens();
const prime50 = makeLens({
  id: "lens0min50f1700",
  model: "AF 50mm f/1.7",
  focalMinMm: 50,
  focalMaxMm: 50,
  maxAperture: 1.7,
  apertureValues: [1.7, 2, 2.8, 4, 5.6, 8, 11, 16, 22],
  filterThreadMm: 49,
  defaultFilterIds: ["filt0hamauv49b0"],
});
const zoom70210 = makeLens({
  id: "lens0min70210f4",
  model: "AF Zoom 70-210mm f/4",
  focalMinMm: 70,
  focalMaxMm: 210,
  filterThreadMm: 55,
  defaultFilterIds: ["filt0hamauv5500"],
  handheldMinShutter: "1/250",
  hasHood: true,
});

const uv49 = makeFilter();
const uv55 = makeFilter({ id: "filt0hamauv5500", model: "UV 390 M55", threadMm: 55 });
const polarizer49 = makeFilter({
  id: "filt0kenkopl490",
  model: "PL (linear) 49",
  threadMm: 49,
  type: "polarizer_linear",
  afCompatible: "no",
});
const allFilters = [uv49, uv55, polarizer49];

describe("exposureFields", () => {
  it("attributes both halves to the camera in P, and keeps recording them", () => {
    expect(exposureFields("P")).toEqual({
      shutter: "camera",
      aperture: "camera",
      programShift: true,
      compensation: true,
    });
  });

  it("splits the pair in A and S", () => {
    expect(exposureFields("A")).toEqual({
      shutter: "camera",
      aperture: "photographer",
      programShift: false,
      compensation: true,
    });
    expect(exposureFields("S")).toEqual({
      shutter: "photographer",
      aperture: "camera",
      programShift: false,
      compensation: true,
    });
  });

  it("gives both to the photographer in M, where program shift and compensation have no effect", () => {
    expect(exposureFields("M")).toEqual({
      shutter: "photographer",
      aperture: "photographer",
      programShift: false,
      compensation: false,
    });
  });

  it("attributes nothing to the camera while the mode is unknown", () => {
    const fields = exposureFields(null);
    expect(fields.shutter).toBe("photographer");
    expect(fields.aperture).toBe("photographer");
    expect(fields.programShift).toBe(false);
    expect(fields.compensation).toBe(true);
  });
});

describe("focalLengthOptions", () => {
  it("lists the marks engraved on a zoom ring, including both ends", () => {
    expect(focalLengthOptions(zoom3570)).toEqual([35, 50, 70]);
    expect(focalLengthOptions(zoom70210)).toEqual([70, 100, 135, 150, 210]);
  });

  it("offers the single focal length of a prime", () => {
    expect(focalLengthOptions(prime50)).toEqual([50]);
  });

  it("knows nothing without a lens", () => {
    expect(focalLengthOptions(null)).toEqual([]);
  });
});

describe("filterOptions", () => {
  it("only offers filters that fit the filter thread of the lens", () => {
    expect(filterOptions(allFilters, zoom3570)).toEqual([uv49, polarizer49]);
    expect(filterOptions(allFilters, zoom70210)).toEqual([uv55]);
  });

  it("offers everything while no lens is selected", () => {
    expect(filterOptions(allFilters, null)).toEqual(allFilters);
  });
});

describe("applyLensChange", () => {
  it("swaps the filters and the focal length when the lens changes", () => {
    const frame = makeFrame({
      lensId: zoom3570.id,
      focalLengthMm: 50,
      filterIds: [uv49.id, polarizer49.id],
      lensHood: false,
    });

    const changed = applyLensChange(frame, zoom70210, allFilters);

    expect(changed.lensId).toBe(zoom70210.id);
    expect(changed.focalLengthMm).toBe(70);
    expect(changed.filterIds).toEqual([uv55.id]);
  });

  it("drops the lens hood when the new lens has none", () => {
    const frame = makeFrame({ lensId: zoom70210.id, focalLengthMm: 210, lensHood: true });

    expect(applyLensChange(frame, zoom3570, allFilters).lensHood).toBe(false);
    expect(applyLensChange(frame, zoom70210, allFilters).lensHood).toBe(true);
  });

  it("keeps filters that still fit and does not duplicate the defaults", () => {
    const frame = makeFrame({ lensId: prime50.id, filterIds: [polarizer49.id, uv49.id] });

    const changed = applyLensChange(frame, zoom3570, allFilters);

    expect(changed.filterIds).toEqual([polarizer49.id, uv49.id]);
  });

  it("clears lens, focal length and hood when the lens is removed", () => {
    const frame = makeFrame({ lensId: zoom70210.id, focalLengthMm: 210, lensHood: true });

    const changed = applyLensChange(frame, null, allFilters);

    expect(changed.lensId).toBeNull();
    expect(changed.focalLengthMm).toBeNull();
    expect(changed.lensHood).toBe(false);
  });
});

describe("option catalogues", () => {
  it("lists the light situations and subjects of the spec", () => {
    expect(LIGHT_OPTIONS).toEqual([
      "sun",
      "cloudy",
      "shade",
      "indoor_window",
      "indoor_artificial",
      "night",
      "backlight",
      "snow_beach",
    ]);
    expect(SUBJECT_OPTIONS).toEqual([
      "portrait",
      "landscape",
      "street",
      "sport",
      "macro",
      "group",
      "night",
      "other",
    ]);
  });
});

describe("takenAtFields / parseTakenAt", () => {
  const MUNICH = "Europe/Berlin";

  it("shows the local wall clock of the stored instant", () => {
    expect(takenAtFields("2026-09-18T22:30:00.000Z", MUNICH)).toEqual({
      date: "2026-09-19",
      time: "00:30",
    });
  });

  it("has no fields without a timestamp", () => {
    expect(takenAtFields(null, MUNICH)).toEqual({ date: "", time: "" });
  });

  it("reads both fields back into the instant", () => {
    expect(parseTakenAt("2026-09-19", "00:30", MUNICH)).toEqual({
      kind: "ok",
      instant: "2026-09-18T22:30:00.000Z",
    });
  });

  it("treats two empty fields as 'no time recorded'", () => {
    expect(parseTakenAt("", "", MUNICH)).toEqual({ kind: "empty" });
    expect(parseTakenAt("  ", " ", MUNICH)).toEqual({ kind: "empty" });
  });

  it("reports a half-typed time instead of falling back to midnight", () => {
    expect(parseTakenAt("2026-09-19", "9:5", MUNICH)).toEqual({ kind: "invalid", field: "time" });
    expect(parseTakenAt("2026-09-19", "", MUNICH)).toEqual({ kind: "invalid", field: "time" });
  });

  it("reports an impossible date instead of rolling it over", () => {
    expect(parseTakenAt("2026-13-45", "10:00", MUNICH)).toEqual({ kind: "invalid", field: "date" });
    expect(parseTakenAt("", "10:00", MUNICH)).toEqual({ kind: "invalid", field: "date" });
  });
});
