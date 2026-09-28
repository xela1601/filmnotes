/// <reference path="../pb_data/types.d.ts" />

/**
 * `rolls.labProfileId` - which lab profile a roll goes through (T-024).
 *
 * The profiles themselves are preset data in `@filmnotes/presets`, not a collection, so this is a
 * plain text id like `cameraId`, not a relation. Empty for a roll developed or scanned at home.
 */
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("rolls");
    collection.fields.add(new TextField({ name: "labProfileId", max: 15 }));
    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("rolls");
    collection.fields.removeByName("labProfileId");
    app.save(collection);
  },
);
