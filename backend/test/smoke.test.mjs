/**
 * Integration smoke test: boots the real PocketBase binary with `pb_migrations`
 * applied and asserts the schema and the owner-scoped API rules over plain REST.
 *
 * Skipped (not failed) when `backend/bin/pocketbase` is missing - see the hint below.
 * Run with `npm test -w @filmnotes/backend`.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ONE_PIXEL_PNG,
  MISSING_BINARY_HINT,
  api,
  createUser,
  hasPocketBase,
  login,
  loginSuperuser,
  startPocketBase,
} from "./helpers.mjs";

const EXPECTED_COLLECTIONS = [
  "cameras",
  "lenses",
  "filters",
  "flashes",
  "film_stocks",
  "rolls",
  "frames",
  "scans",
  "export_logs",
];

// 15 chars, exactly the shape newId() produces - PocketBase rejects anything longer.
const ROLL_ID = "roll0smoketest1";
const USER_A = { email: "owner-a@filmnotes.test", password: "smoke-user-pw-123" };
const USER_B = { email: "owner-b@filmnotes.test", password: "smoke-user-pw-456" };

/**
 * Payloads produced by the app's own `toRemote` (see the fixture test in
 * `apps/mobile/src/sync/mapping.test.ts`). Hand-written bodies would only prove that *this file*
 * agrees with the schema; these prove that what the client sends does.
 */
const CLIENT_PAYLOADS = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "fixtures", "remote-records.json"),
    "utf8",
  ),
);

if (!hasPocketBase()) {
  test.skip(`PocketBase smoke test: ${MISSING_BINARY_HINT}`, () => {});
} else {
  test("PocketBase smoke test", async (t) => {
    const pb = await startPocketBase();
    t.after(() => pb.stop());

    const superuserToken = await loginSuperuser(pb.url);
    const a = await createUser(pb.url, superuserToken, USER_A.email, USER_A.password);
    await createUser(pb.url, superuserToken, USER_B.email, USER_B.password);
    const sessionA = await login(pb.url, USER_A.email, USER_A.password);
    const sessionB = await login(pb.url, USER_B.email, USER_B.password);
    assert.equal(sessionA.user.id, a.id, "login returns the created user");

    await t.test("1. all 9 collections exist", async () => {
      const { status, body } = await api(pb.url, "/api/collections?perPage=200", {
        token: superuserToken,
      });
      assert.equal(status, 200);
      const names = body.items.map((item) => item.name);
      for (const name of EXPECTED_COLLECTIONS) {
        assert.ok(names.includes(name), `collection ${name} is missing`);
      }
    });

    await t.test("2. a user creates a roll with a client-generated id", async () => {
      const { status, body } = await api(pb.url, "/api/collections/rolls/records", {
        token: sessionA.token,
        method: "POST",
        body: {
          id: ROLL_ID,
          cameraId: "cam0smoketest01",
          filmStockId: "film0smoketest1",
          isoSet: 200,
          isoSource: "DX",
          exposures: 36,
          pushPullEv: 0,
          status: "loaded",
          loadedAt: "2026-09-18T10:00:00.000Z",
          lab: "DM",
          notes: "smoke test roll",
          clientUpdated: "2026-09-18T10:00:00.000Z",
          owner: sessionA.user.id,
        },
      });
      assert.equal(status, 200, JSON.stringify(body));
      assert.equal(body.id, ROLL_ID, "the client id is kept");
      assert.equal(body.owner, sessionA.user.id);
    });

    await t.test("3. a frame references the roll and is filterable by rollId", async () => {
      const created = await api(pb.url, "/api/collections/frames/records", {
        token: sessionA.token,
        method: "POST",
        body: {
          rollId: ROLL_ID,
          frameNo: 1,
          takenAt: "2026-09-18T11:00:00.000Z",
          exposureMode: "A",
          shutterSpeed: "1/125",
          aperture: 5.6,
          exposureCompensationEv: 0,
          programShift: false,
          aeLock: false,
          filterIds: [],
          lensHood: true,
          notes: "smoke test frame",
          owner: sessionA.user.id,
        },
      });
      assert.equal(created.status, 200, JSON.stringify(created.body));

      const filter = encodeURIComponent(`rollId = '${ROLL_ID}'`);
      const listed = await api(pb.url, `/api/collections/frames/records?filter=${filter}`, {
        token: sessionA.token,
      });
      assert.equal(listed.status, 200);
      assert.equal(listed.body.totalItems, 1);
      assert.equal(listed.body.items[0].rollId, ROLL_ID);
    });

    await t.test("4. rolls are invisible to other users and to anonymous callers", async () => {
      const other = await api(pb.url, "/api/collections/rolls/records", { token: sessionB.token });
      assert.equal(other.status, 200);
      assert.equal(other.body.totalItems, 0, "the second user must not see foreign rolls");

      const otherView = await api(pb.url, `/api/collections/rolls/records/${ROLL_ID}`, {
        token: sessionB.token,
      });
      assert.ok(
        otherView.status === 403 || otherView.status === 404,
        `the second user must not read a foreign roll, got ${otherView.status}`,
      );

      // PocketBase applies a list rule as a query filter, so an anonymous list is answered
      // with 200 and an empty page rather than 401/403; only a leak would be a failure.
      const anonymousList = await api(pb.url, "/api/collections/rolls/records");
      if (anonymousList.status === 200) {
        assert.equal(anonymousList.body.totalItems, 0, "anonymous list must not leak records");
      } else {
        assert.ok(
          anonymousList.status === 401 || anonymousList.status === 403,
          `anonymous list should be rejected, got ${anonymousList.status}`,
        );
      }

      const anonymousView = await api(pb.url, `/api/collections/rolls/records/${ROLL_ID}`);
      assert.ok(
        anonymousView.status === 401 ||
          anonymousView.status === 403 ||
          anonymousView.status === 404,
        `anonymous view should be rejected, got ${anonymousView.status}`,
      );

      const anonymousCreate = await api(pb.url, "/api/collections/rolls/records", {
        method: "POST",
        body: { cameraId: "cam0smoketest01", filmStockId: "film0smoketest1" },
      });
      assert.ok(
        anonymousCreate.status === 400 ||
          anonymousCreate.status === 401 ||
          anonymousCreate.status === 403,
        `anonymous create should be rejected, got ${anonymousCreate.status}`,
      );

      // The create rule must also stop an authenticated user from claiming a foreign owner.
      const spoofed = await api(pb.url, "/api/collections/rolls/records", {
        token: sessionB.token,
        method: "POST",
        body: {
          cameraId: "cam0smoketest01",
          filmStockId: "film0smoketest1",
          owner: sessionA.user.id,
        },
      });
      assert.ok(
        spoofed.status === 400 || spoofed.status === 403,
        `owner spoofing should be rejected, got ${spoofed.status}`,
      );
    });

    await t.test(
      "5. the payloads the app's mapping produces are accepted as they are",
      async () => {
        for (const [collection, payload] of Object.entries(CLIENT_PAYLOADS)) {
          const { status, body } = await api(pb.url, `/api/collections/${collection}/records`, {
            token: sessionA.token,
            method: "POST",
            body: { ...payload, owner: sessionA.user.id },
          });
          assert.equal(status, 200, `${collection}: ${JSON.stringify(body)}`);
          assert.equal(body.id, payload.id, `${collection} keeps the client id`);
          assert.equal(
            body.clientUpdated.replace(" ", "T"),
            payload.clientUpdated,
            `${collection} keeps clientUpdated`,
          );
        }
      },
    );

    await t.test("6. the change feed needs PocketBase's own date format", async () => {
      // Why `asPocketBaseDate` exists (apps/mobile/src/sync/client.ts): the filter is compared
      // lexically against the stored string, and 'T' > ' ', so an ISO watermark sorts after every
      // timestamp of the same day and the feed comes back empty - silently.
      const record = await api(pb.url, `/api/collections/rolls/records/${ROLL_ID}`, {
        token: sessionA.token,
      });
      assert.equal(record.status, 200);
      const stored = record.body.updated;
      const oneSecondEarlier = new Date(Date.parse(stored.replace(" ", "T")) - 1000)
        .toISOString()
        .replace("T", " ");

      const withPocketBaseFormat = await api(
        pb.url,
        `/api/collections/rolls/records?filter=${encodeURIComponent(`updated > "${oneSecondEarlier}"`)}`,
        { token: sessionA.token },
      );
      assert.equal(withPocketBaseFormat.status, 200);
      assert.ok(
        withPocketBaseFormat.body.totalItems >= 1,
        "a watermark in PocketBase's format finds the record",
      );

      const withIsoFormat = await api(
        pb.url,
        `/api/collections/rolls/records?filter=${encodeURIComponent(
          `updated > "${oneSecondEarlier.replace(" ", "T")}"`,
        )}`,
        { token: sessionA.token },
      );
      assert.equal(withIsoFormat.status, 200);
      assert.equal(
        withIsoFormat.body.totalItems,
        0,
        "an ISO watermark of the same instant finds nothing - this is the trap",
      );
    });

    await t.test("7. scans accept an image upload and serve a thumbnail", async () => {
      const form = new FormData();
      form.set("rollId", ROLL_ID);
      form.set("fileName", "smoke-0001.png");
      form.set("sortIndex", "1");
      form.set("importedAt", "2026-09-18T12:00:00.000Z");
      form.set("owner", sessionA.user.id);
      form.set("file", new Blob([ONE_PIXEL_PNG], { type: "image/png" }), "smoke-0001.png");

      const created = await api(pb.url, "/api/collections/scans/records", {
        token: sessionA.token,
        method: "POST",
        body: form,
      });
      assert.equal(created.status, 200, JSON.stringify(created.body));
      assert.ok(created.body.file, "the response carries the stored file name");

      const fileUrl = `${pb.url}/api/files/scans/${created.body.id}/${created.body.file}?thumb=200x200`;

      // The file field is protected (migration 1758600000): the bytes need a token, or anyone
      // who knows the URL could read someone else's scans.
      const anonymous = await fetch(fileUrl);
      assert.notEqual(anonymous.status, 200, "a protected file must not be served without a token");

      const token = await api(pb.url, "/api/files/token", {
        token: sessionA.token,
        method: "POST",
      });
      assert.equal(token.status, 200, JSON.stringify(token.body));
      const withToken = await fetch(`${fileUrl}&token=${token.body.token}`);
      assert.equal(withToken.status, 200, `thumbnail request failed for ${fileUrl}`);
    });
  });
}
