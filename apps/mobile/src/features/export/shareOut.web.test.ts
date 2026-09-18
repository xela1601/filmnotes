/**
 * @jest-environment jsdom
 *
 * The web share path talks to `navigator`, the clipboard and a download link, so this one file
 * needs a DOM; the rest of the app suite runs in the node environment jest-expo sets up.
 */
import { TextDecoder, TextEncoder } from "node:util";

import type { SharePayload } from "@filmnotes/exporters";
import * as Clipboard from "expo-clipboard";

import { shareOut } from "./shareOut.web";

// jsdom does not bring the text encoders that react-native-web's polyfills expect.
Object.assign(globalThis, { TextEncoder, TextDecoder });

jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(() => Promise.resolve(true)) }));

const setStringAsync = Clipboard.setStringAsync as jest.Mock;

const IMAGE = {
  bytes: new Uint8Array([1, 2, 3]),
  mimeType: "image/jpeg",
  fileName: "img001.jpg",
};

function payload(overrides: Partial<SharePayload> = {}): SharePayload {
  return { text: "Kodak Gold 200", image: IMAGE, ...overrides };
}

/** Installs a Web Share API whose `share` behaves as the test wants. */
function withShare(share: jest.Mock): void {
  Object.defineProperty(navigator, "share", { configurable: true, value: share });
  Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
}

function withoutShare(): void {
  Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  Object.defineProperty(navigator, "canShare", { configurable: true, value: undefined });
}

describe("shareOut (web)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // jsdom has no object URLs and no real downloads.
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: () => "blob:x" });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: () => undefined });
  });

  it("uses the share sheet where there is one", async () => {
    const share = jest.fn(() => Promise.resolve());
    withShare(share);

    await shareOut(payload());

    expect(share).toHaveBeenCalled();
    expect(setStringAsync).not.toHaveBeenCalled();
  });

  it("passes a cancelled share on instead of falling back", async () => {
    // The export log must not record a share the user dismissed - `runFrameExport` writes it
    // only when `deliver` resolves, which used to be always.
    const abort = new Error("share cancelled");
    abort.name = "AbortError";
    withShare(jest.fn(() => Promise.reject(abort)));

    await expect(shareOut(payload())).rejects.toThrow("share cancelled");
    expect(setStringAsync).not.toHaveBeenCalled();
  });

  it("falls back to clipboard and download when the browser refuses the payload", async () => {
    withShare(jest.fn(() => Promise.reject(new Error("NotAllowedError"))));

    await shareOut(payload());

    expect(setStringAsync).toHaveBeenCalledWith("Kodak Gold 200");
  });

  it("copies and downloads on a browser without the Web Share API", async () => {
    withoutShare();

    await shareOut(payload());

    expect(setStringAsync).toHaveBeenCalledWith("Kodak Gold 200");
  });
});
