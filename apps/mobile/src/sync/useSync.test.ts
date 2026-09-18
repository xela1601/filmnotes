import { act, renderHook } from "@testing-library/react-native";
import { AppState as RNAppState, type AppStateStatus } from "react-native";

import { FakeSyncClient } from "./fakeClient";
import { AUTO_SYNC_INTERVAL_MS, resetSyncSchedule, useSync } from "./useSync";
import type { SecretKey } from "../lib/secureStore";
import { useStore } from "../store/store";
import { makeRoll } from "../testing/fixtures";

const OWNER = "user00000000001";
const TOKEN = `token-${OWNER}`;

const mockCreateClient = jest.fn<FakeSyncClient, [string]>();
const mockGetSecret = jest.fn<Promise<string | null>, [SecretKey]>();
const mockSetSecret = jest.fn<Promise<void>, [SecretKey, string | null]>();

// The arrow bodies keep the `mock*` references lazy: the factories run while the module
// under test is imported, which is before the consts above are initialised.
jest.mock("./client", () => ({
  createPocketBaseClient: (baseUrl: string) => mockCreateClient(baseUrl),
}));
jest.mock("../lib/secureStore", () => ({
  getSecret: (key: string) => mockGetSecret(key as SecretKey),
  setSecret: (key: string, value: string | null) => mockSetSecret(key as SecretKey, value),
}));

/** Takes over the AppState listener `useSync` registers. */
function captureForegroundListener(): { fire: (state: AppStateStatus) => void } {
  const handlers: ((state: AppStateStatus) => void)[] = [];
  jest
    .spyOn(RNAppState, "addEventListener")
    .mockImplementation((_type, handler: (state: AppStateStatus) => void) => {
      handlers.push(handler);
      return { remove: () => undefined };
    });
  return {
    fire: (state) => {
      for (const handler of handlers) handler(state);
    },
  };
}

function configureServer(): FakeSyncClient {
  const client = new FakeSyncClient({ serverNow: "2026-09-18T12:00:00.000Z" });
  client.tokens.set(TOKEN, OWNER);
  mockCreateClient.mockReturnValue(client);
  useStore.getState().updateSettings({
    serverUrl: "https://pb.test",
    serverEmail: "me@example.test",
  });
  return client;
}

describe("useSync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    resetSyncSchedule();
    useStore.getState().resetAll();
    mockGetSecret.mockResolvedValue(null);
    mockSetSecret.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("reports no_server while no server URL is configured", () => {
    const { result } = renderHook(() => useSync());

    expect(result.current.status).toBe("no_server");
    expect(result.current.isConfigured).toBe(false);
    expect(result.current.lastResult).toBeNull();
  });

  it("does nothing when syncNow is called without a server", async () => {
    const { result } = renderHook(() => useSync());

    await act(async () => {
      await result.current.syncNow();
    });

    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(result.current.status).toBe("no_server");
  });

  it("syncs with the token from secure storage and keeps the result", async () => {
    const client = configureServer();
    mockGetSecret.mockImplementation(async (key) => (key === "serverToken" ? TOKEN : null));
    // Not the first sync of this installation: a first one would also upload the seeded
    // equipment, which has its own tests in engine.test.ts.
    useStore.getState().setLastSyncAt("2026-09-18T09:00:00.000Z");
    useStore.getState().upsert("rolls", makeRoll({ notes: "offline" }));

    const { result } = renderHook(() => useSync());
    expect(result.current.isConfigured).toBe(true);

    await act(async () => {
      await result.current.syncNow();
    });

    expect(mockCreateClient).toHaveBeenCalledWith("https://pb.test");
    expect(mockGetSecret).toHaveBeenCalledWith("serverToken");
    expect(result.current.status).toBe("idle");
    expect(result.current.lastResult).toMatchObject({ pushed: 1, errors: [] });
    expect(client.record("rolls", "roll00000000001")?.notes).toBe("offline");
    expect(useStore.getState().outbox).toEqual([]);
    expect(useStore.getState().lastSyncAt).not.toBeNull();
  });

  it("logs in with the stored password when there is no valid token and saves the new one", async () => {
    const client = new FakeSyncClient({
      users: { "me@example.test": { password: "secret", userId: OWNER } },
    });
    mockCreateClient.mockReturnValue(client);
    useStore.getState().updateSettings({
      serverUrl: "https://pb.test",
      serverEmail: "me@example.test",
    });
    mockGetSecret.mockImplementation(async (key) => (key === "serverPassword" ? "secret" : null));

    const { result } = renderHook(() => useSync());
    await act(async () => {
      await result.current.syncNow();
    });

    expect(mockSetSecret).toHaveBeenCalledWith("serverToken", `token-${OWNER}`);
    expect(result.current.status).toBe("idle");
  });

  it("reports an error when there are no usable credentials", async () => {
    configureServer();

    const { result } = renderHook(() => useSync());
    await act(async () => {
      await result.current.syncNow();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.lastResult?.errors).toHaveLength(1);
    expect(useStore.getState().lastSyncAt).toBeNull();
  });

  it("reports an error when a collection cannot be listed", async () => {
    const client = configureServer();
    client.failingLists.add("frames");
    mockGetSecret.mockImplementation(async (key) => (key === "serverToken" ? TOKEN : null));

    const { result } = renderHook(() => useSync());
    await act(async () => {
      await result.current.syncNow();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.lastResult?.errors).toHaveLength(1);
  });

  it("syncs on foreground at most once per minute", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-09-18T12:00:00.000Z"));
    const foreground = captureForegroundListener();
    configureServer();
    mockGetSecret.mockImplementation(async (key) => (key === "serverToken" ? TOKEN : null));

    renderHook(() => useSync());

    await act(async () => {
      foreground.fire("active");
    });
    expect(mockCreateClient).toHaveBeenCalledTimes(1);

    // Second foreground within the interval: skipped.
    await act(async () => {
      foreground.fire("active");
    });
    expect(mockCreateClient).toHaveBeenCalledTimes(1);

    jest.setSystemTime(new Date(Date.now() + AUTO_SYNC_INTERVAL_MS + 1_000));
    await act(async () => {
      foreground.fire("active");
    });
    expect(mockCreateClient).toHaveBeenCalledTimes(2);
  });

  it("ignores background and inactive state changes", async () => {
    const foreground = captureForegroundListener();
    configureServer();

    renderHook(() => useSync());

    await act(async () => {
      foreground.fire("background");
      foreground.fire("inactive");
    });

    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("runs once even when several screens mount the hook", async () => {
    // The root layout mounts it for the foreground sync while the server settings screen
    // mounts it for its button; per-instance guards would push the outbox twice.
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-09-18T12:00:00.000Z"));
    const foreground = captureForegroundListener();
    configureServer();
    mockGetSecret.mockImplementation(async (key) => (key === "serverToken" ? TOKEN : null));

    renderHook(() => useSync());
    renderHook(() => useSync());

    await act(async () => {
      foreground.fire("active");
    });

    expect(mockCreateClient).toHaveBeenCalledTimes(1);
  });

  it("does not register a foreground listener without a server", () => {
    const addEventListener = jest.spyOn(RNAppState, "addEventListener");

    renderHook(() => useSync());

    expect(addEventListener).not.toHaveBeenCalled();
  });
});
