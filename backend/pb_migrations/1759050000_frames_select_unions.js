/// <reference path="../pb_data/types.d.ts" />

/**
 * The server enforces the domain's unions on frames (T-023).
 *
 * These six fields were free `text()` since the init migration, so validation lived only in the
 * client and PocketBase stored whatever it was sent. Now they are selects carrying the values of
 * the matching unions in `packages/domain/src/types.ts` - adding a member to one of those unions
 * therefore needs a migration too (`backendSchema.test.ts` fails until it has one).
 *
 * PocketBase refuses to change a field's type in place ("Field type cannot be changed"), and a
 * new field under the old name would drop the column with its data. So each field is renamed out
 * of the way, a select takes its name, the values are copied across in SQL and the old field is
 * removed. The migration runs in one transaction; any failure leaves the schema as it was.
 *
 * A stored value outside the unions stops the migration, with every such record named, instead
 * of being carried into a field that would then refuse the record's next update. What happens to
 * such a value is a decision for the owner, not for a migration.
 */

const UNIONS = {
  exposureMode: ["P", "A", "S", "M"],
  focusMode: ["AF", "M"],
  afResult: ["green", "red_blink", "manual"],
  driveMode: ["S", "C", "ST"],
  flashHead: ["direct", "bounce"],
  support: ["handheld", "braced", "tripod", "beanbag"],
};

const OLD_SUFFIX = "__text";

function refuseForeignValues(app) {
  const problems = [];
  for (const [field, values] of Object.entries(UNIONS)) {
    const filter = [`${field} != ''`, ...values.map((value) => `${field} != '${value}'`)].join(
      " && ",
    );
    for (const record of app.findRecordsByFilter("frames", filter)) {
      problems.push(`${record.id}: ${field} = ${JSON.stringify(record.getString(field))}`);
    }
  }
  if (problems.length > 0) {
    throw new Error(
      "frames hold values outside the domain's unions, so they cannot become selects - " +
        "fix or clear these records first (T-023): " +
        problems.join("; "),
    );
  }
}

/** Swaps every union field for a new one of the same name, keeping the stored values. */
function retype(app, makeField) {
  const collection = app.findCollectionByNameOrId("frames");
  const names = Object.keys(UNIONS);

  for (const name of names) collection.fields.getByName(name).name = name + OLD_SUFFIX;
  app.save(collection);

  for (const name of names) collection.fields.add(makeField(name, UNIONS[name]));
  app.save(collection);

  const assignments = names.map((name) => `\`${name}\` = \`${name}${OLD_SUFFIX}\``).join(", ");
  app.db().newQuery(`UPDATE \`frames\` SET ${assignments}`).execute();

  for (const name of names) collection.fields.removeByName(name + OLD_SUFFIX);
  app.save(collection);
}

migrate(
  (app) => {
    refuseForeignValues(app);
    retype(app, (name, values) => new SelectField({ name, maxSelect: 1, values }));
  },
  (app) => {
    retype(app, (name) => new TextField({ name }));
  },
);
