/**
 * The `filmnotes-import` command: plan, confirm, upload.
 *
 * `main` is pure in the sense that everything with a side effect is injected – the terminal
 * through `io`, the server through `deps.createClient` – so the whole flow is tested without a
 * PocketBase instance. The real wiring lives in `cli.ts` and `pb.ts`.
 *
 * Exit codes: 0 success, 1 the import did not (fully) happen, 2 a usage mistake.
 */
import type { Frame, Id } from "@filmnotes/domain";

import { ArgumentError, PASSWORD_ENV, USAGE, parseArgs, wantsHelp } from "./args";
import { cleanupTempDirs, downloadSource, isUrl, listImageFiles } from "./files";
import { planImport, renderPlan, unassignedCount } from "./plan";
import type { PocketBaseLike } from "./upload";
import { uploadPlan } from "./upload";

/** Options for `Io.prompt`. */
export interface PromptOptions {
  /** Do not echo what the user types – used for the password. */
  hidden?: boolean;
}

/** The terminal, injected so tests can read the output and script the answers. */
export interface Io {
  stdout(text: string): void;
  stderr(text: string): void;
  prompt(question: string, options?: PromptOptions): Promise<string>;
}

/** Everything the import needs from the server. */
export interface ImportClient extends PocketBaseLike {
  /** Logs in as the app user and returns the id that becomes the `owner` of the scans. */
  authWithPassword(email: string, password: string): Promise<{ userId: Id }>;
  /** The roll's frames, including the deleted ones (the matching filters them out). */
  listFrames(rollId: Id): Promise<Frame[]>;
}

/**
 * The server side of the CLI, injected: the tests pass a fake, `cli.ts` passes the real
 * PocketBase client from `./pb`. Keeping the wiring in `cli.ts` is what keeps the ESM-only
 * PocketBase SDK out of the unit tests.
 */
export interface Deps {
  createClient(server: string): Promise<ImportClient>;
}

const EXIT_OK = 0;
const EXIT_FAILED = 1;
const EXIT_USAGE = 2;

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** True for `y`, `yes` and their upper-case variants; everything else means no. */
function isYes(answer: string): boolean {
  const normalized = answer.trim().toLowerCase();
  return normalized === "y" || normalized === "yes";
}

/** One line of JSON for a caller that is a program, not a person (`--json`). */
function summary(fields: {
  uploaded: number;
  skipped: number;
  failed: string[];
  files: number;
  dryRun?: boolean;
}): string {
  return JSON.stringify({ ...fields, dryRun: fields.dryRun ?? false });
}

export async function main(argv: string[], io: Io, deps: Deps): Promise<number> {
  if (wantsHelp(argv)) {
    io.stdout(USAGE);
    return EXIT_OK;
  }

  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    if (!(error instanceof ArgumentError)) throw error;
    io.stderr(`filmnotes-import: ${error.message}`);
    io.stderr("");
    io.stderr(USAGE);
    return EXIT_USAGE;
  }

  try {
    // A URL source is downloaded first, so the automation can hand over the lab's link and the
    // import still runs through exactly one code path (see docs/automation.md).
    const source = isUrl(args.source) ? await downloadSource(args.source) : args.source;
    const files = await listImageFiles(source);
    if (files.length === 0) {
      io.stderr(`filmnotes-import: no image files in ${args.source}`);
      if (args.json) io.stdout(summary({ uploaded: 0, skipped: 0, failed: [], files: 0 }));
      return EXIT_FAILED;
    }

    const password =
      args.password ?? (await io.prompt(`Password for ${args.email}: `, { hidden: true }));
    if (password === "") {
      io.stderr(`filmnotes-import: no password given (use --password or ${PASSWORD_ENV})`);
      return EXIT_USAGE;
    }

    const client = await deps.createClient(args.server);
    let ownerId: Id;
    try {
      ({ userId: ownerId } = await client.authWithPassword(args.email, password));
    } catch (error) {
      io.stderr(`filmnotes-import: login as ${args.email} failed: ${messageOf(error)}`);
      return EXIT_FAILED;
    }

    const frames = await client.listFrames(args.roll);
    const alive = frames.filter((frame) => frame.deleted === null);
    if (alive.length === 0) {
      io.stderr(
        `filmnotes-import: roll ${args.roll} has no frames – wrong roll id, or the roll belongs to another user`,
      );
      return EXIT_FAILED;
    }

    const assignments = planImport(files, frames);
    const unassigned = unassignedCount(assignments);
    if (!args.json)
      io.stdout(
        `Roll ${args.roll}: ${files.length} file(s) from ${args.source}, ${alive.length} frame(s) on the server`,
      );
    if (!args.json) {
      io.stdout("");
      io.stdout(renderPlan(assignments, frames));
      io.stdout("");
      if (unassigned > 0) {
        io.stdout(
          `${unassigned} file(s) have no frame; they are uploaded unassigned and can be attached in the app.`,
        );
      }
    }

    if (args.dryRun) {
      if (args.json) {
        io.stdout(
          summary({ uploaded: 0, skipped: 0, failed: [], files: files.length, dryRun: true }),
        );
      } else {
        io.stdout("Dry run: nothing was uploaded.");
      }
      return EXIT_OK;
    }

    if (!args.yes) {
      const answer = await io.prompt(`Upload ${files.length} scan(s) to ${args.server}? [y/N] `);
      if (!isYes(answer)) {
        io.stdout("Aborted, nothing was uploaded.");
        return EXIT_FAILED;
      }
    }

    const result = await uploadPlan(client, ownerId, args.roll, files, assignments, (line) =>
      args.json ? undefined : io.stdout(line),
    );
    if (!args.json) {
      io.stdout("");
      io.stdout(`Uploaded ${result.uploaded} of ${files.length} scan(s).`);
    }
    if (args.json) {
      io.stdout(
        summary({
          uploaded: result.uploaded,
          skipped: 0,
          failed: result.failed,
          files: files.length,
        }),
      );
    }
    if (result.failed.length > 0) {
      io.stderr(`filmnotes-import: ${result.failed.length} failed: ${result.failed.join(", ")}`);
      return EXIT_FAILED;
    }
    return EXIT_OK;
  } catch (error) {
    io.stderr(`filmnotes-import: ${messageOf(error)}`);
    return EXIT_FAILED;
  } finally {
    cleanupTempDirs();
  }
}
