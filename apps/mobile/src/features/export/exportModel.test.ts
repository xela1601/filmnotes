import type { ExportImage } from "@filmnotes/exporters";

import {
  captionFor,
  exportInputFor,
  isWordPressConfigured,
  wordPressConfigFor,
} from "./exportModel";
import { createAppStore, DEFAULT_SETTINGS, type AppState, type Settings } from "../../store/store";
import {
  makeCamera,
  makeFilmStock,
  makeFilter,
  makeFrame,
  makeLens,
  makeRoll,
} from "../../testing/fixtures";

/** A state built from an isolated store, so the persisted app store stays untouched. */
function stateWith(seed: (store: ReturnType<typeof createAppStore>) => void): AppState {
  const store = createAppStore({
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  });
  seed(store);
  return store.getState();
}

const FRAME = makeFrame({
  lensId: "lens0min3570f40",
  focalLengthMm: 50,
  aperture: 8,
  shutterSpeed: "1/125",
  exposureMode: "A",
  filterIds: ["filt0hamauv49a0"],
  location: { name: "Isarauen", lat: null, lon: null },
  notes: "Low sun through the trees",
});

/** Seeds the records `buildCaption` needs, plus the settings patch under test. */
function completeState(settings: Partial<Settings> = {}): AppState {
  return stateWith((store) => {
    const { applyRemote, updateSettings } = store.getState();
    applyRemote("cameras", [makeCamera()]);
    applyRemote("lenses", [makeLens()]);
    applyRemote("filters", [makeFilter()]);
    applyRemote("filmStocks", [makeFilmStock()]);
    applyRemote("rolls", [makeRoll()]);
    applyRemote("frames", [FRAME]);
    updateSettings(settings);
  });
}

const IMAGE: ExportImage = {
  bytes: new Uint8Array([1, 2, 3]),
  mimeType: "image/jpeg",
  fileName: "img001.jpg",
};

describe("captionFor", () => {
  it("builds the default caption from the frame and its equipment", () => {
    const caption = captionFor(completeState({ locale: "de" }), FRAME);

    expect(caption).toContain(
      "Kodak Gold 200 · Minolta 7000 AF · Minolta AF Zoom 35-70mm f/4 @ 50mm",
    );
    expect(caption).toContain("f/8 · 1/125 · A");
    expect(caption).toContain("📍 Isarauen");
    expect(caption).toContain("Low sun through the trees");
    expect(caption).toContain("#analog #35mm #filmphotography #kodakgold200");
  });

  it("uses the caption template from the settings", () => {
    const state = completeState({
      locale: "de",
      captionTemplate: "{{filmStock}} | {{camera}}{{#location}} | {{location}}{{/location}}",
    });

    expect(captionFor(state, FRAME)).toBe("Kodak Gold 200 | Minolta 7000 AF | Isarauen");
  });

  it("uses the hashtags from the settings instead of the default ones", () => {
    const state = completeState({ locale: "de", hashtags: ["#filmnotes", "#minolta"] });

    const caption = captionFor(state, FRAME);
    expect(caption).toContain("#filmnotes #minolta");
    expect(caption).not.toContain("#analog");
  });

  it("formats the date in the German order when the locale is de", () => {
    expect(captionFor(completeState({ locale: "de" }), FRAME)).toContain("18.09.2026");
  });

  it("formats the date as ISO when the locale is en", () => {
    expect(captionFor(completeState({ locale: "en" }), FRAME)).toContain("2026-09-18");
  });

  it("returns null when the roll of the frame is unknown", () => {
    const state = stateWith((store) => {
      store.getState().applyRemote("frames", [FRAME]);
    });

    expect(captionFor(state, FRAME)).toBeNull();
  });

  it("returns null when the camera of the roll is unknown", () => {
    const state = stateWith((store) => {
      const { applyRemote } = store.getState();
      applyRemote("filmStocks", [makeFilmStock()]);
      applyRemote("rolls", [makeRoll()]);
      applyRemote("frames", [FRAME]);
    });

    expect(captionFor(state, FRAME)).toBeNull();
  });
});

describe("exportInputFor", () => {
  it("collects frame, roll, equipment, caption and image", () => {
    const input = exportInputFor(completeState({ locale: "de" }), FRAME, IMAGE);

    expect(input).not.toBeNull();
    expect(input?.frame.id).toBe(FRAME.id);
    expect(input?.roll.id).toBe("roll00000000001");
    expect(input?.camera.model).toBe("7000 AF");
    expect(input?.lens?.model).toBe("AF Zoom 35-70mm f/4");
    expect(input?.filters.map((filter) => filter.id)).toEqual(["filt0hamauv49a0"]);
    expect(input?.filmStock.name).toBe("Kodak Gold 200");
    expect(input?.image).toBe(IMAGE);
    expect(input?.caption).toBe(captionFor(completeState({ locale: "de" }), FRAME));
  });

  it("accepts a frame without an image", () => {
    const input = exportInputFor(completeState(), FRAME, null);

    expect(input?.image).toBeNull();
  });

  it("takes the caption the user edited instead of the built one", () => {
    const input = exportInputFor(completeState(), FRAME, null, "Edited by hand");

    expect(input?.caption).toBe("Edited by hand");
  });

  it("returns null when the equipment of the frame is incomplete", () => {
    const state = stateWith((store) => {
      store.getState().applyRemote("frames", [FRAME]);
    });

    expect(exportInputFor(state, FRAME, IMAGE)).toBeNull();
  });
});

describe("wordPressConfigFor", () => {
  const configured: Partial<Settings> = {
    wordpressSiteUrl: "https://blog.example.test",
    wordpressUsername: "ansel",
  };

  it("is not configured while site url or username are missing", () => {
    expect(isWordPressConfigured({ ...DEFAULT_SETTINGS })).toBe(false);
    expect(
      isWordPressConfigured({ ...DEFAULT_SETTINGS, wordpressSiteUrl: "https://blog.example.test" }),
    ).toBe(false);
    expect(isWordPressConfigured({ ...DEFAULT_SETTINGS, ...configured })).toBe(true);
  });

  it("builds a draft-post config from the settings and the stored app password", () => {
    const config = wordPressConfigFor({ ...DEFAULT_SETTINGS, ...configured }, "app-password");

    expect(config).toEqual({
      siteUrl: "https://blog.example.test",
      username: "ansel",
      appPassword: "app-password",
      status: "draft",
      categoryIds: [],
      tagIds: [],
    });
  });

  it("returns null when the app password has not been stored yet", () => {
    expect(wordPressConfigFor({ ...DEFAULT_SETTINGS, ...configured }, null)).toBeNull();
  });

  it("returns null when the site url is not a url", () => {
    const settings = { ...DEFAULT_SETTINGS, ...configured, wordpressSiteUrl: "blog" };

    expect(wordPressConfigFor(settings, "app-password")).toBeNull();
  });
});
