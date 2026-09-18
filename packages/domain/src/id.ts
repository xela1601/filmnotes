/** PocketBase's default record id format: 15 lowercase alphanumerics. */
export const ID_PATTERN = /^[a-z0-9]{15}$/;

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  // globalThis.crypto exists in Node ≥ 19, browsers and React Native (via expo-crypto polyfill).
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

export function newId(): string {
  const bytes = randomBytes(15);
  let id = "";
  for (const byte of bytes) id += ALPHABET[byte % ALPHABET.length];
  return id;
}
