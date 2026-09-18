/**
 * Web implementation of `shareOut`.
 *
 * Browsers that implement the Web Share API (mobile Safari, Chrome on Android) get the real share
 * sheet; everywhere else the caption goes to the clipboard and the image is offered as a download,
 * which is what a desktop user needs to post it by hand.
 */
import type { SharePayload } from "@filmnotes/exporters";
import * as Clipboard from "expo-clipboard";

/** A `Blob` of the image bytes, copied into a fresh buffer so it is never a view on a shared one. */
function blobOf(image: NonNullable<SharePayload["image"]>): Blob {
  return new Blob([new Uint8Array(image.bytes)], { type: image.mimeType });
}

/** Offers the image as a download; the only way to "share" a file on a desktop browser. */
function download(image: NonNullable<SharePayload["image"]>): void {
  const url = URL.createObjectURL(blobOf(image));
  const link = document.createElement("a");
  link.href = url;
  link.download = image.fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel the download in some browsers, so it waits a moment.
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function shareOut(payload: SharePayload): Promise<void> {
  const files =
    payload.image === null
      ? []
      : [
          new File([blobOf(payload.image)], payload.image.fileName, {
            type: payload.image.mimeType,
          }),
        ];

  const data: ShareData =
    payload.image === null ? { text: payload.text } : { text: payload.text, files };
  if (navigator.share !== undefined && (navigator.canShare?.(data) ?? files.length === 0)) {
    try {
      await navigator.share(data);
      return;
    } catch {
      // The user dismissed the sheet, or the browser refused the payload – fall through to
      // clipboard plus download, which always works.
    }
  }

  if (payload.text !== "") await Clipboard.setStringAsync(payload.text);
  if (payload.image !== null) download(payload.image);
}
