import { buildCaption } from "@filmnotes/domain";
import {
  makeCamera,
  makeFilmStock,
  makeFilter,
  makeFrame,
  makeLens,
  makeRoll,
} from "@filmnotes/domain/testing";
import { shareExporter } from "./share";
import type { ExporterDeps, ExportImage, ExportInput } from "./types";

const IMAGE: ExportImage = {
  bytes: new Uint8Array([1, 2, 3]),
  mimeType: "image/jpeg",
  fileName: "roll1-12.jpg",
};

/** A fetch that fails the test as soon as the share exporter touches the network. */
const deps: ExporterDeps = {
  fetch: () => {
    throw new Error("the share exporter must not use fetch");
  },
};

function makeInput(overrides: Partial<ExportInput> = {}): ExportInput {
  const frame = makeFrame({ frameNo: 12, notes: "Late afternoon light" });
  const roll = makeRoll();
  const camera = makeCamera();
  const lens = makeLens();
  const filters = [makeFilter()];
  const filmStock = makeFilmStock();
  return {
    frame,
    roll,
    camera,
    lens,
    filters,
    filmStock,
    caption: buildCaption({ frame, roll, camera, lens, filters, filmStock }),
    image: IMAGE,
    ...overrides,
  };
}

describe("shareExporter", () => {
  it("is identified as the share target and needs no image", () => {
    expect(shareExporter.id).toBe("share");
    expect(shareExporter.nameKey).toBe("exporters.share");
    expect(shareExporter.requiresImage).toBe(false);
  });

  it("accepts an empty config object", () => {
    expect(shareExporter.configSchema.parse({})).toEqual({});
  });

  it("returns the caption as share text and passes the image through", async () => {
    const input = makeInput();

    const result = await shareExporter.exportFrame(input, {}, deps);

    expect(result.sharePayload).toEqual({ text: input.caption, image: IMAGE });
    expect(result.sharePayload?.image).toBe(IMAGE);
    expect(result.externalId).toBeNull();
    expect(result.url).toBeNull();
  });

  it("shares the caption alone when the frame has no image", async () => {
    const result = await shareExporter.exportFrame(makeInput({ image: null }), {}, deps);

    expect(result.sharePayload?.image).toBeNull();
    expect(result.sharePayload?.text).toContain("Kodak Gold 200");
  });
});
