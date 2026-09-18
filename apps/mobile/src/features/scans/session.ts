/**
 * The authenticated PocketBase session the scan import needs.
 *
 * Unlike the rest of the app, this feature cannot work offline: the files are stored on
 * the server, so it needs a client *and* the owner id the records are written with. The
 * sync engine (T-008) resolves the same thing for its own run but keeps it private, so
 * the two credential paths – a stored token first, the stored password as a fallback –
 * are repeated here.
 */
import type { Id } from '@filmnotes/domain';

import { createPocketBaseClient, type SyncClient } from '../../sync/client';
import { getSecret, setSecret } from '../../lib/secureStore';
import { useStore } from '../../store/store';

export interface ServerSession {
  client: SyncClient;
  /** PocketBase user id that becomes `owner` of the uploaded scans. */
  ownerId: Id;
}

/**
 * Opens a session against the configured server, or returns `null` when no server is
 * configured or the stored credentials no longer work.
 */
export async function openServerSession(): Promise<ServerSession | null> {
  const { serverUrl, serverEmail } = useStore.getState().settings;
  if (serverUrl === null) return null;

  const client = createPocketBaseClient(serverUrl);

  const token = await getSecret('serverToken');
  if (token !== null) {
    const auth = await client.authWithToken(token);
    if (auth !== null) return { client, ownerId: auth.userId };
  }

  const password = await getSecret('serverPassword');
  if (serverEmail === null || password === null) return null;

  const auth = await client.authWithPassword(serverEmail, password);
  // The token the login just handed out replaces the expired one.
  await setSecret('serverToken', auth.token);
  return { client, ownerId: auth.userId };
}
