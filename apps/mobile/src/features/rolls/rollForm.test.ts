import { ID_PATTERN } from "@filmnotes/domain";

import { makeCamera, makeFilmStock, makeRoll } from "../../testing/fixtures";
import {
  applyFilmStock,
  dateInputFromIso,
  defaultRollForm,
  formFromRoll,
  isoFromDateInput,
  rollFromForm,
  validateRollForm,
  type RollFormValues,
} from "./rollForm";

const NOW = "2026-09-18T10:00:00.000Z";

function validValues(overrides: Partial<RollFormValues> = {}): RollFormValues {
  return {
    cameraId: "cam0minolta7000",
    filmStockId: "film0kodakgold2",
    isoSet: 200,
    isoSource: "DX",
    exposures: 36,
    pushPullEv: 0,
    loadedAt: NOW,
    labOrderId: "",
    lab: "",
    notes: "",
    ...overrides,
  };
}

describe("defaultRollForm", () => {
  it("picks the first camera, 36 exposures, DX and no film", () => {
    const values = defaultRollForm(
      [makeCamera(), makeCamera({ id: "cam0other000001" })],
      [makeFilmStock()],
      NOW,
    );

    expect(values).toEqual({
      cameraId: "cam0minolta7000",
      filmStockId: null,
      isoSet: null,
      isoSource: "DX",
      exposures: 36,
      pushPullEv: 0,
      loadedAt: NOW,
      lab: "",
      labOrderId: "",
      notes: "",
    });
  });

  it("leaves the camera empty when none exists", () => {
    expect(defaultRollForm([], [], NOW).cameraId).toBeNull();
  });
});

describe("applyFilmStock", () => {
  it("takes id, ISO and the number of exposures from the stock", () => {
    const values = applyFilmStock(
      defaultRollForm([makeCamera()], [], NOW),
      makeFilmStock({ exposures: 24 }),
    );

    expect(values.filmStockId).toBe("film0kodakgold2");
    expect(values.isoSet).toBe(200);
    expect(values.exposures).toBe(24);
  });

  it("keeps the chosen number of exposures when the stock does not state one", () => {
    const before = { ...defaultRollForm([makeCamera()], [], NOW), exposures: 24 as const };

    const values = applyFilmStock(before, makeFilmStock({ exposures: null }));

    expect(values.exposures).toBe(24);
    expect(values.isoSet).toBe(200);
  });
});

describe("validateRollForm", () => {
  it("accepts a complete form", () => {
    expect(validateRollForm(validValues())).toEqual({});
  });

  it("flags a missing camera, film stock, ISO and load date as required", () => {
    const errors = validateRollForm(
      validValues({ cameraId: null, filmStockId: null, isoSet: null, loadedAt: "" }),
    );

    expect(errors).toEqual({
      cameraId: "required",
      filmStockId: "required",
      isoSet: "required",
      loadedAt: "required",
    });
  });

  it("flags an ISO outside 6 … 12800", () => {
    expect(validateRollForm(validValues({ isoSet: 5 })).isoSet).toBe("iso_range");
    expect(validateRollForm(validValues({ isoSet: 12801 })).isoSet).toBe("iso_range");
    expect(validateRollForm(validValues({ isoSet: 6 })).isoSet).toBeUndefined();
    expect(validateRollForm(validValues({ isoSet: 12800 })).isoSet).toBeUndefined();
  });
});

describe("rollFromForm", () => {
  it("creates a loaded roll with a fresh id and now as both timestamps", () => {
    const roll = rollFromForm(validValues({ lab: "  Foto Meyer  " }), null, NOW);

    expect(roll.id).toHaveLength(15);
    expect(roll.id).toMatch(ID_PATTERN);
    expect(roll.status).toBe("loaded");
    expect(roll.created).toBe(NOW);
    expect(roll.updated).toBe(NOW);
    expect(roll.deleted).toBeNull();
    expect(roll.unloadedAt).toBeNull();
    expect(roll.cameraId).toBe("cam0minolta7000");
    expect(roll.filmStockId).toBe("film0kodakgold2");
    expect(roll.isoSet).toBe(200);
    expect(roll.lab).toBe("Foto Meyer");
  });

  it("keeps id, created and status of an edited roll", () => {
    const existing = makeRoll({ status: "at_lab", created: "2026-01-01T00:00:00.000Z" });

    const roll = rollFromForm(validValues({ notes: "second half" }), existing, NOW);

    expect(roll.id).toBe(existing.id);
    expect(roll.created).toBe(existing.created);
    expect(roll.status).toBe("at_lab");
    expect(roll.updated).toBe(NOW);
    expect(roll.notes).toBe("second half");
  });

  it("stores an empty lab as null", () => {
    expect(rollFromForm(validValues({ lab: "   " }), null, NOW).lab).toBeNull();
  });
});

describe("formFromRoll", () => {
  it("maps a roll back onto the form values", () => {
    const roll = makeRoll({ lab: null, pushPullEv: 1, isoSource: "manual" });

    expect(formFromRoll(roll)).toEqual({
      cameraId: roll.cameraId,
      filmStockId: roll.filmStockId,
      isoSet: roll.isoSet,
      isoSource: "manual",
      exposures: 36,
      pushPullEv: 1,
      loadedAt: roll.loadedAt,
      lab: "",
      labOrderId: "",
      notes: "",
    });
  });
});

describe("the loaded-at date field", () => {
  it("shows the date part of the timestamp", () => {
    expect(dateInputFromIso(NOW)).toBe("2026-09-18");
    expect(dateInputFromIso("")).toBe("");
  });

  it("parses a YYYY-MM-DD input into a UTC timestamp", () => {
    expect(isoFromDateInput("2026-09-18")).toBe("2026-09-18T00:00:00.000Z");
  });

  it("rejects an incomplete or impossible date", () => {
    expect(isoFromDateInput("2026-09")).toBeNull();
    expect(isoFromDateInput("2026-13-01")).toBeNull();
    expect(isoFromDateInput("2026-02-30")).toBeNull();
    expect(isoFromDateInput("")).toBeNull();
  });
});

describe("the lab order number", () => {
  it("is stored trimmed and an empty field becomes null", () => {
    expect(rollFromForm(validValues({ labOrderId: "  540996 " }), null, NOW).labOrderId).toBe(
      "540996",
    );
    expect(rollFromForm(validValues({ labOrderId: "   " }), null, NOW).labOrderId).toBeNull();
  });

  it("comes back into the form when the roll is edited", () => {
    expect(formFromRoll(makeRoll({ labOrderId: "540996" })).labOrderId).toBe("540996");
  });
});
