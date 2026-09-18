/**
 * Guards the hand-written JSON in `data/`: a typo in a key, a wrong enum value
 * or a dangling id reference fails here instead of at runtime in the app.
 */
import type { z } from "zod";
import { filmStockPresetsSchema, presetBundleSchema, type PresetBundle } from "./schema";

// `require` keeps the JSON out of the emitted declaration types; the schemas
// below are the only thing that gives these values a type.
const rawKit: unknown = require("../data/minolta-7000af-kit.json");
const rawFilmStocks: unknown = require("../data/film-stocks.json");

const kitResult = presetBundleSchema.safeParse(rawKit);
const filmStockResult = filmStockPresetsSchema.safeParse(rawFilmStocks);

function describeIssues(error: z.ZodError): string {
  return JSON.stringify(error.issues, null, 2);
}

function parsed<T>(result: z.SafeParseReturnType<unknown, T>): T {
  if (!result.success)
    throw new Error(`data does not match its schema:\n${describeIssues(result.error)}`);
  return result.data;
}

function duplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  return ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
}

function bundleIds(bundle: PresetBundle): string[] {
  return [
    ...bundle.cameras.map((record) => record.id),
    ...bundle.lenses.map((record) => record.id),
    ...bundle.filters.map((record) => record.id),
    ...bundle.flashes.map((record) => record.id),
  ];
}

describe("minolta-7000af-kit.json", () => {
  it("matches the preset bundle schema", () => {
    if (!kitResult.success) console.error(describeIssues(kitResult.error));
    expect(kitResult.success).toBe(true);
  });

  it("uses unique ids across all record types", () => {
    const ids = bundleIds(parsed(kitResult));
    expect(duplicates(ids)).toEqual([]);
  });

  it("only references ids that exist in the bundle", () => {
    const bundle = parsed(kitResult);
    const lensIds = new Set(bundle.lenses.map((lens) => lens.id));
    const filterIds = new Set(bundle.filters.map((filter) => filter.id));

    for (const lens of bundle.lenses) {
      for (const filterId of lens.defaultFilterIds) {
        expect({ lens: lens.id, filterId, known: filterIds.has(filterId) }).toMatchObject({
          known: true,
        });
      }
    }
    for (const filter of bundle.filters) {
      if (filter.mountedOnLensId === null) continue;
      expect({
        filter: filter.id,
        lensId: filter.mountedOnLensId,
        known: lensIds.has(filter.mountedOnLensId),
      }).toMatchObject({ known: true });
    }
    for (const camera of bundle.cameras) {
      const defaults = camera.defaultsForNewFrame;
      if (defaults.lensId !== null) {
        expect({
          camera: camera.id,
          lensId: defaults.lensId,
          known: lensIds.has(defaults.lensId),
        }).toMatchObject({ known: true });
      }
      for (const filterId of defaults.filterIds) {
        expect({ camera: camera.id, filterId, known: filterIds.has(filterId) }).toMatchObject({
          known: true,
        });
      }
      if (defaults.flashId !== null) {
        const flashIds = new Set(bundle.flashes.map((flash) => flash.id));
        expect({
          camera: camera.id,
          flashId: defaults.flashId,
          known: flashIds.has(defaults.flashId),
        }).toMatchObject({ known: true });
      }
    }
  });

  it("mounts every filter on a lens with a matching filter thread", () => {
    const bundle = parsed(kitResult);
    for (const filter of bundle.filters) {
      if (filter.mountedOnLensId === null) continue;
      const lens = bundle.lenses.find((candidate) => candidate.id === filter.mountedOnLensId);
      expect(lens).toBeDefined();
      expect({ filter: filter.id, threadMm: filter.threadMm }).toEqual({
        filter: filter.id,
        threadMm: lens?.filterThreadMm,
      });
    }
  });
});

describe("film-stocks.json", () => {
  it("matches the film stock schema", () => {
    if (!filmStockResult.success) console.error(describeIssues(filmStockResult.error));
    expect(filmStockResult.success).toBe(true);
  });

  it("uses unique ids", () => {
    expect(duplicates(parsed(filmStockResult).map((stock) => stock.id))).toEqual([]);
  });

  it("ships at least 20 stocks", () => {
    expect(parsed(filmStockResult).length).toBeGreaterThanOrEqual(20);
  });

  it("contains Kodak Gold 200 as a colour C41 film", () => {
    const gold = parsed(filmStockResult).find((stock) => stock.name === "Kodak Gold 200");
    expect(gold).toMatchObject({ iso: 200, process: "C41", color: true });
  });
});
