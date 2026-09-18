import { act, renderHook } from "@testing-library/react-native";
import * as Location from "expo-location";

import { useLocation, type LocationResult } from "./useLocation";

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

const requestPermissions = Location.requestForegroundPermissionsAsync as jest.Mock;
const getCurrentPosition = Location.getCurrentPositionAsync as jest.Mock;

/** Runs one lookup through the hook and hands back what it resolved to. */
async function lookup(): Promise<LocationResult> {
  const { result } = renderHook(() => useLocation());
  let outcome: LocationResult | undefined;
  await act(async () => {
    outcome = await result.current.requestPosition();
  });
  if (outcome === undefined) throw new Error("the lookup did not resolve");
  return outcome;
}

describe("useLocation", () => {
  beforeEach(() => {
    requestPermissions.mockReset();
    getCurrentPosition.mockReset();
  });

  it("reports a denied permission and never asks for a position", async () => {
    requestPermissions.mockResolvedValue({ status: "denied", granted: false });

    expect(await lookup()).toEqual({ status: "denied" });
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("returns the coordinates rounded to five decimals once permission is granted", async () => {
    requestPermissions.mockResolvedValue({ status: "granted", granted: true });
    getCurrentPosition.mockResolvedValue({
      coords: { latitude: 48.137154321, longitude: 11.575382999 },
    });

    expect(await lookup()).toEqual({ status: "granted", lat: 48.13715, lon: 11.57538 });
  });

  it("asks for the permission only when a position is actually requested", () => {
    renderHook(() => useLocation());

    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it("reports an unavailable location when the device cannot deliver one", async () => {
    requestPermissions.mockResolvedValue({ status: "granted", granted: true });
    getCurrentPosition.mockRejectedValue(new Error("location services are off"));

    expect(await lookup()).toEqual({ status: "unavailable" });
  });

  it("is busy while the lookup runs and idle afterwards", async () => {
    requestPermissions.mockResolvedValue({ status: "granted", granted: true });
    getCurrentPosition.mockResolvedValue({ coords: { latitude: 1, longitude: 2 } });

    const { result } = renderHook(() => useLocation());
    expect(result.current.busy).toBe(false);

    let pending: Promise<LocationResult> | undefined;
    act(() => {
      pending = result.current.requestPosition();
    });
    expect(result.current.busy).toBe(true);

    await act(async () => {
      await pending;
    });
    expect(result.current.busy).toBe(false);
  });
});
