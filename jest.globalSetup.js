/**
 * Pins the time zone for the whole test run.
 *
 * The app shows and stores local wall-clock time (see `localTime.ts` in the domain), so what the
 * tests assert depends on the zone they run in. Setting `process.env.TZ` in a setup *file* is too
 * late - by then the worker has already read the zone, which is why a suite that looked pinned
 * passed here and failed in CI with a two-hour difference. Global setup runs in the main process
 * before any worker is spawned, and workers inherit the environment.
 *
 * Europe/Berlin on purpose: a zone with an offset *and* daylight saving, so a bug that only shows
 * outside UTC shows here. `jest.setup.js` checks that it actually took.
 */
module.exports = () => {
  process.env.TZ = "Europe/Berlin";
};
