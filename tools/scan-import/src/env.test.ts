import { ENV_FILE_VAR, loadCredentialsFile } from "./env";

describe("loadCredentialsFile", () => {
  const loaded: string[] = [];
  const load = (path: string): void => {
    loaded.push(path);
  };

  beforeEach(() => {
    loaded.length = 0;
  });

  it("loads the file FILMNOTES_ENV_FILE points at", () => {
    const path = loadCredentialsFile({
      env: { [ENV_FILE_VAR]: "/home/me/.config/filmnotes/env" },
      exists: (candidate) => candidate === "/home/me/.config/filmnotes/env",
      load,
      defaultPaths: ["/repo/.env"],
    });

    expect(path).toBe("/home/me/.config/filmnotes/env");
    expect(loaded).toEqual(["/home/me/.config/filmnotes/env"]);
  });

  it("refuses to fall back when FILMNOTES_ENV_FILE is wrong", () => {
    expect(() =>
      loadCredentialsFile({
        env: { [ENV_FILE_VAR]: "/typo/env" },
        exists: () => false,
        load,
        defaultPaths: ["/repo/.env"],
      }),
    ).toThrow(/does not exist/);
    expect(loaded).toEqual([]);
  });

  it("takes the first default path that exists", () => {
    const path = loadCredentialsFile({
      env: {},
      exists: (candidate) => candidate === "/cwd/.env",
      load,
      defaultPaths: ["/repo/.env", "/cwd/.env"],
    });

    expect(path).toBe("/cwd/.env");
    expect(loaded).toEqual(["/cwd/.env"]);
  });

  it("reports no file rather than failing when there is none", () => {
    expect(
      loadCredentialsFile({ env: {}, exists: () => false, load, defaultPaths: ["/repo/.env"] }),
    ).toBeNull();
    expect(loaded).toEqual([]);
  });

  it("ignores an empty FILMNOTES_ENV_FILE", () => {
    const path = loadCredentialsFile({
      env: { [ENV_FILE_VAR]: "" },
      exists: (candidate) => candidate === "/repo/.env",
      load,
      defaultPaths: ["/repo/.env"],
    });

    expect(path).toBe("/repo/.env");
  });
});
