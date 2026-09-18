import { makeCamera } from './fixtures';
import {
  compareShutterSpeeds,
  formatShutterSpeed,
  isSlowerThan,
  parseShutterSpeed,
  shutterSpeedsForMode,
} from './shutter';

describe('parseShutterSpeed', () => {
  it('parses fractions', () => {
    expect(parseShutterSpeed('1/125')).toBeCloseTo(0.008, 6);
    expect(parseShutterSpeed('1/2')).toBeCloseTo(0.5, 6);
  });

  it('parses whole seconds written with the camera quote', () => {
    expect(parseShutterSpeed('2"')).toBeCloseTo(2, 6);
    expect(parseShutterSpeed('30"')).toBeCloseTo(30, 6);
  });

  it('parses half-stop seconds written with the camera quote', () => {
    expect(parseShutterSpeed('1"5')).toBeCloseTo(1.5, 6);
    expect(parseShutterSpeed('0"7')).toBeCloseTo(0.7, 6);
  });

  it('parses seconds written with a trailing s', () => {
    expect(parseShutterSpeed('2s')).toBeCloseTo(2, 6);
    expect(parseShutterSpeed('1.5s')).toBeCloseTo(1.5, 6);
  });

  it('returns null for bulb and for unparsable input', () => {
    expect(parseShutterSpeed('bulb')).toBeNull();
    expect(parseShutterSpeed('abc')).toBeNull();
  });
});

describe('formatShutterSpeed', () => {
  it('formats fractions', () => {
    expect(formatShutterSpeed(0.008)).toBe('1/125');
    expect(formatShutterSpeed(0.5)).toBe('1/2');
  });

  it('formats seconds', () => {
    expect(formatShutterSpeed(2)).toBe('2"');
    expect(formatShutterSpeed(1.5)).toBe('1"5');
  });

  it('is the inverse of parseShutterSpeed over the camera ladder', () => {
    const camera = makeCamera();
    const speeds = [...camera.shutterSpeedsManual, ...camera.shutterSpeedsAutoExtra].filter(
      (speed) => speed !== 'bulb',
    );
    for (const speed of speeds) {
      const seconds = parseShutterSpeed(speed);
      expect(seconds).not.toBeNull();
      expect(formatShutterSpeed(seconds as number)).toBe(speed);
    }
  });
});

describe('formatShutterSpeed outside the camera ladder', () => {
  it('formats a longer exposure than the ladder covers', () => {
    expect(formatShutterSpeed(60)).toBe('60"');
    expect(formatShutterSpeed(45.5)).toBe('45"5');
  });

  it('formats a shorter exposure than the ladder covers', () => {
    expect(formatShutterSpeed(0.00005)).toBe('1/20000');
  });

  it('calls an endless exposure bulb', () => {
    expect(formatShutterSpeed(Number.POSITIVE_INFINITY)).toBe('bulb');
  });

  it('falls back to the fastest speed for a duration that is no duration', () => {
    expect(formatShutterSpeed(0)).toBe('1/8000');
    expect(formatShutterSpeed(Number.NaN)).toBe('1/8000');
  });
});

describe('compareShutterSpeeds', () => {
  it('sorts the faster speed first', () => {
    expect(compareShutterSpeeds('1/250', '1/60')).toBeLessThan(0);
    expect(compareShutterSpeeds('1/60', '1/250')).toBeGreaterThan(0);
    expect(compareShutterSpeeds('1/60', '1/60')).toBe(0);
  });

  it('treats bulb as the slowest speed', () => {
    expect(compareShutterSpeeds('30"', 'bulb')).toBeLessThan(0);
    expect(compareShutterSpeeds('bulb', 'bulb')).toBe(0);
  });
});

describe('isSlowerThan', () => {
  it('compares durations', () => {
    expect(isSlowerThan('1/30', '1/60')).toBe(true);
    expect(isSlowerThan('1/125', '1/60')).toBe(false);
  });

  it('treats an unparsable speed like bulb', () => {
    expect(isSlowerThan('who knows', '1/60')).toBe(true);
    expect(parseShutterSpeed('1/0')).toBeNull();
    expect(parseShutterSpeed('   ')).toBeNull();
  });

  it('counts bulb as slower than any timed speed', () => {
    expect(isSlowerThan('bulb', '1/60')).toBe(true);
    expect(isSlowerThan('30"', 'bulb')).toBe(false);
  });
});

describe('shutterSpeedsForMode', () => {
  const camera = makeCamera();
  const manualFastestFirst = [
    '1/2000', '1/1000', '1/500', '1/250', '1/125', '1/60',
    '1/30', '1/15', '1/8', '1/4', '1/2',
    '1"', '2"', '4"', '8"', '15"', '30"',
  ];
  const autoFastestFirst = [
    '1/2000', '1/1500', '1/1000', '1/750', '1/500', '1/350', '1/250', '1/180',
    '1/125', '1/90', '1/60', '1/45', '1/30', '1/20', '1/15', '1/10', '1/8',
    '1/6', '1/4', '1/3', '1/2', '0"7', '1"', '1"5', '2"', '3"', '4"', '6"',
    '8"', '12"', '15"', '20"', '30"',
  ];

  it('returns the manual ladder with bulb last in M', () => {
    expect(shutterSpeedsForMode(camera, 'M')).toEqual([...manualFastestFirst, 'bulb']);
  });

  it('drops bulb in S because the camera allows it only in M', () => {
    expect(shutterSpeedsForMode(camera, 'S')).toEqual(manualFastestFirst);
  });

  it('adds the automatic half stops in P', () => {
    expect(shutterSpeedsForMode(camera, 'P')).toEqual(autoFastestFirst);
  });

  it('treats an unset mode like P', () => {
    expect(shutterSpeedsForMode(camera, null)).toEqual(shutterSpeedsForMode(camera, 'P'));
  });

  it('keeps bulb in every mode when the camera does not restrict it', () => {
    const unrestricted = makeCamera({ bulbOnlyInModes: [] });
    expect(shutterSpeedsForMode(unrestricted, 'S')).toContain('bulb');
  });
});
