import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Importing the module initialises i18next before the first screen renders.
import { setAppLanguage } from '../src/i18n';
import { now } from '../src/lib/clock';
import { useStore } from '../src/store/store';
import { useSync } from '../src/sync/useSync';
import { useTheme } from '../src/ui/theme';

/** True once the persisted state has been read back from storage. */
function useStoreHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useStore.persist.hasHydrated());

  useEffect(() => {
    const unsubscribe = useStore.persist.onFinishHydration(() => setHydrated(true));
    // Hydration can already have finished before this effect ran.
    if (useStore.persist.hasHydrated()) setHydrated(true);
    return unsubscribe;
  }, []);

  return hydrated;
}

export default function RootLayout() {
  const { palette, scheme } = useTheme();
  const hydrated = useStoreHydrated();
  // Mounted here so the automatic foreground sync runs wherever the user is in the app,
  // not only while the server settings screen happens to be open.
  useSync();
  const locale = useStore((state) => state.settings.locale);
  const seedPresets = useStore((state) => state.seedPresets);

  useEffect(() => {
    void setAppLanguage(locale);
  }, [locale]);

  useEffect(() => {
    // seedPresets is a no-op once every bundle is recorded in seededBundleIds.
    if (hydrated) seedPresets(now());
  }, [hydrated, seedPresets]);

  return (
    <SafeAreaProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {hydrated ? (
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: palette.background },
            headerTintColor: palette.text,
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: palette.background },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      ) : (
        <View
          testID="hydration-gate"
          style={[styles.gate, { backgroundColor: palette.background }]}
        >
          <ActivityIndicator color={palette.primary} />
        </View>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  gate: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
