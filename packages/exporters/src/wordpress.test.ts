import {
  buildCaption,
  makeCamera,
  makeFilmStock,
  makeFilter,
  makeFrame,
  makeLens,
  makeRoll,
} from "@filmnotes/domain";
import {
  buildPostHtml,
  buildPostTitle,
  WordPressError,
  wordPressExporter,
  type WordPressConfig,
} from "./wordpress";
import type { ExporterDeps, ExportImage, ExportInput } from "./types";

const IMAGE: ExportImage = {
  bytes: new Uint8Array([137, 80, 78, 71]),
  mimeType: "image/jpeg",
  fileName: "roll1-12.jpg",
};

const CONFIG: WordPressConfig = {
  siteUrl: "https://blog.example",
  username: "alex",
  appPassword: "abcd efgh ijkl mnöp",
  status: "draft",
  categoryIds: [3, 4],
  tagIds: [7],
};

const EXPECTED_AUTH = `Basic ${Buffer.from(`${CONFIG.username}:${CONFIG.appPassword}`, "utf8").toString("base64")}`;

interface RecordedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

interface FakeResponse {
  status?: number;
  json?: unknown;
  text?: string;
}

interface FakeFetch {
  deps: ExporterDeps;
  requests: RecordedRequest[];
}

/** A fetch that answers with the given responses in order and records every request. */
function fakeFetch(responses: FakeResponse[]): FakeFetch {
  const requests: RecordedRequest[] = [];
  const queue = [...responses];

  const fetchImpl: typeof fetch = async (input, init) => {
    requests.push({
      url: input instanceof Request ? input.url : String(input),
      method: init?.method ?? "GET",
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: init?.body,
    });

    const next = queue.shift();
    if (next === undefined) throw new Error(`unexpected request to ${requests.at(-1)?.url}`);
    const body = next.text ?? JSON.stringify(next.json ?? {});
    return new Response(body, {
      status: next.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  return { deps: { fetch: fetchImpl }, requests };
}

function makeInput(overrides: Partial<ExportInput> = {}): ExportInput {
  const frame = makeFrame({
    frameNo: 12,
    notes: "Late light\nsecond line",
    location: { name: "Munich", lat: null, lon: null },
  });
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

function requestAt(requests: RecordedRequest[], index: number): RecordedRequest {
  const request = requests[index];
  if (request === undefined) throw new Error(`expected a request at index ${index}`);
  return request;
}

function jsonBodyOf(request: RecordedRequest): Record<string, unknown> {
  if (typeof request.body !== "string") throw new Error("expected a JSON string body");
  return JSON.parse(request.body) as Record<string, unknown>;
}

describe("wordPressExporter", () => {
  it("is identified as the wordpress target and works without an image", () => {
    expect(wordPressExporter.id).toBe("wordpress");
    expect(wordPressExporter.nameKey).toBe("exporters.wordpress");
    expect(wordPressExporter.requiresImage).toBe(false);
  });

  it("accepts a complete config and rejects an invalid one", () => {
    expect(wordPressExporter.configSchema.parse(CONFIG)).toEqual(CONFIG);
    expect(() =>
      wordPressExporter.configSchema.parse({ ...CONFIG, siteUrl: "not a url" }),
    ).toThrow();
    expect(() => wordPressExporter.configSchema.parse({ ...CONFIG, status: "pending" })).toThrow();
  });

  it("uploads the image and creates a draft post that references it", async () => {
    const { deps, requests } = fakeFetch([
      { json: { id: 55, source_url: "https://blog.example/wp-content/img.jpg" } },
      { json: { id: 101, link: "https://blog.example/?p=101" } },
    ]);
    const input = makeInput();

    const result = await wordPressExporter.exportFrame(input, CONFIG, deps);

    expect(requests).toHaveLength(2);

    const media = requestAt(requests, 0);
    expect(media.url).toBe("https://blog.example/wp-json/wp/v2/media");
    expect(media.method).toBe("POST");
    expect(media.headers["authorization"]).toBe(EXPECTED_AUTH);
    expect(media.headers["content-disposition"]).toBe('attachment; filename="roll1-12.jpg"');
    expect(media.headers["content-type"]).toBe("image/jpeg");
    expect(media.body).toEqual(IMAGE.bytes);

    const post = requestAt(requests, 1);
    expect(post.url).toBe("https://blog.example/wp-json/wp/v2/posts");
    expect(post.method).toBe("POST");
    expect(post.headers["authorization"]).toBe(EXPECTED_AUTH);
    expect(post.headers["content-type"]).toContain("application/json");
    expect(jsonBodyOf(post)).toEqual({
      title: buildPostTitle(input),
      content: buildPostHtml(input, "https://blog.example/wp-content/img.jpg"),
      status: "draft",
      featured_media: 55,
      categories: [3, 4],
      tags: [7],
    });

    expect(result).toEqual({
      externalId: "101",
      url: "https://blog.example/?p=101",
      sharePayload: null,
    });
  });

  it("skips the media upload and the featured image when there is no image", async () => {
    const { deps, requests } = fakeFetch([
      { json: { id: 101, link: "https://blog.example/?p=101" } },
    ]);
    const input = makeInput({ image: null });

    const result = await wordPressExporter.exportFrame(
      input,
      { ...CONFIG, status: "publish" },
      deps,
    );

    expect(requests).toHaveLength(1);
    const post = requestAt(requests, 0);
    expect(post.url).toBe("https://blog.example/wp-json/wp/v2/posts");
    const body = jsonBodyOf(post);
    expect(body).not.toHaveProperty("featured_media");
    expect(body["status"]).toBe("publish");
    expect(body["content"]).toBe(buildPostHtml(input, null));
    expect(result.externalId).toBe("101");
  });

  it("normalises a siteUrl with a trailing slash", async () => {
    const { deps, requests } = fakeFetch([
      { json: { id: 101, link: "https://blog.example/?p=101" } },
    ]);

    await wordPressExporter.exportFrame(
      makeInput({ image: null }),
      { ...CONFIG, siteUrl: "https://blog.example/" },
      deps,
    );

    expect(requestAt(requests, 0).url).toBe("https://blog.example/wp-json/wp/v2/posts");
  });

  it("throws a WordPressError with status and message when the media upload fails", async () => {
    const { deps } = fakeFetch([
      { status: 413, json: { code: "rest_upload_too_large", message: "The file is too big." } },
    ]);

    const error = await wordPressExporter
      .exportFrame(makeInput(), CONFIG, deps)
      .then(() => null)
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(WordPressError);
    const wordPressError = error as WordPressError;
    expect(wordPressError.status).toBe(413);
    expect(wordPressError.message).toContain("The file is too big.");
    expect(wordPressError.body).toContain("rest_upload_too_large");
  });

  it("throws a WordPressError when the post cannot be created", async () => {
    const { deps } = fakeFetch([{ status: 401, text: "Unauthorized" }]);

    await expect(
      wordPressExporter.exportFrame(makeInput({ image: null }), CONFIG, deps),
    ).rejects.toMatchObject({
      name: "WordPressError",
      status: 401,
      message: expect.stringContaining("Unauthorized"),
    });
  });
});

describe("buildPostTitle", () => {
  it("joins film stock, frame number and location", () => {
    expect(buildPostTitle(makeInput())).toBe("Kodak Gold 200 – #12 – Munich");
  });

  it("leaves out the parts that are missing", () => {
    const input = makeInput({ frame: makeFrame({ frameNo: 3, location: null }) });

    expect(buildPostTitle(input)).toBe("Kodak Gold 200 – #3");
  });
});

describe("buildPostHtml", () => {
  it("opens with a figure when a media url is known", () => {
    const html = buildPostHtml(makeInput(), "https://blog.example/wp-content/img.jpg");

    expect(html).toContain("<figure>");
    expect(html).toContain('<img src="https://blog.example/wp-content/img.jpg"');
    expect(html.indexOf("<figure>")).toBeLessThan(html.indexOf("<table>"));
  });

  it("has no figure without a media url", () => {
    expect(buildPostHtml(makeInput(), null)).not.toContain("<figure>");
  });

  it("lists the frame metadata in a table", () => {
    const html = buildPostHtml(makeInput(), null);

    expect(html).toContain("<table>");
    expect(html).toContain("<th>Film</th><td>Kodak Gold 200</td>");
    expect(html).toContain("<th>Camera</th><td>Minolta 7000 AF</td>");
    expect(html).toContain("<th>Lens</th><td>Minolta AF Zoom 35-70mm f/4</td>");
    expect(html).toContain("<th>Focal length</th><td>50 mm</td>");
    expect(html).toContain("<th>Aperture</th><td>f/5.6</td>");
    expect(html).toContain("<th>Shutter</th><td>1/125</td>");
    expect(html).toContain("<th>Mode</th><td>P</td>");
    expect(html).toContain("<th>Filters</th><td>Hama UV 390 (O-Haze)</td>");
    expect(html).toContain("<th>Location</th><td>Munich</td>");
    expect(html).toContain("<th>Date</th><td>2026-09-18</td>");
  });

  it("leaves out rows whose value is unknown", () => {
    const input = makeInput({
      frame: makeFrame({
        lensId: null,
        focalLengthMm: null,
        aperture: null,
        shutterSpeed: null,
        exposureMode: null,
        takenAt: null,
        location: null,
      }),
      lens: null,
      filters: [],
    });
    const html = buildPostHtml(input, null);

    expect(html).toContain("<th>Film</th>");
    for (const label of [
      "Lens",
      "Focal length",
      "Aperture",
      "Shutter",
      "Mode",
      "Filters",
      "Location",
      "Date",
    ]) {
      expect(html).not.toContain(`<th>${label}</th>`);
    }
  });

  it("wraps the notes in paragraphs and turns single line breaks into <br />", () => {
    const input = makeInput({
      frame: makeFrame({ notes: "First line\nsecond line\n\nNew paragraph" }),
    });
    const html = buildPostHtml(input, null);

    expect(html).toContain("<p>First line<br />second line</p>");
    expect(html).toContain("<p>New paragraph</p>");
  });

  it("has no notes paragraph when the frame has no notes", () => {
    expect(buildPostHtml(makeInput({ frame: makeFrame({ notes: "  " }) }), null)).not.toContain(
      "<p>",
    );
  });

  it("escapes HTML in values and in the notes", () => {
    const input = makeInput({
      frame: makeFrame({
        notes: 'a < b & "c"',
        location: { name: '<script>alert("x")</script>', lat: null, lon: null },
      }),
    });
    const html = buildPostHtml(input, null);

    expect(html).toContain("a &lt; b &amp; &quot;c&quot;");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
  });
});
