/**
 * Loading the credentials file.
 *
 * Every secret the CLI needs comes from the environment (see `args.ts`), and the environment is
 * normally filled from a `.env` file that is never committed. Node reads it natively since 20.12
 * (`process.loadEnvFile`), so this needs no dependency, and a variable that is already set in the
 * shell keeps its value - the file only fills the gaps.
 *
 * Where the file lives matters for the Docker Sandbox: the whole repository is bind-mounted into
 * it, so a `.env` at the repository root is visible to anything running inside. Point
 * `FILMNOTES_ENV_FILE` at a path outside the workspace (`~/.config/filmnotes/env`) to keep the
 * credentials out of the sandbox entirely.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/** Points at a credentials file outside the repository. */
export const ENV_FILE_VAR = "FILMNOTES_ENV_FILE";

export interface LoadOptions {
  env?: Record<string, string | undefined>;
  /** Injected in the tests; defaults to the real file system. */
  exists?: (path: string) => boolean;
  /** Injected in the tests; defaults to Node's own `.env` reader. */
  load?: (path: string) => void;
  /** Injected in the tests; defaults to the repository root and the working directory. */
  defaultPaths?: string[];
}

/** `<repo>/.env` and `<cwd>/.env`, in that order. */
function defaultCandidates(): string[] {
  // src/ -> scan-import/ -> tools/ -> repository root. The CLI is CommonJS (tsx + bin/*.cjs),
  // so __dirname is the portable way here; `import.meta` would not survive the transpile.
  const repoRoot = resolve(__dirname, "..", "..", "..");
  const candidates = [resolve(repoRoot, ".env")];
  const local = resolve(process.cwd(), ".env");
  if (!candidates.includes(local)) candidates.push(local);
  return candidates;
}

/**
 * Loads the first credentials file that exists and returns its path, or `null` when there is
 * none - running without one is normal, because the variables can come from the shell.
 *
 * @throws Error when `FILMNOTES_ENV_FILE` names a file that is not there. A typo in the path
 * must not silently fall back to a different file, or the wrong server gets the upload.
 */
export function loadCredentialsFile(options: LoadOptions = {}): string | null {
  const {
    env = process.env,
    exists = existsSync,
    load = (path: string) => {
      process.loadEnvFile(path);
    },
    defaultPaths = defaultCandidates(),
  } = options;

  const explicit = env[ENV_FILE_VAR];
  if (explicit !== undefined && explicit !== "") {
    if (!exists(explicit)) {
      throw new Error(`${ENV_FILE_VAR} points at ${explicit}, which does not exist`);
    }
    load(explicit);
    return explicit;
  }

  for (const candidate of defaultPaths) {
    if (exists(candidate)) {
      load(candidate);
      return candidate;
    }
  }
  return null;
}
