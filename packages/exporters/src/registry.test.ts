import { z } from 'zod';
import { getExporter, listExporters, registerExporter } from './registry';
import type { Exporter, ExportResult } from './types';

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

describe('registerExporter / getExporter', () => {
  it('hands back the exporter that was registered for an id', () => {
    const exporter = fakeExporter('registry-get');
    registerExporter(exporter);

    expect(getExporter('registry-get')).toBe(exporter);
  });

  it('returns undefined for an unknown id', () => {
    expect(getExporter('does-not-exist')).toBeUndefined();
  });

  it('overwrites an exporter that was registered under the same id before', () => {
    const first = fakeExporter('registry-duplicate', 'exporters.first');
    const second = fakeExporter('registry-duplicate', 'exporters.second');

    registerExporter(first);
    registerExporter(second);

    expect(getExporter('registry-duplicate')).toBe(second);
    expect(listExporters().filter((entry) => entry.id === 'registry-duplicate')).toHaveLength(1);
  });
});

describe('listExporters', () => {
  it('lists every registered exporter', () => {
    const before = listExporters().map((entry) => entry.id);
    const exporter = fakeExporter('registry-list');
    registerExporter(exporter);

    const after = listExporters();
    expect(after.map((entry) => entry.id)).toEqual([...before, 'registry-list']);
    expect(after).toContain(exporter);
  });

  it('returns a copy, so callers cannot mutate the registry', () => {
    const listed = listExporters();
    listed.length = 0;

    expect(listExporters().length).toBeGreaterThan(0);
  });
});
