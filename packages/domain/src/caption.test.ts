import { DEFAULT_CAPTION_TEMPLATE, buildCaption } from './caption';
import type { CaptionInput } from './caption';
import {
  makeCamera,
  makeFilmStock,
  makeFilter,
  makeFrame,
  makeLens,
  makeRoll,
} from './fixtures';

function input(overrides: Partial<CaptionInput> = {}): CaptionInput {
  return {
    frame: makeFrame({
      focalLengthMm: 50,
      aperture: 5.6,
      shutterSpeed: '1/125',
      exposureMode: 'P',
      location: { name: 'Munich', lat: null, lon: null },
      notes: 'first roll through the 7000',
    }),
    roll: makeRoll(),
    camera: makeCamera(),
    lens: makeLens(),
    filters: [makeFilter()],
    filmStock: makeFilmStock(),
    locale: 'en',
    ...overrides,
  };
}

describe('DEFAULT_CAPTION_TEMPLATE', () => {
  it('is the template from the design spec', () => {
    expect(DEFAULT_CAPTION_TEMPLATE).toBe(
      [
        '{{filmStock}} · {{camera}} · {{lens}}{{#focal}} @ {{focal}}mm{{/focal}}',
        '{{#exposure}}{{exposure}}{{/exposure}}{{#filters}} · {{filters}}{{/filters}}',
        '{{#location}}📍 {{location}}{{/location}}{{#date}} · {{date}}{{/date}}',
        '{{notes}}',
        '{{hashtags}}',
      ].join('\n'),
    );
  });
});

describe('buildCaption', () => {
  it('renders every line of a fully filled frame', () => {
    expect(buildCaption(input())).toBe(
      [
        'Kodak Gold 200 · Minolta 7000 AF · Minolta AF Zoom 35-70mm f/4 @ 50mm',
        'f/5.6 · 1/125 · P · UV 390 (O-Haze)',
        '📍 Munich · 2026-09-18',
        'first roll through the 7000',
        '#analog #35mm #filmphotography #kodakgold200',
      ].join('\n'),
    );
  });

  it('omits lens, focal length, filters, location and notes when they are unknown', () => {
    const caption = buildCaption(
      input({
        frame: makeFrame({
          focalLengthMm: null,
          aperture: 5.6,
          shutterSpeed: '1/125',
          exposureMode: 'P',
          location: null,
          notes: '',
          takenAt: null,
        }),
        lens: null,
        filters: [],
      }),
    );
    expect(caption).toBe(
      [
        'Kodak Gold 200 · Minolta 7000 AF',
        'f/5.6 · 1/125 · P',
        '',
        '#analog #35mm #filmphotography #kodakgold200',
      ].join('\n'),
    );
  });

  it('lists only the exposure parts that are known', () => {
    const frame = makeFrame({ aperture: null, shutterSpeed: '1/125', exposureMode: null, location: null, notes: '' });
    expect(buildCaption(input({ frame, filters: [] }))).toContain('\n1/125\n');
  });

  it('joins several filters with a comma', () => {
    const filters = [makeFilter(), makeFilter({ id: 'filter200000000', model: 'Skylight' })];
    expect(buildCaption(input({ filters }))).toContain('UV 390 (O-Haze), Skylight');
  });

  it('formats the date for the German locale', () => {
    expect(buildCaption(input({ locale: 'de' }))).toContain('📍 Munich · 18.09.2026');
  });

  it('defaults to the German locale', () => {
    const { locale, ...rest } = input();
    expect(buildCaption(rest)).toContain('18.09.2026');
  });

  it('uses the hashtags it is given', () => {
    expect(buildCaption(input({ hashtags: ['#minolta7000'] }))).toContain('\n#minolta7000');
  });

  it('renders a custom template', () => {
    const caption = buildCaption(input({ template: '{{camera}} / {{filmStock}}{{#focal}} / {{focal}}mm{{/focal}}' }));
    expect(caption).toBe('Minolta 7000 AF / Kodak Gold 200 / 50mm');
  });

  it('drops a section whose value is empty', () => {
    const frame = makeFrame({ focalLengthMm: null });
    const caption = buildCaption(input({ frame, template: 'x{{#focal}} @ {{focal}}mm{{/focal}}' }));
    expect(caption).toBe('x');
  });
});
