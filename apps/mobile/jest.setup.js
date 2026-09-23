// The time zone is pinned in jest.globalSetup.js (setting it here is too late: the worker has
// already read it). This is the guard - a run in the wrong zone would quietly assert the wrong
// timestamps, which is exactly what happened before: green here, two hours off in CI.
const noonUtcInBerlin = new Date("2026-09-18T10:00:00.000Z").getHours();
if (noonUtcInBerlin !== 12) {
  throw new Error(
    `Tests must run in Europe/Berlin (10:00 UTC is 12:00 there, this process says ${noonUtcInBerlin}:00). ` +
      "Run them through `npm test` / `mise run test`, which loads jest.globalSetup.js.",
  );
}

// The official AsyncStorage mock; the real native module is not available in Jest.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// Safe-area insets without a native provider.
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
