import * as SecureStore from "expo-secure-store";

/** Secrets that never go into the persisted store. */
export type SecretKey = "serverPassword" | "serverToken" | "wordpressAppPassword";

export async function getSecret(key: SecretKey): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

export async function setSecret(key: SecretKey, value: string | null): Promise<void> {
  if (value === null) {
    await SecureStore.deleteItemAsync(key);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}
