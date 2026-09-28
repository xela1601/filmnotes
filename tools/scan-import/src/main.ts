/**
 * The `filmnotes-import` command: plan, confirm, upload.
 *
 * `main` is pure in the sense that everything with a side effect is injected – the terminal
 * through `io`, the server through `deps.createClient` – so the whole flow is tested without a
 * PocketBase instance. The real wiring lives in `cli.ts` and `pb.ts`.
 *
 * Exit codes: 0 success, 1 the import did not (fully) happen, 2 a usage mistake.
 */
import type { Frame, Id, LabProfile } from "@filmnotes/domain";
import { fillLabTemplate } from "@filmnotes/domain";
import { findLabProfile } from "@filmnotes/presets";

import { ArgumentError, PASSWORD_ENV, USAGE, parseArgs, wantsHelp } from "./args";
import type { ImageFile } from "./files";
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

/** What the import needs to know about the roll itself: which lab, which order. */
export interface RollLab {
  labProfileId: Id | null;
  labOrderId: string | null;
}

/** Everything the import needs from the server. */
export interface ImportClient extends PocketBaseLike {
  /** Logs in as the app user and returns the id that becomes the `owner` of the scans. */
  authWithPassword(email: string, password: string): Promise<{ userId: Id }>;
  /** The roll's frames, including the deleted ones (the matching filters them out). */
  listFrames(rollId: Id): Promise<Frame[]>;
  /** The roll's lab fields, or null when the roll does not exist for this user. */
  getRoll(rollId: Id): Promise<RollLab | null>;
}

/**
 * The server side of the CLI, injected: the tests pass a fake, `cli.ts` passes the real
 * PocketBase client from `./pb`. Keeping the wiring in `cli.ts` is what keeps the ESM-only
 * PocketBase SDK out of the unit tests.
 */
export interface Deps {
  createClient(server: string): Promise<ImportClient>;
  /** The network for a URL source and the lab download; the global `fetch` when omitted. */
  fetch?: typeof fetch;
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

  const fetchImpl = deps.fetch ?? fetch;
  const noImages = (where: string): number => {
    io.stderr(`filmnotes-import: no image files in ${where}`);
    if (args.json) io.stdout(summary({ uploaded: 0, skipped: 0, failed: [], files: 0 }));
    return EXIT_FAILED;
  };

  try {
    // A URL source is downloaded first, so the automation can hand over the lab's link and the
    // import still runs through exactly one code path (see docs/automation.md). The lab download
    // has to wait for the login: it needs the roll's profile and order number.
    let files: ImageFile[] = [];
    if (args.source !== null) {
      const source = isUrl(args.source)
        ? await downloadSource(args.source, fetchImpl)
        : args.source;
      files = await listImageFiles(source);
      if (files.length === 0) return noImages(args.source);
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

    const roll = await client.getRoll(args.roll);
    const profile = findLabProfile(roll?.labProfileId ?? null);
    let sourceLabel = args.source ?? "";
    if (args.labDownload) {
      const downloaded = await downloadFromLab(args.roll, roll, profile, io, fetchImpl);
      if (typeof downloaded === "number") return downloaded;
      files = downloaded.files;
      sourceLabel = `the lab (${downloaded.profile.name})`;
      if (files.length === 0) return noImages(sourceLabel);
    }

    const frames = await client.listFrames(args.roll);
    const alive = frames.filter((frame) => frame.deleted === null);
    if (alive.length === 0) {
      io.stderr(
        `filmnotes-import: roll ${args.roll} has no frames – wrong roll id, or the roll belongs to another user`,
      );
      return EXIT_FAILED;
    }

    const assignments = planImport(files, frames, profile?.scanFrameNumberPattern ?? null);
    const unassigned = unassignedCount(assignments);
    if (!args.json)
      io.stdout(
        `Roll ${args.roll}: ${files.length} file(s) from ${sourceLabel}, ${alive.length} frame(s) on the server`,
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

/**
 * Fetches the roll's scans through its lab profile's download endpoint (T-024).
 *
 * The Secure-ID is asked for here, used for this one request and dropped: it is not returned,
 * not logged, and cut out of any error message, because the URL it is part of would otherwise
 * end up on the screen. Returns an exit code when the download cannot or did not happen.
 */
async function downloadFromLab(
  rollId: Id,
  roll: RollLab | null,
  profile: LabProfile | null,
  io: Io,
  fetchImpl: typeof fetch,
): Promise<{ files: ImageFile[]; profile: LabProfile } | number> {
  if (roll === null) {
    io.stderr(`filmnotes-import: roll ${rollId} not found for this user`);
    return EXIT_FAILED;
  }
  if (profile?.download == null) {
    io.stderr(
      `filmnotes-import: roll ${rollId} has no lab profile with a download - set the lab on the roll, or import from a folder or zip`,
    );
    return EXIT_FAILED;
  }
  if (!roll.labOrderId?.trim()) {
    io.stderr(
      `filmnotes-import: roll ${rollId} has no lab order number - enter the one from the lab's insert on the roll first`,
    );
    return EXIT_FAILED;
  }

  const secureId = (
    await io.prompt(`Secure-ID from the ${profile.name} insert: `, { hidden: true })
  ).trim();
  if (secureId === "") {
    io.stderr("filmnotes-import: no Secure-ID given");
    return EXIT_USAGE;
  }
  const filled = fillLabTemplate(profile.download, { orderId: roll.labOrderId, secureId });
  if (!filled.ok) {
    io.stderr(
      `filmnotes-import: the ${profile.name} download needs more than an order number and a Secure-ID`,
    );
    return EXIT_FAILED;
  }

  try {
    return { files: await listImageFiles(await downloadSource(filled.url, fetchImpl)), profile };
  } catch (error) {
    const message = messageOf(error)
      .split(`download ${filled.url}`)
      .join(`download from ${profile.name}`)
      .split(filled.url)
      .join(`the ${profile.name} download`)
      .split(secureId)
      .join("<Secure-ID>");
    io.stderr(`filmnotes-import: ${message}`);
    io.stderr("Check the order number on the roll and the Secure-ID; lab downloads also expire.");
    return EXIT_FAILED;
  }
}
