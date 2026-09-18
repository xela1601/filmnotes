import { apertureValuesForLens, isValidAperture } from './aperture';
import { makeLens } from './fixtures';

describe('apertureValuesForLens', () => {
  it('returns an empty list without a lens', () => {
    expect(apertureValuesForLens(null)).toEqual([]);
  });

  it('returns the values of the lens', () => {
    const lens = makeLens();
    expect(apertureValuesForLens(lens)).toEqual([4, 4.8, 5.6, 6.7, 8, 9.5, 11, 13, 16, 19, 22]);
  });

  it('does not expose the lens array itself', () => {
    const lens = makeLens();
    apertureValuesForLens(lens).push(99);
    expect(lens.apertureValues).not.toContain(99);
  });
});

describe('isValidAperture', () => {
  it('accepts a value from the lens scale', () => {
    expect(isValidAperture(makeLens(), 5.6)).toBe(true);
  });

  it('rejects a value the lens does not have', () => {
    expect(isValidAperture(makeLens(), 1.7)).toBe(false);
  });

  it('accepts anything without a lens', () => {
    expect(isValidAperture(null, 8)).toBe(true);
  });

  it('accepts anything for a lens without a known scale', () => {
    expect(isValidAperture(makeLens({ apertureValues: [] }), 8)).toBe(true);
  });
});
