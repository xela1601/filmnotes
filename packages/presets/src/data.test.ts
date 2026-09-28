/**
 * Guards the hand-written JSON in `data/`: a typo in a key, a wrong enum value
 * or a dangling id reference fails here instead of at runtime in the app.
 */
import type { z } from "zod";
import { fillLabTemplate, frameNumberFromFileName, labProfileIssues } from "@filmnotes/domain";
import {
  filmStockPresetsSchema,
  labProfilePresetsSchema,
  presetBundleSchema,
  type PresetBundle,
} from "./schema";

// `require` keeps the JSON out of the emitted declaration types; the schemas
// below are the only thing that gives these values a type.
const rawKit: unknown = require("../data/minolta-7000af-kit.json");
const rawFilmStocks: unknown = require("../data/film-stocks.json");
const rawLabProfiles: unknown = require("../data/lab-profiles.json");

const kitResult = presetBundleSchema.safeParse(rawKit);
const filmStockResult = filmStockPresetsSchema.safeParse(rawFilmStocks);
const labProfileResult = labProfilePresetsSchema.safeParse(rawLabProfiles);

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

describe("lab-profiles.json", () => {
  const dm = () => parsed(labProfileResult).find((profile) => profile.id === "labp0dmdrogerie");

  it("matches the lab profile schema", () => {
    if (!labProfileResult.success) console.error(describeIssues(labProfileResult.error));
    expect(labProfileResult.success).toBe(true);
  });

  it("uses unique ids", () => {
    expect(duplicates(parsed(labProfileResult).map((profile) => profile.id))).toEqual([]);
  });

  it.each(parsed(labProfileResult).map((profile) => profile.id))("%s is usable", (id) => {
    const profile = parsed(labProfileResult).find((candidate) => candidate.id === id);
    expect(profile && labProfileIssues(profile)).toEqual([]);
  });

  it("reads the frame number out of every name of the first dm delivery", () => {
    // The twelve files of order 540996, collected 2026-09-28: negatives 25-36 of a 36 roll.
    const names = Array.from(
      { length: 12 },
      (_, index) => `_Bild${String(index).padStart(3, "0")}_Neg.Nr.${index + 25}.jpg`,
    );
    const pattern = dm()?.scanFrameNumberPattern ?? null;

    expect(names.map((name) => frameNumberFromFileName(pattern, name))).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 25),
    );
  });

  it("downloads with the order number and the Secure-ID from the insert, and nothing else", () => {
    expect(dm()?.download?.params).toEqual(["orderId", "secureId"]);
    const filled = fillLabTemplate(dm()?.download ?? null, {
      orderId: "123456-123456",
      secureId: "a1b2c3d4",
    });
    expect(filled).toMatchObject({ ok: true });
    expect(filled.ok && filled.url).toMatch(
      /^https:\/\/api\.cewe-myphotos\.com\/api\/imageCD\/123456-123456\/a1b2c3d4\/download\?/,
    );
  });

  it("keeps the branch out of the public data: shop and config are parameters, not values", () => {
    // They say which branch, and therefore roughly where, the owner lives (docs/automation.md).
    expect(dm()?.status?.params).toEqual(["config", "shop", "orderId"]);
  });
});
