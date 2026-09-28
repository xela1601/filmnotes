/**
 * The migration that turns the frames' union fields into selects, run over data that is
 * already there (T-023).
 *
 * The smoke test only ever sees a fresh database. This one does what a deploy does: it brings a
 * database up to the migration before, seeds frames through an extra migration, and only then
 * adds the new one and applies it with the real binary, reading the SQLite file back after: valid values have to survive the change of field type, a value
 * outside the unions has to stop the migration with its record named, and `down` has to give
 * the text fields back with their values.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { MISSING_BINARY_HINT, hasPocketBase, migrationsDir, pocketBaseBin } from "./helpers.mjs";

const MIGRATION = "1759050000_frames_select_unions.js";
const FIELDS = ["exposureMode", "focusMode", "afResult", "driveMode", "flashHead", "support"];

const VALID = {
  id: "fram0unionvalid",
  exposureMode: "A",
  focusMode: "M",
  afResult: "green",
  driveMode: "C",
  flashHead: "direct",
  support: "tripod",
};
const EMPTY = { id: "fram0unionempty" };

/**
 * A database at the state before `MIGRATION`, holding the given `frames` rows.
 * `migrate()` then adds `MIGRATION` and runs it, the way a deploy would.
 */
function prepare(rows) {
  const root = mkdtempSync(join(tmpdir(), "filmnotes-unions-"));
  const migrations = join(root, "pb_migrations");
  mkdirSync(migrations);
  const earlier = readdirSync(migrationsDir).filter(
    (name) => name.endsWith(".js") && name !== MIGRATION,
  );
  for (const file of earlier) {
    copyFileSync(join(migrationsDir, file), join(migrations, file));
  }
  const inserts = rows.map((row) => {
    const columns = ["rollId", ...Object.keys(row)];
    const values = ["roll0uniontest1", ...Object.values(row)];
    return (
      "app.db().newQuery(" +
      JSON.stringify(
        `INSERT INTO frames (${columns.map((c) => `\`${c}\``).join(", ")}) VALUES (${values
          .map((v) => `'${v}'`)
          .join(", ")})`,
      ) +
      ").execute();"
    );
  });
  writeFileSync(
    join(migrations, "1759049999_test_seed_frames.js"),
    `migrate((app) => {\n${inserts.join("\n")}\n});\n`,
  );
  const dataDir = join(root, "pb_data");
  const run = (...args) =>
    spawnSync(
      pocketBaseBin,
      ["migrate", ...args, "--dir", dataDir, "--migrationsDir", migrations],
      {
        encoding: "utf8",
        // `migrate down` asks for confirmation and treats a closed stdin as "no".
        input: "y\n",
      },
    );
  const before = run("up");
  if (before.status !== 0) throw new Error(`seeding failed: ${before.stderr || before.stdout}`);
  return {
    dataDir,
    run,
    migrate: () => {
      copyFileSync(join(migrationsDir, MIGRATION), join(migrations, MIGRATION));
      return run("up");
    },
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

function read(dataDir) {
  const db = new DatabaseSync(join(dataDir, "data.db"), { readOnly: true });
  try {
    const { fields } = db.prepare("SELECT fields FROM _collections WHERE name = 'frames'").get();
    const types = Object.fromEntries(
      JSON.parse(fields)
        .filter((field) => FIELDS.includes(field.name))
        .map((field) => [field.name, field.type]),
    );
    const rows = db
      .prepare(`SELECT id, ${FIELDS.map((f) => `\`${f}\``).join(", ")} FROM frames ORDER BY id`)
      .all()
      .map((row) => ({ ...row }));
    const applied = db
      .prepare("SELECT file FROM _migrations")
      .all()
      .map((row) => row.file);
    return { types, rows, applied };
  } finally {
    db.close();
  }
}

const allOf = (type) => Object.fromEntries(FIELDS.map((field) => [field, type]));
const blank = Object.fromEntries(FIELDS.map((field) => [field, ""]));

if (!hasPocketBase()) {
  test.skip(`frame unions migration: ${MISSING_BINARY_HINT}`, () => {});
} else {
  test("frame unions migration", async (t) => {
    await t.test("keeps every valid value and turns the fields into selects", () => {
      const pb = prepare([VALID, EMPTY]);
      t.after(pb.cleanup);

      const up = pb.migrate();
      assert.equal(up.status, 0, up.stderr || up.stdout);

      const { types, rows, applied } = read(pb.dataDir);
      assert.ok(applied.includes(MIGRATION), `${MIGRATION} is applied`);
      assert.deepEqual(types, allOf("select"));
      assert.deepEqual(rows, [{ ...blank, ...EMPTY }, VALID]);
    });

    await t.test("down gives the text fields back, values included", () => {
      const pb = prepare([VALID, EMPTY]);
      t.after(pb.cleanup);

      assert.equal(pb.migrate().status, 0);
      const down = pb.run("down", "1");
      assert.equal(down.status, 0, down.stderr || down.stdout);

      const { types, rows, applied } = read(pb.dataDir);
      assert.ok(!applied.includes(MIGRATION), `${MIGRATION} is reverted`);
      assert.deepEqual(types, allOf("text"));
      assert.deepEqual(rows, [{ ...blank, ...EMPTY }, VALID]);
    });

    await t.test("refuses to run over a value outside the unions, and names it", () => {
      const foreign = { id: "fram0unionalien", exposureMode: "Av", support: "monopod" };
      const pb = prepare([VALID, foreign]);
      t.after(pb.cleanup);

      const up = pb.migrate();
      const output = up.stderr + up.stdout;
      assert.notEqual(up.status, 0, "the migration must not apply");
      for (const expected of [foreign.id, "exposureMode", '"Av"', "support", '"monopod"']) {
        assert.ok(output.includes(expected), `the error names ${expected}:\n${output}`);
      }

      // Rolled back as a whole: nothing half-converted, the stored values untouched.
      const { types, rows, applied } = read(pb.dataDir);
      assert.ok(!applied.includes(MIGRATION), `${MIGRATION} is not recorded as applied`);
      assert.deepEqual(types, allOf("text"));
      assert.deepEqual(rows, [{ ...blank, ...foreign }, VALID]);
    });
  });
}
