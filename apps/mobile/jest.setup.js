// A fixed, non-UTC time zone for every app test. The screens show local wall-clock time now
// (see localTime.ts in the domain), so a suite running in UTC would pass while the app writes
// the wrong calendar day for anyone east or west of Greenwich. The sandbox itself reports a
// POSIX zone without DST rules, which would be just as useless a baseline.
process.env.TZ = "Europe/Berlin";

// The official AsyncStorage mock; the real native module is not available in Jest.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// Safe-area insets without a native provider.
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
