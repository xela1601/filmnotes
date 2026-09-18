/**
 * Web implementation of src/lib/secureStore.ts.
 *
 * expo-secure-store has no web backend, so the browser keeps the secrets in
 * localStorage. Metro picks this file automatically for `platform === 'web'`.
 */
export type SecretKey = "serverPassword" | "serverToken" | "wordpressAppPassword";

const PREFIX = "filmnotes.secret.";

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Blocked site data (private mode, disabled storage).
    return null;
  }
}

export async function getSecret(key: SecretKey): Promise<string | null> {
  return storage()?.getItem(PREFIX + key) ?? null;
}

export async function setSecret(key: SecretKey, value: string | null): Promise<void> {
  const store = storage();
  if (store === null) return;
  if (value === null) store.removeItem(PREFIX + key);
  else store.setItem(PREFIX + key, value);
}
