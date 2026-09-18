/** @type {import('jest').Config} */
module.exports = {
  displayName: 'mobile',
  preset: 'jest-expo',
  rootDir: __dirname,
  roots: ['<rootDir>/src', '<rootDir>/app'],
  // @testing-library/react-native >= 12.4 registers its jest matchers automatically,
  // so the deprecated @testing-library/jest-native/extend-expect setup file is not used.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@filmnotes/.*))',
  ],
};
