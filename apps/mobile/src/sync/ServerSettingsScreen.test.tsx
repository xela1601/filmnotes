import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { FakeSyncClient } from "./fakeClient";
import { ServerSettingsScreen } from "./ServerSettingsScreen";
import { i18n } from "../i18n";
import type { SecretKey } from "../lib/secureStore";
import { useStore } from "../store/store";
import { makeRoll } from "../testing/fixtures";

const OWNER = "user00000000001";
const EMAIL = "me@example.test";
const URL = "https://pb.test";

const mockCreateClient = jest.fn<FakeSyncClient, [string]>();
const mockGetSecret = jest.fn<Promise<string | null>, [SecretKey]>();
const mockSetSecret = jest.fn<Promise<void>, [SecretKey, string | null]>();

// Lazy arrow bodies: the factories run during the import of the screen, before the
// consts above are initialised.
jest.mock("./client", () => ({
  createPocketBaseClient: (baseUrl: string) => mockCreateClient(baseUrl),
}));
jest.mock("../lib/secureStore", () => ({
  getSecret: (key: string) => mockGetSecret(key as SecretKey),
  setSecret: (key: string, value: string | null) => mockSetSecret(key as SecretKey, value),
}));

function fakeClient(): FakeSyncClient {
  const client = new FakeSyncClient({
    serverNow: "2026-09-18T12:00:00.000Z",
    users: { [EMAIL]: { password: "secret", userId: OWNER } },
  });
  mockCreateClient.mockReturnValue(client);
  return client;
}

describe("ServerSettingsScreen", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    useStore.getState().resetAll();
    mockGetSecret.mockResolvedValue(null);
    mockSetSecret.mockResolvedValue(undefined);
    await i18n.changeLanguage("de");
  });

  it("shows the url, email and password fields and no connection yet", () => {
    render(<ServerSettingsScreen />);

    expect(screen.getByTestId("sync-url")).toBeOnTheScreen();
    expect(screen.getByTestId("sync-email")).toBeOnTheScreen();
    expect(screen.getByTestId("sync-password")).toBeOnTheScreen();
    expect(screen.getByTestId("sync-connect")).toBeOnTheScreen();
    expect(screen.queryByTestId("sync-now")).toBeNull();
    expect(screen.getByText(i18n.t("sync:notConnected"))).toBeOnTheScreen();
  });

  it("connects, stores url, email and token and reports who is connected", async () => {
    const client = fakeClient();
    render(<ServerSettingsScreen />);

    fireEvent.changeText(screen.getByTestId("sync-url"), URL);
    fireEvent.changeText(screen.getByTestId("sync-email"), EMAIL);
    fireEvent.changeText(screen.getByTestId("sync-password"), "secret");
    fireEvent.press(screen.getByTestId("sync-connect"));

    await waitFor(() => {
      expect(screen.getByTestId("sync-connected")).toHaveTextContent(
        i18n.t("sync:connectedAs", { email: EMAIL }),
      );
    });

    expect(mockCreateClient).toHaveBeenCalledWith(URL);
    expect(mockSetSecret).toHaveBeenCalledWith("serverToken", `token-${OWNER}`);
    expect(mockSetSecret).toHaveBeenCalledWith("serverPassword", "secret");
    expect(useStore.getState().settings).toMatchObject({ serverUrl: URL, serverEmail: EMAIL });
    expect(client.tokens.get(`token-${OWNER}`)).toBe(OWNER);
  });

  it("refuses to connect with an incomplete form", async () => {
    fakeClient();
    render(<ServerSettingsScreen />);

    fireEvent.changeText(screen.getByTestId("sync-url"), URL);
    fireEvent.press(screen.getByTestId("sync-connect"));

    await waitFor(() => {
      expect(screen.getByTestId("sync-error")).toHaveTextContent(i18n.t("sync:missingFields"));
    });
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(useStore.getState().settings.serverUrl).toBeNull();
  });

  it("shows an error when the login is rejected", async () => {
    fakeClient();
    render(<ServerSettingsScreen />);

    fireEvent.changeText(screen.getByTestId("sync-url"), URL);
    fireEvent.changeText(screen.getByTestId("sync-email"), EMAIL);
    fireEvent.changeText(screen.getByTestId("sync-password"), "wrong");
    fireEvent.press(screen.getByTestId("sync-connect"));

    await waitFor(() => {
      expect(screen.getByTestId("sync-error")).toHaveTextContent(i18n.t("sync:connectFailed"));
    });
    expect(useStore.getState().settings.serverUrl).toBeNull();
  });

  it("disconnects, clearing the settings, the secrets and the sync watermark", async () => {
    fakeClient();
    useStore.getState().updateSettings({ serverUrl: URL, serverEmail: EMAIL });
    useStore.getState().setLastSyncAt("2026-09-18T11:00:00.000Z");

    render(<ServerSettingsScreen />);
    fireEvent.press(screen.getByTestId("sync-disconnect"));

    await waitFor(() => {
      expect(useStore.getState().settings.serverUrl).toBeNull();
    });
    expect(useStore.getState().settings.serverEmail).toBeNull();
    expect(useStore.getState().lastSyncAt).toBeNull();
    expect(mockSetSecret).toHaveBeenCalledWith("serverToken", null);
    expect(mockSetSecret).toHaveBeenCalledWith("serverPassword", null);
    expect(screen.getByText(i18n.t("sync:notConnected"))).toBeOnTheScreen();
  });

  it("shows the last sync time of a configured server", () => {
    useStore.getState().updateSettings({ serverUrl: URL, serverEmail: EMAIL });
    useStore.getState().setLastSyncAt("2026-09-18T11:00:00.000Z");

    render(<ServerSettingsScreen />);

    expect(screen.getByTestId("sync-last")).toHaveTextContent(/^Zuletzt: \d/);
  });

  it('shows "never" while nothing has been synced yet', () => {
    useStore.getState().updateSettings({ serverUrl: URL, serverEmail: EMAIL });

    render(<ServerSettingsScreen />);

    expect(screen.getByTestId("sync-last")).toHaveTextContent(
      i18n.t("sync:lastSync", { time: i18n.t("sync:never") }),
    );
  });

  it("runs a manual sync and summarises pushed and pulled records", async () => {
    const client = fakeClient();
    useStore.getState().updateSettings({ serverUrl: URL, serverEmail: EMAIL });
    mockGetSecret.mockImplementation(async (key) =>
      key === "serverToken" ? `token-${OWNER}` : null,
    );
    client.tokens.set(`token-${OWNER}`, OWNER);
    useStore.getState().upsert("rolls", makeRoll({ notes: "offline" }));

    render(<ServerSettingsScreen />);
    fireEvent.press(screen.getByTestId("sync-now"));

    await waitFor(() => {
      expect(screen.getByTestId("sync-result")).toHaveTextContent(
        i18n.t("sync:result", { pushed: 1, pulled: 0 }),
      );
    });
    expect(client.record("rolls", "roll00000000001")?.notes).toBe("offline");
  });
});
