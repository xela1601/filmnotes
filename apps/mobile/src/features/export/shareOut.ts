/**
 * Hands a share package to the operating system (native).
 *
 * The caption goes to the clipboard first, because no mobile share sheet lets an app prefill the
 * caption of an Instagram or Mastodon post – the user pastes it there. The image is written to
 * the cache directory because `expo-sharing` shares a file, not bytes.
 *
 * A package without an image (a frame whose scan has not been imported yet) falls back to React
 * Native's own share sheet, which does take plain text.
 *
 * The web implementation is `shareOut.web.ts`; Metro picks it for `platform === 'web'`.
 */
import type { SharePayload } from '@filmnotes/exporters';
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';

/** The cache file the image is shared from; it is overwritten by every export. */
const SHARE_FILE_PREFIX = 'filmnotes-share-';

export async function shareOut(payload: SharePayload): Promise<void> {
  if (payload.text !== '') await Clipboard.setStringAsync(payload.text);

  if (payload.image === null || !(await Sharing.isAvailableAsync())) {
    // Nothing to share as a file – let the OS share the caption as text.
    if (payload.text !== '') await Share.share({ message: payload.text });
    return;
  }

  const file = new File(Paths.cache, `${SHARE_FILE_PREFIX}${payload.image.fileName}`);
  if (file.exists) file.delete();
  file.create();
  file.write(payload.image.bytes);

  await Sharing.shareAsync(file.uri, {
    mimeType: payload.image.mimeType,
    dialogTitle: payload.text === '' ? undefined : payload.text,
    UTI: payload.image.mimeType === 'image/png' ? 'public.png' : 'public.jpeg',
  });
}
