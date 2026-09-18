import { ArgumentError, parseArgs } from "./args";

const BASE = [
  "--server",
  "https://pb.example.com",
  "--email",
  "me@example.com",
  "--roll",
  "roll100000000000",
];

describe("parseArgs", () => {
  it("reads every flag plus the source argument", () => {
    expect(
      parseArgs([...BASE, "--password", "secret", "--yes", "--dry-run", "/scans/roll-42"], {}),
    ).toEqual({
      server: "https://pb.example.com",
      email: "me@example.com",
      password: "secret",
      roll: "roll100000000000",
      source: "/scans/roll-42",
      yes: true,
      dryRun: true,
      json: false,
    });
  });

  it("defaults yes and dryRun to false and leaves the password undefined", () => {
    const args = parseArgs([...BASE, "/scans/roll-42"], {});
    expect(args.yes).toBe(false);
    expect(args.dryRun).toBe(false);
    expect(args.password).toBeUndefined();
  });

  it("accepts --flag=value as well as --flag value", () => {
    const args = parseArgs(
      [
        "--server=https://pb.example.com",
        "--email=me@example.com",
        "--roll=roll100000000000",
        "scans.zip",
      ],
      {},
    );
    expect(args.server).toBe("https://pb.example.com");
    expect(args.email).toBe("me@example.com");
    expect(args.roll).toBe("roll100000000000");
    expect(args.source).toBe("scans.zip");
  });

  it("accepts -y as a short form of --yes", () => {
    expect(parseArgs([...BASE, "-y", "scans.zip"], {}).yes).toBe(true);
  });

  it("takes the password from FILMNOTES_PASSWORD when the flag is missing", () => {
    expect(parseArgs([...BASE, "scans.zip"], { FILMNOTES_PASSWORD: "from-env" }).password).toBe(
      "from-env",
    );
  });

  it("prefers the flag over the environment", () => {
    expect(
      parseArgs([...BASE, "--password", "from-flag", "scans.zip"], {
        FILMNOTES_PASSWORD: "from-env",
      }).password,
    ).toBe("from-flag");
  });

  it("ignores an empty FILMNOTES_PASSWORD", () => {
    expect(parseArgs([...BASE, "scans.zip"], { FILMNOTES_PASSWORD: "" }).password).toBeUndefined();
  });

  it("rejects a missing --roll", () => {
    const argv = ["--server", "https://pb.example.com", "--email", "me@example.com", "scans.zip"];
    expect(() => parseArgs(argv, {})).toThrow(ArgumentError);
    expect(() => parseArgs(argv, {})).toThrow(/--roll/);
  });

  it("rejects a missing source", () => {
    expect(() => parseArgs([...BASE], {})).toThrow(/source/);
  });

  it("rejects a second source", () => {
    expect(() => parseArgs([...BASE, "a.zip", "b.zip"], {})).toThrow(/one/);
  });

  it("rejects a missing --server and a missing --email", () => {
    expect(() => parseArgs(["--email", "me@example.com", "--roll", "r", "a.zip"], {})).toThrow(
      /--server/,
    );
    expect(() => parseArgs(["--server", "https://pb", "--roll", "r", "a.zip"], {})).toThrow(
      /--email/,
    );
  });

  it("rejects an unknown flag", () => {
    expect(() => parseArgs([...BASE, "--frames", "3", "a.zip"], {})).toThrow(/--frames/);
  });

  it("rejects a flag without a value", () => {
    expect(() => parseArgs(["--server", "https://pb", "--email"], {})).toThrow(/--email/);
  });
});

describe("parseArgs with a credentials file loaded into the environment", () => {
  const ENV = {
    FILMNOTES_SERVER_URL: "https://pb.example.com",
    FILMNOTES_EMAIL: "me@example.com",
    FILMNOTES_PASSWORD: "from-env",
  };

  it("takes server, email and password from the environment", () => {
    expect(parseArgs(["--roll", "roll100000000000", "/scans/roll-42"], ENV)).toEqual({
      server: "https://pb.example.com",
      email: "me@example.com",
      password: "from-env",
      roll: "roll100000000000",
      source: "/scans/roll-42",
      yes: false,
      dryRun: false,
      json: false,
    });
  });

  it("lets an explicit flag win over the environment", () => {
    const args = parseArgs(
      ["--server", "http://127.0.0.1:8090", "--roll", "roll100000000000", "/scans"],
      ENV,
    );

    expect(args.server).toBe("http://127.0.0.1:8090");
    expect(args.email).toBe("me@example.com");
  });

  it("still reports the missing option when neither flag nor environment has it", () => {
    expect(() => parseArgs(["--roll", "roll100000000000", "/scans"], {})).toThrow(
      /--server is required/,
    );
    expect(() =>
      parseArgs(["--server", "https://pb.example.com", "--roll", "roll100000000000", "/scans"], {}),
    ).toThrow(/--email is required/);
  });

  it("ignores an empty environment value", () => {
    expect(() =>
      parseArgs(["--roll", "roll100000000000", "/scans"], { FILMNOTES_SERVER_URL: "" }),
    ).toThrow(/--server is required/);
  });
});

describe("parseArgs --json", () => {
  it("is off unless asked for", () => {
    expect(parseArgs([...BASE, "/scans"], {}).json).toBe(false);
    expect(parseArgs([...BASE, "--json", "/scans"], {}).json).toBe(true);
  });
});
