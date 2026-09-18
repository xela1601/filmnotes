/**
 * A short-lived token for the protected scan files.
 *
 * `scans.file` is `protected` on the server (migration 1758600000), so its URLs only work with
 * `?token=`. The token is bound to the logged-in user and PocketBase expires it after a few
 * minutes, so it is fetched once per mount and refreshed while the screen stays open.
 *
 * `null` means "no image URL can be built right now" - no server, no credentials, or the server
 * is unreachable. Every caller already had to handle that state (files live on the server only),
 * so nothing new happens on a screen without a connection.
 */
import { useEffect, useState } from "react";

import { openServerSession } from "./session";
import { useStore } from "../store/store";

/** Comfortably inside PocketBase's default file-token lifetime (3 minutes). */
const REFRESH_INTERVAL_MS = 120_000;

export function useFileToken(): string | null {
  const serverUrl = useStore((state) => state.settings.serverUrl);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (serverUrl === null) return;

    let active = true;
    const fetchToken = async (): Promise<void> => {
      try {
        const session = await openServerSession();
        const next = session === null ? null : await session.client.fileToken();
        if (active) setToken(next);
      } catch {
        // Offline or the server is down: the screens show "no image yet", which is the same
        // thing they show without a server at all.
        if (active) setToken(null);
      }
    };

    void fetchToken();
    const timer = setInterval(() => void fetchToken(), REFRESH_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [serverUrl]);

  // Derived rather than stored: without a server there is nothing to ask for a token, and
  // clearing the state inside the effect would be a cascading render.
  return serverUrl === null ? null : token;
}
