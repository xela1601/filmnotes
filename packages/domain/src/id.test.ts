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
