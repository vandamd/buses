import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { type Departure, getStopDepartures } from "@/services/api/bus-stops";
import type { SavedStop } from "@/types/stop";

const REFRESH_INTERVAL_MS = 10_000;

type NextDeparturesByStop = Record<string, Departure | null>;

export function useSavedStopsNextDepartures(savedStops: SavedStop[]) {
  const [nextDepartures, setNextDepartures] = useState<NextDeparturesByStop>(
    {}
  );

  const fetchNextDepartures = useCallback(async () => {
    if (savedStops.length === 0) {
      setNextDepartures({});
      return;
    }

    const entries = await Promise.all(
      savedStops.map(async (stop) => {
        try {
          const departures = await getStopDepartures(stop.atco_code);
          return [stop.atco_code, departures[0] ?? null] as const;
        } catch {
          return [stop.atco_code, null] as const;
        }
      })
    );

    setNextDepartures(Object.fromEntries(entries));
  }, [savedStops]);

  useFocusEffect(
    useCallback(() => {
      fetchNextDepartures().catch(() => undefined);
    }, [fetchNextDepartures])
  );

  useEffect(() => {
    if (savedStops.length === 0) {
      setNextDepartures({});
      return;
    }

    const interval = setInterval(() => {
      fetchNextDepartures().catch(() => undefined);
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [fetchNextDepartures, savedStops.length]);

  return nextDepartures;
}
