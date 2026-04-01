import { useCallback, useEffect, useState } from "react";
import { useFocusedPolling } from "@/hooks/useFocusedPolling";
import {
  type Departure,
  getStop,
  getStopDepartures,
} from "@/services/api/bus-stops";
import type { BusStop } from "@/types/stop";

const REFRESH_INTERVAL_MS = 10_000;

export function useStopDetails(atcoCode?: string) {
  const [stop, setStop] = useState<BusStop | null>(null);
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDepartures = useCallback(
    async (isActive: () => boolean) => {
      if (!atcoCode) {
        return;
      }

      try {
        const data = await getStopDepartures(atcoCode);
        if (!isActive()) {
          return;
        }
        setDepartures(data);
      } catch {
        // Departures are supplementary, so keep the screen usable.
      }
    },
    [atcoCode]
  );

  useEffect(() => {
    let isActive = true;

    if (!atcoCode) {
      return () => {
        isActive = false;
      };
    }

    setIsLoading(true);

    Promise.all([
      getStop(atcoCode),
      getStopDepartures(atcoCode).catch(() => []),
    ])
      .then(([stopData, departuresData]) => {
        if (!isActive) {
          return;
        }

        setStop(stopData);
        setDepartures(departuresData);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!isActive) {
          return;
        }

        setError(err instanceof Error ? err : new Error("Failed to load stop"));
      })
      .finally(() => {
        if (!isActive) {
          return;
        }

        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [atcoCode]);

  useFocusedPolling(fetchDepartures, {
    enabled: Boolean(atcoCode) && !isLoading,
    intervalMs: REFRESH_INTERVAL_MS,
  });

  return {
    departures,
    error,
    isLoading,
    stop,
  };
}
