import { useCallback, useEffect, useState } from "react";
import { useFocusedPolling } from "@/hooks/useFocusedPolling";
import { type Departure, getStopDepartures } from "@/services/api/bus-stops";
import type { SavedStop } from "@/types/stop";

const REFRESH_INTERVAL_MS = 10_000;

type NextDeparturesByStop = Record<string, Departure | null>;

function areDeparturesEqual(
  current: Departure | null | undefined,
  next: Departure | null | undefined
) {
  if (current === next) {
    return true;
  }

  if (!(current && next)) {
    return false;
  }

  return (
    current.availableSeats === next.availableSeats &&
    current.destination === next.destination &&
    current.expected === next.expected &&
    current.scheduled === next.scheduled &&
    current.service === next.service &&
    current.tripId === next.tripId
  );
}

function mergeNextDepartures(
  current: NextDeparturesByStop,
  next: NextDeparturesByStop
) {
  const currentKeys = Object.keys(current);
  const nextKeys = Object.keys(next);

  if (
    currentKeys.length === nextKeys.length &&
    nextKeys.every((key) => areDeparturesEqual(current[key], next[key]))
  ) {
    return current;
  }

  return next;
}

export function useSavedStopsNextDepartures(savedStops: SavedStop[]) {
  const [nextDepartures, setNextDepartures] = useState<NextDeparturesByStop>(
    {}
  );

  const fetchNextDepartures = useCallback(
    async (isActive: () => boolean) => {
      const results = await Promise.allSettled(
        savedStops.map((stop) =>
          getStopDepartures(stop.atco_code, { includeOccupancy: false })
        )
      );

      if (!isActive()) {
        return;
      }

      const nextState = Object.fromEntries(
        savedStops.map((stop, index) => {
          const result = results[index];

          if (result?.status === "fulfilled") {
            return [stop.atco_code, result.value[0] ?? null] as const;
          }

          return [stop.atco_code, null] as const;
        })
      );

      setNextDepartures((current) => mergeNextDepartures(current, nextState));
    },
    [savedStops]
  );

  useEffect(() => {
    if (savedStops.length === 0) {
      setNextDepartures({});
    }
  }, [savedStops.length]);

  useFocusedPolling(fetchNextDepartures, {
    enabled: savedStops.length > 0,
    intervalMs: REFRESH_INTERVAL_MS,
    runImmediately: true,
  });

  return nextDepartures;
}
