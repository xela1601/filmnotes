import type { ISODateTime } from '@filmnotes/domain';

/**
 * Single source of "now" for the whole app.
 *
 * Everything that stamps a record goes through this wrapper so tests can freeze
 * time with `jest.spyOn(clock, 'now').mockReturnValue(...)` (import the module as
 * a namespace: `import * as clock from '../lib/clock'`).
 */
export function now(): ISODateTime {
  return new Date().toISOString();
}
