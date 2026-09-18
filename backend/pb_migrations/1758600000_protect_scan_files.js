/// <reference path="../pb_data/types.d.ts" />

/**
 * Protects the scan images.
 *
 * The `scans` collection was always owner-only for the *record*, but its `file` field was not
 * marked `protected`, and PocketBase serves the bytes of an unprotected file to anyone who knows
 * the URL - no token, no session. The file names carry a random suffix, so the URLs are hard to
 * guess, but "hard to guess" is not "private", and the backend README promised the latter.
 *
 * With `protected: true` a file URL needs a short-lived token from `pb.files.getToken()`, which
 * the app appends (see `fileUrl` in `apps/mobile/src/sync/client.ts`).
 */
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("scans");
    const field = collection.fields.getByName("file");
    field.protected = true;
    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("scans");
    const field = collection.fields.getByName("file");
    field.protected = false;
    app.save(collection);
  },
);
