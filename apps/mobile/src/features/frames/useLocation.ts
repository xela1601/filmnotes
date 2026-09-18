/**
 * On-demand GPS lookup for a frame's location.
 *
 * The permission is requested when the photographer presses "use current position" and never
 * before – the app is fully usable without it, the location is one optional field of a frame.
 */
import * as Location from "expo-location";
import { useCallback, useState } from "react";

/** Outcome of a single lookup. Coordinates only exist in the granted case. */
export type LocationResult =
  | { status: "granted"; lat: number; lon: number }
  | { status: "denied" }
  | { status: "unavailable" };

export interface LocationLookup {
  /** True while a lookup is running, for the button's pending state. */
  busy: boolean;
  /** Asks for the permission if needed, then reads the current position. */
  requestPosition: () => Promise<LocationResult>;
}

/**
 * Five decimals are roughly one metre – more precision than a frame's location needs and less
 * noise in the stored record.
 */
const DECIMALS = 5;

function round(value: number): number {
  const factor = 10 ** DECIMALS;
  return Math.round(value * factor) / factor;
}

export function useLocation(): LocationLookup {
  const [busy, setBusy] = useState(false);

  const requestPosition = useCallback(async (): Promise<LocationResult> => {
    setBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) return { status: "denied" };

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return {
        status: "granted",
        lat: round(position.coords.latitude),
        lon: round(position.coords.longitude),
      };
    } catch {
      // No location services, no hardware, a timeout – all the same to the photographer.
      return { status: "unavailable" };
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, requestPosition };
}
