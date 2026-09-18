import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StateStorage } from 'zustand/middleware';

/** Persisted storage on iOS and Android. The web build uses `persistStorage.web.ts`. */
export const persistStorage: StateStorage = AsyncStorage;
