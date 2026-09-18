import { makeFilmStock, makeFrame, makeRoll } from '../../testing/fixtures';
import { FRAME_NOTES_MAX, frameRowTitle, rollProgress, rollTitle } from './rollLabel';

/** Stand-in for i18next's `t`: returns the key so the test can assert on it. */
const t = (key: string): string => key;

describe('rollTitle', () => {
  it('combines the film stock name with the load date', () => {
    const roll = makeRoll({ loadedAt: '2026-09-18T10:00:00.000Z' });

    expect(rollTitle(roll, makeFilmStock(), t)).toBe('Kodak Gold 200 · 2026-09-18');
  });

  it('falls back to the translated unknown-film label', () => {
    const roll = makeRoll({ loadedAt: '2026-09-18T10:00:00.000Z' });

    expect(rollTitle(roll, undefined, t)).toBe('unknownFilm · 2026-09-18');
  });
});

describe('rollProgress', () => {
  it('counts the active frames against the length of the roll', () => {
    const roll = makeRoll({ exposures: 36 });
    const frames = [
      makeFrame({ id: 'frame0000000001', frameNo: 1 }),
      makeFrame({ id: 'frame0000000002', frameNo: 2 }),
      makeFrame({ id: 'frame0000000003', frameNo: 3, deleted: '2026-09-18T11:00:00.000Z' }),
    ];

    expect(rollProgress(roll, frames)).toEqual({ shot: 2, total: 36 });
  });

  it('starts at zero', () => {
    expect(rollProgress(makeRoll({ exposures: 24 }), [])).toEqual({ shot: 0, total: 24 });
  });
});

describe('frameRowTitle', () => {
  it('shows frame number, shutter speed, aperture and the start of the notes', () => {
    const frame = makeFrame({
      frameNo: 7,
      shutterSpeed: '1/125',
      aperture: 5.6,
      notes: 'Bridge in the morning fog',
    });

    expect(frameRowTitle(frame)).toBe('#7 · 1/125 · f/5.6 · Bridge in the morning fog');
  });

  it('marks missing exposure values and drops empty notes', () => {
    expect(frameRowTitle(makeFrame({ frameNo: 1 }))).toBe('#1 · – · –');
  });

  it('truncates long notes', () => {
    const notes = 'x'.repeat(FRAME_NOTES_MAX + 10);

    expect(frameRowTitle(makeFrame({ frameNo: 2, notes }))).toBe(
      `#2 · – · – · ${'x'.repeat(FRAME_NOTES_MAX)}…`,
    );
  });
});
