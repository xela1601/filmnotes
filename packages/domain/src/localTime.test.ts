import { formatLocalDate, instantFromLocal, localParts } from "./localTime";

const MUNICH = "Europe/Berlin";
const AUCKLAND = "Pacific/Auckland";

describe("localParts", () => {
  it("puts a late-evening shot on the local day, not on the UTC one", () => {
    // 19 September, 00:30 in Munich - the UTC string says the 18th.
    expect(localParts("2026-09-18T22:30:00.000Z", MUNICH)).toEqual({
      date: "2026-09-19",
      time: "00:30",
    });
  });

  it("uses winter time in winter", () => {
    expect(localParts("2026-01-15T22:30:00.000Z", MUNICH)).toEqual({
      date: "2026-01-15",
      time: "23:30",
    });
  });

  it("handles a zone ahead of the date line", () => {
    expect(localParts("2026-09-18T22:30:00.000Z", AUCKLAND)).toEqual({
      date: "2026-09-19",
      time: "10:30",
    });
  });

  it("reports null for nothing and for a broken timestamp", () => {
    expect(localParts(null, MUNICH)).toBeNull();
    expect(localParts("not a date", MUNICH)).toBeNull();
  });
});

describe("instantFromLocal", () => {
  it("round-trips a local wall clock through the stored instant", () => {
    const instant = instantFromLocal("2026-09-19", "00:30", MUNICH);

    expect(instant).toBe("2026-09-18T22:30:00.000Z");
    expect(localParts(instant, MUNICH)).toEqual({ date: "2026-09-19", time: "00:30" });
  });

  it("round-trips across both DST switches", () => {
    // 2026: Europe/Berlin springs forward on 29 March and falls back on 25 October.
    for (const date of ["2026-03-28", "2026-03-29", "2026-03-30", "2026-10-25", "2026-10-26"]) {
      const instant = instantFromLocal(date, "12:00", MUNICH);
      expect(localParts(instant, MUNICH)).toEqual({ date, time: "12:00" });
    }
  });

  it("rejects a date that does not exist instead of rolling it over", () => {
    // Date.UTC turns 2026-13-45 into 2027-02-14; that silently stored the wrong day.
    expect(instantFromLocal("2026-13-45", "10:00", MUNICH)).toBeNull();
    expect(instantFromLocal("2026-02-31", "10:00", MUNICH)).toBeNull();
    expect(instantFromLocal("2026-00-10", "10:00", MUNICH)).toBeNull();
  });

  it("rejects an incomplete or impossible clock instead of falling back to midnight", () => {
    // "9:5" is a typo for "09:50" and used to be read as 00:00.
    expect(instantFromLocal("2026-09-19", "9:5", MUNICH)).toBeNull();
    expect(instantFromLocal("2026-09-19", "", MUNICH)).toBeNull();
    expect(instantFromLocal("2026-09-19", "25:00", MUNICH)).toBeNull();
    expect(instantFromLocal("2026-09-19", "10:61", MUNICH)).toBeNull();
  });

  it("accepts a single-digit-free, zero-padded field only", () => {
    expect(instantFromLocal("2026-9-19", "10:00", MUNICH)).toBeNull();
    expect(instantFromLocal(" 2026-09-19 ", " 10:00 ", MUNICH)).toBe("2026-09-19T08:00:00.000Z");
  });
});

describe("formatLocalDate", () => {
  it("writes the local day in the locale's order", () => {
    expect(formatLocalDate("2026-09-18T22:30:00.000Z", "de", MUNICH)).toBe("19.09.2026");
    expect(formatLocalDate("2026-09-18T22:30:00.000Z", "en", MUNICH)).toBe("2026-09-19");
  });

  it("is empty without a timestamp", () => {
    expect(formatLocalDate(null, "de", MUNICH)).toBe("");
  });
});
