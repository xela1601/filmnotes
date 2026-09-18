import type { CollectionName, EntityOf, Id } from '@filmnotes/domain';
import { useShallow } from 'zustand/react/shallow';

import { selectActive } from './selectors';
import { useStore, type Settings } from './store';

/** A single record by id; `undefined` while it does not exist (or `id` is null). */
export function useEntity<K extends CollectionName>(
  collection: K,
  id: Id | null,
): EntityOf<K> | undefined {
  return useStore((state) => (id === null ? undefined : state.entities[collection][id]));
}

/** All non-deleted records of a collection. Shallow-compared, so the array identity is stable. */
export function useActive<K extends CollectionName>(collection: K): EntityOf<K>[] {
  return useStore(useShallow((state) => selectActive(state, collection)));
}

export function useSettings(): Settings {
  return useStore((state) => state.settings);
}
