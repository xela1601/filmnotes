/**
 * Command line parsing for `filmnotes-import`.
 *
 * Hand-written on purpose: the CLI has six options, and a parser dependency would be the only
 * one in this workspace that is not needed for the actual import.
 */

/** Everything the import needs, after the command line and the environment were merged. */
export interface Args {
  /** PocketBase base URL, e.g. `https://pb.example.com`. */
  server: string;
  /** Email of the app user in the `users` collection; becomes the `owner` of every scan. */
  email: string;
  /** From `--password` or `FILMNOTES_PASSWORD`; `undefined` means "ask interactively". */
  password: string | undefined;
  /** Id of the roll the scans belong to. */
  roll: string;
  /** Folder or `.zip` file holding the scans. */
  source: string;
  /** Skip the confirmation prompt. */
  yes: boolean;
  /** Show the plan and stop before the first upload. */
  dryRun: boolean;
}

/** A usage problem: the caller made a mistake, so `main` prints the usage and exits with 2. */
export class ArgumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArgumentError";
  }
}

/** The environment variable that carries the password, so it never shows up in the process list. */
export const PASSWORD_ENV = "FILMNOTES_PASSWORD";

/** Options that take a value. */
const VALUE_FLAGS = ["--server", "--email", "--password", "--roll"] as const;
type ValueFlag = (typeof VALUE_FLAGS)[number];

function isValueFlag(candidate: string): candidate is ValueFlag {
  return (VALUE_FLAGS as readonly string[]).includes(candidate);
}

export const USAGE = `Usage: filmnotes-import --server <url> --email <address> --roll <rollId> <folder|zip>

Imports lab scans for one roll into PocketBase: lists the roll's frames, proposes a
file to frame mapping, asks for confirmation and uploads the files as scan records.

Options:
  --server <url>        PocketBase base URL, e.g. https://pb.example.com
  --email <address>     App user (owner of the created scan records)
  --password <secret>   Password; prefer ${PASSWORD_ENV} or the interactive prompt
  --roll <rollId>       Id of the roll the scans belong to
  -y, --yes             Do not ask for confirmation
      --dry-run         Print the plan and exit without uploading
  -h, --help            Show this help

Environment:
  ${PASSWORD_ENV}   Password, used when --password is omitted`;

/**
 * Parses `argv` (without `node` and the script name) and folds in the password from `env`.
 *
 * `--flag value` and `--flag=value` are both accepted. Everything that is not an option is the
 * source, of which there has to be exactly one.
 *
 * @throws ArgumentError on an unknown flag, a missing value or a missing required option.
 */
export function parseArgs(
  argv: string[],
  env: Record<string, string | undefined> = process.env,
): Args {
  const values = new Map<ValueFlag, string>();
  const positional: string[] = [];
  let yes = false;
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] as string;

    if (token === "-y" || token === "--yes") {
      yes = true;
      continue;
    }
    if (token === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (token.startsWith("--") && token.includes("=")) {
      const separator = token.indexOf("=");
      const flag = token.slice(0, separator);
      if (!isValueFlag(flag)) throw new ArgumentError(`unknown option ${flag}`);
      values.set(flag, token.slice(separator + 1));
      continue;
    }

    if (isValueFlag(token)) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("-")) {
        throw new ArgumentError(`${token} needs a value`);
      }
      values.set(token, value);
      index += 1;
      continue;
    }

    if (token.startsWith("-")) throw new ArgumentError(`unknown option ${token}`);
    positional.push(token);
  }

  const required = (flag: ValueFlag): string => {
    const value = values.get(flag);
    if (value === undefined || value === "") throw new ArgumentError(`${flag} is required`);
    return value;
  };

  const server = required("--server");
  const email = required("--email");
  const roll = required("--roll");

  if (positional.length === 0) {
    throw new ArgumentError("the source folder or zip file is missing");
  }
  if (positional.length > 1) {
    throw new ArgumentError(`expected exactly one source, got ${positional.length}`);
  }

  const fromEnv = env[PASSWORD_ENV];
  const password = values.get("--password") ?? (fromEnv === "" ? undefined : fromEnv);

  return { server, email, password, roll, source: positional[0] as string, yes, dryRun };
}

/** True when the argument list only asks for the usage text. */
export function wantsHelp(argv: string[]): boolean {
  return argv.includes("-h") || argv.includes("--help");
}
