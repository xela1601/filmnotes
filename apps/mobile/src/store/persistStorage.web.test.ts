import { persistStorage } from "./persistStorage.web";

describe("web persist storage", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => store.get(key) ?? null,
          setItem: (key: string, value: string) => void store.set(key, value),
          removeItem: (key: string) => void store.delete(key),
        },
      },
    });
  });

  it("round trips a value through localStorage", () => {
    persistStorage.setItem("filmnotes-v1", '{"a":1}');
    expect(persistStorage.getItem("filmnotes-v1")).toBe('{"a":1}');
    persistStorage.removeItem("filmnotes-v1");
    expect(persistStorage.getItem("filmnotes-v1")).toBeNull();
  });

  it("reads an unwritten key as null", () => {
    expect(persistStorage.getItem("missing")).toBeNull();
  });

  it("survives a localStorage that throws (private mode, blocked site data)", () => {
    const throwing = () => {
      throw new Error("access denied");
    };
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: { getItem: throwing, setItem: throwing, removeItem: throwing } },
    });

    expect(() => persistStorage.setItem("k", "v")).not.toThrow();
    expect(() => persistStorage.removeItem("k")).not.toThrow();
    expect(persistStorage.getItem("k")).toBeNull();
  });
});
