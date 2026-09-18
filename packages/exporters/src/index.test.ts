import {
  buildPostHtml,
  buildPostTitle,
  getExporter,
  listExporters,
  shareExporter,
  wordPressExporter,
  WordPressError,
} from './index';

describe('package entry point', () => {
  it('registers the built-in exporters on import', () => {
    expect(listExporters().map((exporter) => exporter.id)).toEqual(['wordpress', 'share']);
    expect(getExporter('wordpress')).toBe(wordPressExporter);
    expect(getExporter('share')).toBe(shareExporter);
  });

  it('re-exports the public helpers and types', () => {
    expect(typeof buildPostHtml).toBe('function');
    expect(typeof buildPostTitle).toBe('function');
    expect(new WordPressError('boom', 500, '{}')).toBeInstanceOf(Error);
  });
});
