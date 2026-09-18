/** PocketBase's default record id format: 15 lowercase alphanumerics. */
export const ID_PATTERN = /^[a-z0-9]{15}$/;

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  // globalThis.crypto exists in Node ≥ 19, browsers and React Native (via expo-crypto polyfill).
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * A new record id.
 *
 * Rejection sampling rather than `byte % 36`: 256 is not a multiple of 36, so the modulo would
 * hand out the first four letters about 14 % more often than the rest. It costs nothing here and
 * keeps the ids uniform, which is what the collision estimate assumes.
 */
export function newId(): string {
  const limit = Math.floor(256 / ALPHABET.length) * ALPHABET.length; // 252
  let id = "";
  while (id.length < 15) {
    for (const byte of randomBytes(15 - id.length)) {
      if (byte >= limit) continue;
      id += ALPHABET[byte % ALPHABET.length];
    }
  }
  return id;
}
