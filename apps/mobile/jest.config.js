const expoPreset = require("jest-expo/jest-preset");

/**
 * Picked up automatically by the root jest config, which turns every workspace
 * directory containing a jest.config.js into a Jest project.
 *
 * @type {import('jest').Config}
 */
module.exports = {
  displayName: "mobile",
  preset: "jest-expo",
  rootDir: __dirname,
  // `app/` holds routes only – expo-router would turn a test file there into a route.
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  setupFiles: ["<rootDir>/jest.setup.js"],
  // @testing-library/react-native >= 12.4 registers its jest matchers automatically,
  // so the deprecated @testing-library/jest-native/extend-expect setup file is not used.
  // The workspace packages ship TypeScript sources, so they have to be transformed as
  // well; everything else stays exactly as jest-expo configures it.
  transformIgnorePatterns: expoPreset.transformIgnorePatterns.map((pattern) =>
    pattern.includes("(?!(") ? pattern.replace("(?!(", "(?!(@filmnotes|") : pattern,
  ),
};
