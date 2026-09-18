import type { StateStorage } from 'zustand/middleware';

/**
 * Persisted storage for the web build.
 *
 * `@react-native-async-storage/async-storage` does have a localStorage-backed web
 * implementation, but in the exported web bundle the store ended up with an unusable
 * storage object: zustand's `persist` then never rehydrates and – because it fails
 * silently – the app stays on the hydration gate forever. Talking to `localStorage`
 * directly removes that whole class of failure on the platform where it is trivial.
 *
 * Every access is guarded: Safari in private mode and blocked site data make
 * `localStorage` throw rather than return null.
 */
export const persistStorage: StateStorage = {
  getItem(name) {
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem(name, value) {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      // Nothing to do: the app keeps working, this session just is not persisted.
    }
  },
  removeItem(name) {
    try {
      window.localStorage.removeItem(name);
    } catch {
      // See setItem.
    }
  },
};
