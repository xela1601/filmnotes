import { getSecret, setSecret } from "./secureStore.web";

describe("secureStore (web)", () => {
  const map = new Map<string, string>();

  beforeAll(() => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => map.get(key) ?? null,
        setItem: (key: string, value: string) => {
          map.set(key, value);
        },
        removeItem: (key: string) => {
          map.delete(key);
        },
      },
    });
  });

  beforeEach(() => {
    map.clear();
  });

  it("returns null for an unknown secret", async () => {
    await expect(getSecret("serverToken")).resolves.toBeNull();
  });

  it("round-trips a secret under a namespaced key", async () => {
    await setSecret("serverToken", "abc");

    expect(map.get("filmnotes.secret.serverToken")).toBe("abc");
    await expect(getSecret("serverToken")).resolves.toBe("abc");
  });

  it("removes a secret when set to null", async () => {
    await setSecret("wordpressAppPassword", "secret");
    await setSecret("wordpressAppPassword", null);

    await expect(getSecret("wordpressAppPassword")).resolves.toBeNull();
  });
});
