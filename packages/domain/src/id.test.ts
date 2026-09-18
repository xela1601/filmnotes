import { newId, ID_PATTERN } from "./id";

describe("newId", () => {
  it("returns 15 lowercase alphanumeric characters (PocketBase id format)", () => {
    const id = newId();
    expect(id).toMatch(ID_PATTERN);
    expect(id).toHaveLength(15);
  });

  it("is unique across many calls", () => {
    const ids = new Set(Array.from({ length: 5000 }, () => newId()));
    expect(ids.size).toBe(5000);
  });
});

describe("newId distribution", () => {
  it("uses the whole alphabet about evenly", () => {
    // `byte % 36` handed out a-d roughly 14 % more often than the rest; with 30 000 characters
    // that skew is far outside the tolerance below, uniform sampling is well inside it.
    const counts = new Map<string, number>();
    for (let index = 0; index < 2000; index += 1) {
      for (const character of newId()) counts.set(character, (counts.get(character) ?? 0) + 1);
    }

    const expected = (2000 * 15) / 36;
    for (const [character, count] of counts) {
      expect(count / expected).toBeGreaterThan(0.85);
      expect(count / expected).toBeLessThan(1.15);
      expect(character).toMatch(/[a-z0-9]/);
    }
    expect(counts.size).toBe(36);
  });
});
