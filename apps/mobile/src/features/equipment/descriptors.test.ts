/**
 * Tests for the field descriptors behind the generic equipment editor.
 *
 * The descriptors are the only place that knows which fields a piece of equipment has,
 * so these tests pin the contract the editor and the list screen rely on.
 */
import type { Camera, FilmStock, Lens } from "@filmnotes/domain";

import { makeCamera, makeFilmStock, makeFilter, makeFlash, makeLens } from "../../testing/fixtures";
import {
  DESCRIPTORS,
  EQUIPMENT_TYPES,
  decodeOption,
  displayName,
  encodeOption,
  emptyRecord,
  isEquipmentType,
  readField,
  validateRecord,
  writeField,
  type EquipmentType,
  type FieldDescriptor,
} from "./descriptors";

const NOW = "2026-09-18T10:00:00.000Z";

describe("DESCRIPTORS", () => {
  it("covers every equipment type", () => {
    expect(EQUIPMENT_TYPES).toEqual(["cameras", "lenses", "filters", "flashes", "filmStocks"]);
    for (const type of EQUIPMENT_TYPES) {
      expect(DESCRIPTORS[type].length).toBeGreaterThan(0);
    }
  });

  it("describes only fields that exist on the empty record", () => {
    // `null` is a value (an unset year), `undefined` means the key is not on the record.
    const missing: string[] = [];
    for (const type of EQUIPMENT_TYPES) {
      const record = emptyRecord(type, NOW);
      for (const field of DESCRIPTORS[type]) {
        if (readField(record, field.key) === undefined) missing.push(`${type}.${field.key}`);
      }
    }

    expect(missing).toEqual([]);
  });

  it("gives every field a label key and every choice field its options", () => {
    for (const type of EQUIPMENT_TYPES) {
      for (const field of DESCRIPTORS[type]) {
        expect(field.labelKey).toMatch(/^fields\./);
        if (field.kind === "select" || field.kind === "multiselect") {
          const hasChoices = field.options !== undefined || field.optionsFrom !== undefined;
          expect({ key: field.key, hasChoices }).toEqual({ key: field.key, hasChoices: true });
        }
      }
    }
  });

  it("uses each field key only once per type", () => {
    for (const type of EQUIPMENT_TYPES) {
      const keys = DESCRIPTORS[type].map((field) => field.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe("emptyRecord", () => {
  it("stamps the sync fields of a fresh record", () => {
    for (const type of EQUIPMENT_TYPES) {
      const record = emptyRecord(type, NOW);
      expect(record.id).toMatch(/^[a-z0-9]{15}$/);
      expect(record.created).toBe(NOW);
      expect(record.updated).toBe(NOW);
      expect(record.deleted).toBeNull();
      expect(record.owner).toBeNull();
    }
  });

  it("starts a lens without apertures and without a hood", () => {
    const lens: Lens = emptyRecord("lenses", NOW);

    expect(lens.apertureValues).toEqual([]);
    expect(lens.hasHood).toBe(false);
    expect(lens.defaultFilterIds).toEqual([]);
    expect(lens.handheldMinShutter).toBeNull();
  });

  it("gives a new camera usable exposure ranges, so the frame screen can dial them", () => {
    const camera: Camera = emptyRecord("cameras", NOW);

    expect(camera.format).toBe("135");
    expect(camera.exposureCompensation.min).toBeLessThan(0);
    expect(camera.exposureCompensation.max).toBeGreaterThan(0);
    expect(camera.exposureCompensation.step).toBeGreaterThan(0);
    expect(camera.iso.min).toBeGreaterThan(0);
    expect(camera.iso.max).toBeGreaterThan(camera.iso.min);
    expect(camera.defaultsForNewFrame.filterIds).toEqual([]);
    expect(camera.defaultsForNewFrame.lensId).toBeNull();
  });

  it("starts a film stock without a speed", () => {
    const stock: FilmStock = emptyRecord("filmStocks", NOW);

    expect(stock.iso).toBe(0);
    expect(stock.process).toBe("C41");
    expect(stock.exposures).toBe(36);
  });

  it("generates a new id every time", () => {
    expect(emptyRecord("flashes", NOW).id).not.toBe(emptyRecord("flashes", NOW).id);
  });
});

describe("validateRecord", () => {
  it("accepts the shipped preset records", () => {
    expect(validateRecord("cameras", makeCamera())).toEqual({});
    expect(validateRecord("lenses", makeLens())).toEqual({});
    expect(validateRecord("filters", makeFilter())).toEqual({});
    expect(validateRecord("flashes", makeFlash())).toEqual({});
    expect(validateRecord("filmStocks", makeFilmStock())).toEqual({});
  });

  it("requires make and model on equipment", () => {
    expect(validateRecord("cameras", makeCamera({ make: "", model: "  " }))).toEqual({
      make: "required",
      model: "required",
    });
    expect(validateRecord("lenses", makeLens({ make: "" }))).toEqual({ make: "required" });
    expect(validateRecord("filters", makeFilter({ model: "" }))).toEqual({ model: "required" });
    expect(validateRecord("flashes", makeFlash({ make: "" }))).toEqual({ make: "required" });
  });

  it("requires name and maker on a film stock", () => {
    expect(validateRecord("filmStocks", makeFilmStock({ name: "", maker: "" }))).toEqual({
      name: "required",
      maker: "required",
    });
  });

  it("requires a positive film speed", () => {
    expect(validateRecord("filmStocks", makeFilmStock({ iso: 0 }))).toEqual({ iso: "required" });
    expect(validateRecord("filmStocks", makeFilmStock({ iso: -100 }))).toEqual({ iso: "invalid" });
    expect(validateRecord("filmStocks", makeFilmStock({ iso: 800 }))).toEqual({});
  });

  it("rejects a focal range that runs backwards", () => {
    expect(validateRecord("lenses", makeLens({ focalMinMm: 70, focalMaxMm: 35 }))).toEqual({
      focalMaxMm: "invalid",
    });
    expect(validateRecord("lenses", makeLens({ focalMinMm: 50, focalMaxMm: 50 }))).toEqual({});
  });

  it("accepts shutter lists the camera can display, bulb included", () => {
    const camera = makeCamera({
      shutterSpeedsManual: ["1/1000", "1/60", '1"5', '30"', "bulb"],
      shutterSpeedsAutoExtra: ["1/90"],
    });

    expect(validateRecord("cameras", camera)).toEqual({});
  });

  it("rejects an unparseable shutter speed in a shutter list", () => {
    const camera = makeCamera({ shutterSpeedsManual: ["1/125", "fast"] });

    expect(validateRecord("cameras", camera)).toEqual({ shutterSpeedsManual: "invalid" });
  });

  it("rejects an unparseable single shutter speed", () => {
    expect(validateRecord("lenses", makeLens({ handheldMinShutter: "1/" }))).toEqual({
      handheldMinShutter: "invalid",
    });
    expect(validateRecord("lenses", makeLens({ handheldMinShutter: "1/125" }))).toEqual({});
    expect(validateRecord("lenses", makeLens({ handheldMinShutter: null }))).toEqual({});
    expect(validateRecord("flashes", makeFlash({ sync: "x" }))).toEqual({ sync: "invalid" });
    expect(validateRecord("cameras", makeCamera({ flashSync: "x" }))).toEqual({
      flashSync: "invalid",
    });
  });
});

describe("displayName", () => {
  it("names equipment by make and model, film stocks by their name", () => {
    expect(displayName("cameras", makeCamera())).toBe("Minolta 7000 AF");
    expect(displayName("lenses", makeLens())).toBe("Minolta AF Zoom 35-70mm f/4");
    expect(displayName("filters", makeFilter())).toBe("Hama UV 390 49");
    expect(displayName("flashes", makeFlash())).toBe("Minolta Program Flash 2800 AF");
    expect(displayName("filmStocks", makeFilmStock())).toBe("Kodak Gold 200");
  });

  it("returns an empty name for an untouched record", () => {
    for (const type of EQUIPMENT_TYPES) {
      expect(displayName(type, emptyRecord(type, NOW))).toBe("");
    }
  });
});

describe("readField / writeField", () => {
  it("reads and writes nested keys without touching the rest of the record", () => {
    const camera = makeCamera();

    const patched = writeField(camera, "iso.max", 12800);

    expect(readField(patched, "iso.max")).toBe(12800);
    expect(readField(patched, "iso.min")).toBe(camera.iso.min);
    expect(readField(patched, "defaultsForNewFrame.lensId")).toBe("lens0min3570f40");
    // The original record is untouched: the editor keeps the stored record around.
    expect(camera.iso.max).toBe(6400);
  });

  it("writes a top level key", () => {
    expect(readField(writeField(makeLens(), "hasHood", true), "hasHood")).toBe(true);
  });

  it("returns undefined for a key the record does not have", () => {
    expect(readField(makeLens(), "nope")).toBeUndefined();
    expect(readField(makeLens(), "hasHood.nope")).toBeUndefined();
  });
});

describe("encodeOption / decodeOption", () => {
  const field = (key: string, type: EquipmentType): FieldDescriptor => {
    const found = DESCRIPTORS[type].find((candidate) => candidate.key === key);
    if (found === undefined) throw new Error(`no descriptor for ${type}.${key}`);
    return found;
  };

  it("round-trips a plain string option", () => {
    const afCompatible = field("afCompatible", "filters");

    expect(encodeOption(afCompatible, "limited")).toBe("limited");
    expect(decodeOption(afCompatible, "limited")).toBe("limited");
    expect(encodeOption(afCompatible, null)).toBeNull();
  });

  it("round-trips the number of exposures", () => {
    const exposures = field("exposures", "filmStocks");

    expect(encodeOption(exposures, 36)).toBe("36");
    expect(decodeOption(exposures, "24")).toBe(24);
    // Nullable: a film stock does not have to state its length.
    expect(decodeOption(exposures, null)).toBeNull();
  });

  it("maps the DX coding onto yes / no / unknown", () => {
    const dxCoded = field("dxCoded", "filmStocks");

    expect(encodeOption(dxCoded, true)).toBe("yes");
    expect(encodeOption(dxCoded, false)).toBe("no");
    expect(encodeOption(dxCoded, null)).toBe("unknown");
    expect(decodeOption(dxCoded, "yes")).toBe(true);
    expect(decodeOption(dxCoded, "no")).toBe(false);
    expect(decodeOption(dxCoded, "unknown")).toBeNull();
  });
});

describe("isEquipmentType", () => {
  it("recognises the collection names used in the routes", () => {
    expect(isEquipmentType("cameras")).toBe(true);
    expect(isEquipmentType("filmStocks")).toBe(true);
    expect(isEquipmentType("rolls")).toBe(false);
    expect(isEquipmentType("")).toBe(false);
  });

  it("narrows to the descriptor key", () => {
    const value: string = "lenses";
    if (!isEquipmentType(value)) throw new Error("expected an equipment type");
    const type: EquipmentType = value;

    expect(DESCRIPTORS[type]).toBe(DESCRIPTORS.lenses);
  });
});
