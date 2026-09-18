/**
 * Credentials for an authenticated PocketBase session.
 *
 * Both the sync engine and the scan import need the same two paths – the stored token
 * first, the stored password as a fallback (which refreshes the token) – so they live
 * here instead of in either feature.
 */
import type { Id } from '@filmnotes/domain';

import { createPocketBaseClient, type SyncClient } from './client';
import { getSecret, setSecret } from '../lib/secureStore';
import { useStore } from '../store/store';

export interface ServerSession {
  client: SyncClient;
  /** PocketBase user id that becomes `owner` of the records written in this session. */
  ownerId: Id;
}

/**
 * Resolves the owner id for a run. `null` means "no usable credentials"; the caller
 * decides whether that is an error or simply "offline".
 */
export async function authenticate(client: SyncClient, email: string | null): Promise<Id | null> {
  const token = await getSecret('serverToken');
  if (token !== null) {
    const auth = await client.authWithToken(token);
    if (auth !== null) return auth.userId;
  }

  const password = await getSecret('serverPassword');
  if (email === null || password === null) return null;

  const auth = await client.authWithPassword(email, password);
  // The token the login just handed out replaces the expired one.
  await setSecret('serverToken', auth.token);
  return auth.userId;
}

/**
 * Opens a session against the configured server, or returns `null` when no server is
 * configured or the stored credentials no longer work.
 */
export async function openServerSession(): Promise<ServerSession | null> {
  const { serverUrl, serverEmail } = useStore.getState().settings;
  if (serverUrl === null) return null;

  const client = createPocketBaseClient(serverUrl);
  const ownerId = await authenticate(client, serverEmail);
  return ownerId === null ? null : { client, ownerId };
}
