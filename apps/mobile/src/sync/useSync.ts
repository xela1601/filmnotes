/**
 * React binding for the sync engine.
 *
 * Holds the transient sync state (status, last result), authenticates through
 * `./session`, and triggers a sync when the app comes back to the
 * foreground. The store itself only keeps the durable part (`lastSyncAt`, outbox), so a
 * restart never shows a stale "running".
 */
import { useCallback, useEffect, useState } from "react";
import { AppState as ReactNativeAppState } from "react-native";

import { createPocketBaseClient } from "./client";
import { runSync, type SyncResult } from "./engine";
import { authenticate } from "./session";
import * as clock from "../lib/clock";
import { useStore } from "../store/store";

export type SyncStatus = "idle" | "running" | "error" | "no_server";

export interface UseSyncResult {
  status: SyncStatus;
  lastResult: SyncResult | null;
  syncNow(): Promise<void>;
  /** True as soon as a server URL is stored; credentials may still be missing. */
  isConfigured: boolean;
}

/** Shortest gap between two automatic foreground syncs. */
export const AUTO_SYNC_INTERVAL_MS = 60_000;

/**
 * Sync runs are app-wide, not per component: the hook is mounted by the root layout for
 * the foreground sync and again by the server settings screen for its button. Guarding
 * per instance would let those two overlap and push the same outbox entries twice.
 */
let syncRunning = false;
/** `Date.now()` of the last started run; drives the auto-sync interval. */
let lastRunStartedAt = 0;

/** Test seam: forget that a sync ever ran. */
export function resetSyncSchedule(): void {
  syncRunning = false;
  lastRunStartedAt = 0;
}

function failure(message: string): SyncResult {
  return { pushed: 0, pulled: 0, conflictsLocalWon: 0, conflictsRemoteWon: 0, errors: [message] };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useSync(): UseSyncResult {
  const serverUrl = useStore((state) => state.settings.serverUrl);
  const serverEmail = useStore((state) => state.settings.serverEmail);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);

  const isConfigured = serverUrl !== null;

  const syncNow = useCallback(async (): Promise<void> => {
    if (serverUrl === null || syncRunning) return;
    syncRunning = true;
    lastRunStartedAt = Date.now();
    setStatus("running");

    try {
      const client = createPocketBaseClient(serverUrl);
      const ownerId = await authenticate(client, serverEmail);
      if (ownerId === null) {
        setLastResult(failure("no usable credentials for the configured server"));
        setStatus("error");
        return;
      }

      const result = await runSync({
        client,
        ownerId,
        getState: () => useStore.getState(),
        applyRemote: (collection, records) => useStore.getState().applyRemote(collection, records),
        removeFromOutbox: (entries) => useStore.getState().removeFromOutbox(entries),
        setLastSyncAt: (at) => useStore.getState().setLastSyncAt(at),
        now: clock.now,
      });
      setLastResult(result);
      setStatus(result.errors.length > 0 ? "error" : "idle");
    } catch (error) {
      setLastResult(failure(messageOf(error)));
      setStatus("error");
    } finally {
      syncRunning = false;
    }
  }, [serverEmail, serverUrl]);

  useEffect(() => {
    if (!isConfigured) return;
    const subscription = ReactNativeAppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      if (Date.now() - lastRunStartedAt < AUTO_SYNC_INTERVAL_MS) return;
      void syncNow();
    });
    return () => subscription.remove();
  }, [isConfigured, syncNow]);

  return {
    status: isConfigured ? status : "no_server",
    lastResult,
    syncNow,
    isConfigured,
  };
}
