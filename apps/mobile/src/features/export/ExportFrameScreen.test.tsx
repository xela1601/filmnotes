import type { SharePayload } from "@filmnotes/exporters";
import { basicAuthHeader } from "@filmnotes/exporters";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import { ExportFrameScreen } from "./ExportFrameScreen";
import { i18n } from "../../i18n";
import type { SecretKey } from "../../lib/secureStore";
import { useStore } from "../../store/store";
import { FIXTURE_NOW, makeFrame, makeRoll, makeScan } from "../../testing/fixtures";

const FRAME_ID = "frame0000000001";
const ROLL_ID = "roll00000000001";
const SITE = "https://blog.example.test";
const USER = "ansel";
const PASSWORD = "app-password";

const mockShareOut = jest.fn<Promise<void>, [SharePayload]>();
const mockGetSecret = jest.fn<Promise<string | null>, [SecretKey]>();
const mockFileUrl = jest.fn(
  (collection: string, id: string, fileName: string, thumb?: string): string =>
    `https://pb.test/api/files/${collection}/${id}/${fileName}${
      thumb === undefined ? "" : `?thumb=${thumb}`
    }`,
);

// Every factory body stays lazy: it runs while the screen is imported, before the consts
// above are initialised.
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));
jest.mock("./shareOut", () => ({
  shareOut: (payload: SharePayload) => mockShareOut(payload),
}));
jest.mock("../../lib/secureStore", () => ({
  getSecret: (key: string) => mockGetSecret(key as SecretKey),
  setSecret: () => Promise.resolve(),
}));
// The PocketBase SDK is ESM-only and not transformed by jest-expo, so the client is replaced
// by the one method an image load uses.
jest.mock("../../sync/client", () => ({
  createPocketBaseClient: () => ({ fileUrl: mockFileUrl }),
}));

const realFetch = globalThis.fetch;

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

/** A `fetch` that answers per url substring and records every request. */
function mockFetch(answers: { match: string; status?: number; body?: unknown }[]): FetchCall[] {
  const calls: FetchCall[] = [];
  const mock = (url: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url, init });
    const answer = answers.find((candidate) => url.includes(candidate.match));
    const status = answer?.status ?? (answer === undefined ? 404 : 200);
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: () => "image/jpeg" },
      json: () => Promise.resolve(answer?.body ?? {}),
      text: () => Promise.resolve(JSON.stringify(answer?.body ?? {})),
      arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3]).buffer),
    } as unknown as Response);
  };
  globalThis.fetch = mock as unknown as typeof fetch;
  return calls;
}

/** Roll and frame of the happy path; equipment and film stock come from the presets. */
function seedFrame(): void {
  const { upsert, seedPresets } = useStore.getState();
  seedPresets(FIXTURE_NOW);
  upsert("rolls", makeRoll({ id: ROLL_ID }));
  upsert("frames", makeFrame({ id: FRAME_ID, rollId: ROLL_ID, notes: "Harbour crane" }));
}

function configureWordPress(): void {
  useStore.getState().updateSettings({ wordpressSiteUrl: SITE, wordpressUsername: USER });
}

describe("ExportFrameScreen", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    useStore.getState().resetAll();
    mockShareOut.mockResolvedValue(undefined);
    mockGetSecret.mockResolvedValue(PASSWORD);
    await i18n.changeLanguage("de");
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("offers the share package and the WordPress draft as targets", () => {
    seedFrame();

    render(<ExportFrameScreen frameId={FRAME_ID} />);

    expect(screen.getByTestId("export-target-share")).toHaveTextContent(
      i18n.t("export:exporters.share"),
    );
    expect(screen.getByTestId("export-target-wordpress")).toHaveTextContent(
      i18n.t("export:exporters.wordpress"),
    );
  });

  it("disables WordPress with a hint while it is not set up", () => {
    seedFrame();

    render(<ExportFrameScreen frameId={FRAME_ID} />);

    expect(screen.getByTestId("export-target-wordpress")).toBeDisabled();
    expect(screen.getByText(i18n.t("export:notConfigured"))).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId("export-configure-wordpress"));
    expect(router.push).toHaveBeenCalledWith("/settings/wordpress");
  });

  it("enables WordPress once site url and user name are stored", () => {
    seedFrame();
    configureWordPress();

    render(<ExportFrameScreen frameId={FRAME_ID} />);

    expect(screen.getByTestId("export-target-wordpress")).not.toBeDisabled();
    expect(screen.queryByText(i18n.t("export:notConfigured"))).toBeNull();
  });

  it("previews the caption built from the frame and lets it be edited", () => {
    seedFrame();

    render(<ExportFrameScreen frameId={FRAME_ID} />);

    const caption = screen.getByTestId("export-caption");
    expect(caption).toHaveProp("value", expect.stringContaining("Kodak Gold 200"));
    expect(caption).toHaveProp("value", expect.stringContaining("Harbour crane"));

    fireEvent.changeText(caption, "Only this line");
    expect(screen.getByTestId("export-caption")).toHaveProp("value", "Only this line");
  });

  it("shares caption and image, and notes that the frame has no scan", async () => {
    seedFrame();

    render(<ExportFrameScreen frameId={FRAME_ID} />);
    expect(screen.getByText(i18n.t("export:noImage"))).toBeOnTheScreen();

    fireEvent.changeText(screen.getByTestId("export-caption"), "Caption for the share sheet");
    fireEvent.press(screen.getByTestId("export-run"));

    await waitFor(() => {
      expect(mockShareOut).toHaveBeenCalledWith({
        text: "Caption for the share sheet",
        image: null,
      });
    });
    expect(screen.getByTestId("export-message")).toHaveTextContent(i18n.t("export:shared"));
  });

  it("loads the 1600 px thumbnail of the uploaded scan for the share package", async () => {
    seedFrame();
    useStore.getState().updateSettings({ serverUrl: "https://pb.test" });
    useStore.getState().upsert(
      "scans",
      makeScan({
        rollId: ROLL_ID,
        frameId: FRAME_ID,
        fileName: "img001.jpg",
        file: "img001_x.jpg",
      }),
    );
    const calls = mockFetch([{ match: "/api/files/", body: {} }]);

    render(<ExportFrameScreen frameId={FRAME_ID} />);
    expect(
      screen.getByText(i18n.t("export:withImage", { fileName: "img001.jpg" })),
    ).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId("export-run"));

    await waitFor(() => {
      expect(mockShareOut).toHaveBeenCalled();
    });
    expect(mockFileUrl).toHaveBeenCalledWith("scans", "scan00000000001", "img001_x.jpg", "1600x0");
    expect(calls[0]?.url).toContain("thumb=1600x0");
    const payload = mockShareOut.mock.calls[0]?.[0];
    expect(payload?.image?.fileName).toBe("img001.jpg");
    expect(Array.from(payload?.image?.bytes ?? [])).toEqual([1, 2, 3]);
  });

  it("creates a WordPress draft with the stored credentials and shows the link", async () => {
    seedFrame();
    configureWordPress();
    const calls = mockFetch([
      { match: "/wp/v2/posts", body: { id: 4711, link: `${SITE}/?p=4711` } },
    ]);

    render(<ExportFrameScreen frameId={FRAME_ID} />);
    fireEvent.press(screen.getByTestId("export-target-wordpress"));
    fireEvent.press(screen.getByTestId("export-run"));

    await waitFor(() => {
      expect(screen.getByTestId("export-open-post")).toBeOnTheScreen();
    });

    expect(calls[0]?.url).toBe(`${SITE}/wp-json/wp/v2/posts`);
    expect(calls[0]?.init?.headers).toMatchObject({
      Authorization: basicAuthHeader(USER, PASSWORD),
    });
    expect(mockGetSecret).toHaveBeenCalledWith("wordpressAppPassword");

    const logs = Object.values(useStore.getState().entities.exportLogs);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      frameId: FRAME_ID,
      target: "wordpress",
      externalId: "4711",
      url: `${SITE}/?p=4711`,
    });
  });

  it("shows the message of a failed export and writes no log", async () => {
    seedFrame();
    configureWordPress();
    mockFetch([
      { match: "/wp/v2/posts", status: 403, body: { message: "Sorry, you are not allowed." } },
    ]);

    render(<ExportFrameScreen frameId={FRAME_ID} />);
    fireEvent.press(screen.getByTestId("export-target-wordpress"));
    fireEvent.press(screen.getByTestId("export-run"));

    await waitFor(() => {
      expect(screen.getByTestId("export-error")).toHaveTextContent(/Sorry, you are not allowed\./);
    });
    expect(Object.values(useStore.getState().entities.exportLogs)).toHaveLength(0);
  });

  it("lists the previous exports of the frame", () => {
    seedFrame();
    useStore.getState().upsert("exportLogs", {
      id: "explog000000001",
      created: FIXTURE_NOW,
      updated: FIXTURE_NOW,
      deleted: null,
      owner: null,
      frameId: FRAME_ID,
      target: "wordpress",
      externalId: "4711",
      url: `${SITE}/?p=4711`,
      exportedAt: FIXTURE_NOW,
    });

    render(<ExportFrameScreen frameId={FRAME_ID} />);

    expect(screen.getByTestId("export-log-explog000000001")).toHaveTextContent(
      new RegExp(i18n.t("export:exporters.wordpress")),
    );
    expect(screen.queryByText(i18n.t("export:noPrevious"))).toBeNull();
  });

  it("says so when the frame has never been exported", () => {
    seedFrame();

    render(<ExportFrameScreen frameId={FRAME_ID} />);

    expect(screen.getByText(i18n.t("export:noPrevious"))).toBeOnTheScreen();
  });

  it("refuses to export a frame whose roll is unknown", () => {
    useStore.getState().upsert("frames", makeFrame({ id: FRAME_ID, rollId: "roll00000000404" }));

    render(<ExportFrameScreen frameId={FRAME_ID} />);

    expect(screen.getByText(i18n.t("export:captionMissing"))).toBeOnTheScreen();
    expect(screen.getByTestId("export-run")).toBeDisabled();
  });

  it("shows a hint when the frame does not exist", () => {
    render(<ExportFrameScreen frameId="frame0000000404" />);

    expect(screen.getByText(i18n.t("export:frameNotFound"))).toBeOnTheScreen();
  });
});
