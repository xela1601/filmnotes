import { z } from "zod";
import { getExporter, listExporters, registerExporter } from "./registry";
import type { Exporter, ExportResult } from "./types";

const emptyConfigSchema = z.object({});
type EmptyConfig = z.infer<typeof emptyConfigSchema>;

function fakeExporter(id: string, nameKey = `exporters.${id}`): Exporter<EmptyConfig> {
  return {
    id,
    nameKey,
    configSchema: emptyConfigSchema,
    requiresImage: false,
    exportFrame: async (): Promise<ExportResult> => ({
      externalId: id,
      url: null,
      sharePayload: null,
    }),
  };
}

describe("registerExporter / getExporter", () => {
  it("hands back the exporter that was registered for an id", () => {
    const exporter = fakeExporter("registry-get");
    registerExporter(exporter);

    // Not the same object: registration wraps the exporter so its config is validated.
    expect(getExporter("registry-get")?.id).toBe("registry-get");
    expect(getExporter("registry-get")?.nameKey).toBe(exporter.nameKey);
  });

  it("returns undefined for an unknown id", () => {
    expect(getExporter("does-not-exist")).toBeUndefined();
  });

  it("overwrites an exporter that was registered under the same id before", () => {
    const first = fakeExporter("registry-duplicate", "exporters.first");
    const second = fakeExporter("registry-duplicate", "exporters.second");

    registerExporter(first);
    registerExporter(second);

    expect(getExporter("registry-duplicate")?.nameKey).toBe(second.nameKey);
    expect(listExporters().filter((entry) => entry.id === "registry-duplicate")).toHaveLength(1);
  });
});

describe("listExporters", () => {
  it("lists every registered exporter", () => {
    const before = listExporters().map((entry) => entry.id);
    const exporter = fakeExporter("registry-list");
    registerExporter(exporter);

    const after = listExporters();
    expect(after.map((entry) => entry.id)).toEqual([...before, "registry-list"]);
    expect(after.some((entry) => entry.id === exporter.id)).toBe(true);
  });

  it("returns a copy, so callers cannot mutate the registry", () => {
    const listed = listExporters();
    listed.length = 0;

    expect(listExporters().length).toBeGreaterThan(0);
  });
});

describe("the erased exporter", () => {
  const strictSchema = z.object({ siteUrl: z.string().url() });

  function strictExporter(id: string): Exporter<z.infer<typeof strictSchema>> {
    return {
      id,
      nameKey: `exporters.${id}`,
      configSchema: strictSchema,
      requiresImage: false,
      exportFrame: async (_input, config): Promise<ExportResult> => ({
        externalId: config.siteUrl,
        url: null,
        sharePayload: null,
      }),
    };
  }

  it("validates the config before the exporter sees it", async () => {
    // The hole this closes: `Exporter<unknown>` accepted `exportFrame(input, {}, deps)` at compile
    // time (method parameters are bivariant) and blew up inside the exporter at runtime.
    registerExporter(strictExporter("registry-strict"));
    const exporter = getExporter("registry-strict");

    await expect(
      exporter?.exportFrame({} as never, {}, { fetch: globalThis.fetch }),
    ).rejects.toThrow();
  });

  it("passes a valid config through", async () => {
    registerExporter(strictExporter("registry-strict-ok"));
    const exporter = getExporter("registry-strict-ok");

    const result = await exporter?.exportFrame(
      {} as never,
      { siteUrl: "https://blog.example" },
      { fetch: globalThis.fetch },
    );

    expect(result?.externalId).toBe("https://blog.example");
  });
});
