/**
 * ESLint 10 flat config for the whole monorepo.
 *
 * Layout: one root config, one block per kind of code, because the workspaces share the
 * same conventions and a single `npm run lint` should cover everything.
 *
 * - `packages/*` and `tools/*` are framework-free TypeScript and are linted *type-aware*
 *   (typescript-eslint's `recommendedTypeChecked`), which is what catches the mistakes that
 *   matter here: floating promises in the sync/outbox paths, unsafe `any` flowing out of
 *   JSON, misused `await`.
 * - `apps/mobile` additionally gets `eslint-config-expo`, the config Expo maintains for
 *   React Native (react, react-hooks, import resolution, RN globals).
 * - Formatting is Prettier's job. `eslint-config-prettier` comes last and switches off every
 *   stylistic rule that would fight it, so ESLint only ever reports real problems.
 */
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import expoConfig from "eslint-config-expo/flat.js";
import prettierConfig from "eslint-config-prettier/flat";
import globals from "globals";

/** Globals of PocketBase's JSVM, in which the migrations under `backend/pb_migrations` run. */
const pocketbaseGlobals = {
  migrate: "readonly",
  $app: "readonly",
  $apis: "readonly",
  $os: "readonly",
  $security: "readonly",
  $http: "readonly",
  $filesystem: "readonly",
  Collection: "readonly",
  Record: "readonly",
  DynamicModel: "readonly",
  require: "readonly",
};

export default tseslint.config(
  {
    // Build output, dependencies, runtime data and the sandbox scratch space.
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.expo/**",
      "**/coverage/**",
      ".npm-cache/**",
      ".claude/worktrees/**",
      "backend/bin/**",
      "backend/pb_data/**",
    ],
  },

  // ---------------------------------------------------------------- shared TypeScript rules
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        // Resolves each file through the nearest tsconfig.json; `allowDefaultProject` keeps
        // the few files outside a project (root-level configs) from erroring out.
        projectService: {
          allowDefaultProject: ["*.mjs", "*.js", "jest.config.js"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Unused arguments are fine when they document a signature; unused variables are not.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
          // `const { locale, ...rest } = input()` omits a key on purpose.
          ignoreRestSiblings: true,
        },
      ],
      // Promises that nobody waits for are the classic bug in the sync and outbox code.
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      // `as` casts on JSON payloads are deliberate in a few places; a type assertion that
      // widens to `any` never is.
      "@typescript-eslint/no-explicit-any": "error",
      // `fixStyle: 'inline-type-imports'` is tempting but its autofix merges a value import
      // into an existing `import type` statement and produces code Babel rejects; the
      // separate-statement fix is the safe one.
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
    },
  },

  // ------------------------------------------------------------------- the Expo app
  {
    files: ["apps/mobile/**/*.{ts,tsx,js,jsx}"],
    extends: [expoConfig],
    settings: {
      // Pinned instead of "detect": eslint-config-expo still bundles eslint-plugin-react
      // 7.37, whose version detection calls the pre-ESLint-10 context API and crashes with
      // "contextOrFilename.getFilename is not a function". Naming the version skips it.
      react: { version: "19.2" },
    },
    rules: {
      // Off for the whole app: every `useStore((state) => state.upsert)` selects a zustand
      // action off the state object, and the rule reads that as an unbound method. Zustand
      // actions are plain closures over `set`/`get` and never touch `this`, so all 16 hits
      // were false positives.
      "@typescript-eslint/unbound-method": "off",
      // i18next's default export carries `use`/`t` as members; the rule cannot tell that
      // apart from a mistaken named import and flags every idiomatic call.
      "import/no-named-as-default-member": "off",
    },
  },

  // Metro and Jest are configured in CommonJS; that is the only form they accept.
  {
    files: ["**/*.config.js", "**/jest.setup.js"],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "no-undef": "off",
    },
  },

  // Platform shims mirror an asynchronous native API on a synchronous web one (localStorage),
  // so their `async` keyword is interface conformance, not a forgotten `await`.
  {
    files: ["**/*.web.{ts,tsx}", "**/fakeClient.ts"],
    rules: { "@typescript-eslint/require-await": "off" },
  },

  // -------------------------------------------------------------------- Jest test files
  {
    files: ["**/*.test.{ts,tsx}", "**/jest.setup.{ts,js}", "**/test/**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.jest, ...globals.node },
    },
    rules: {
      // Tests assert on loosely typed fixtures and mock modules; the type-aware rules that
      // guard production code only produce noise there.
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/unbound-method": "off",
      // A stub method is `async` because the interface it stands in for is.
      "@typescript-eslint/require-await": "off",
      // `require()` inside a test is how a module is loaded after `jest.mock` or with a
      // fresh registry.
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  // ------------------------------------------------- Node scripts (e2e, tools, backend tests)
  {
    files: ["**/*.{mjs,cjs}", "**/scripts/**/*.js", "backend/test/**/*.mjs"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node },
    },
  },

  // ------------------------------------------------------------- PocketBase JS migrations
  {
    files: ["backend/pb_migrations/**/*.js"],
    extends: [js.configs.recommended],
    languageOptions: {
      // Goja, not Node: no ES modules, no top-level await, but object spread is supported.
      ecmaVersion: 2022,
      sourceType: "script",
      globals: pocketbaseGlobals,
    },
  },

  // Must stay last: turns off everything Prettier already decides.
  prettierConfig,
);
