/// <reference path="../pb_data/types.d.ts" />

/**
 * `rolls.labOrderId` - the lab's own order number.
 *
 * It is what ties a roll to a delivery: the scan automation (see `docs/automation.md`) asks the
 * lab about the order and knows which roll the files belong to. Indexed because that automation
 * looks rolls up by it; nullable because a roll developed at home never has one.
 */
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("rolls");
    // A typed field instance, not a plain object: the JSVM cannot convert one into
    // `core.Field` (the init migration gets away with objects because `new Collection({...})`
    // does the conversion itself).
    collection.fields.add(new TextField({ name: "labOrderId", max: 64 }));
    collection.addIndex("idx_rolls_labOrderId", false, "`labOrderId`", "");
    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("rolls");
    collection.removeIndex("idx_rolls_labOrderId");
    collection.fields.removeByName("labOrderId");
    app.save(collection);
  },
);
