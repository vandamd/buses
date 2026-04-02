import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusedPolling } from "@/hooks/useFocusedPolling";
import {
  getAllVehicles,
  getTripData,
  type TripData,
  type VehicleLocation,
} from "@/services/api/bus-vehicles";
import {
  buildRouteGeoJson,
  buildStopsGeoJson,
  buildVehiclesGeoJson,
  getInitialBounds,
} from "@/utils/vehicleMap";

const REFRESH_INTERVAL_MS = 10_000;

interface UseVehicleMapDataParams {
  stopAtcoCode?: string;
  tripId?: string;
}

async function loadVehicleMapData(tripId: string) {
  try {
    const tripData = await getTripData(Number.parseInt(tripId, 10));

    if (!tripData) {
      return {
        error: "Could not load trip data.",
        tripData: null,
        vehicles: [],
      };
    }

    const vehicles = tripData.serviceId
      ? await getAllVehicles(tripData.serviceId)
      : [];

    return {
      error: null,
      tripData,
      vehicles,
    };
  } catch {
    return {
      error: "Failed to load data.",
      tripData: null,
      vehicles: [],
    };
  }
}

export function useVehicleMapData({
  tripId,
  stopAtcoCode,
}: UseVehicleMapDataParams) {
  const [tripData, setTripData] = useState<TripData | null>(null);
  const [allVehicles, setAllVehicles] = useState<VehicleLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVehicles = useCallback(
    async (serviceId: number, isActive: () => boolean) => {
      try {
        const data = await getAllVehicles(serviceId);
        if (!isActive()) {
          return;
        }
        setAllVehicles(data);
      } catch {
        // Live vehicle positions are nice-to-have; keep the route visible.
      }
    },
    []
  );

  const refreshVehicles = useCallback(
    async (isActive: () => boolean) => {
      if (!tripData?.serviceId) {
        return;
      }

      await fetchVehicles(tripData.serviceId, isActive);
    },
    [fetchVehicles, tripData?.serviceId]
  );

  useEffect(() => {
    let isActive = true;

    if (!tripId) {
      setTripData(null);
      setAllVehicles([]);
      setError("Missing trip ID.");
      setIsLoading(false);
      return () => {
        isActive = false;
      };
    }

    setIsLoading(true);

    loadVehicleMapData(tripId)
      .then((result) => {
        if (!isActive) {
          return;
        }

        setTripData(result.tripData);
        setAllVehicles(result.vehicles);
        setError(result.error);
        setIsLoading(false);
      })
      .catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, [tripId]);

  useFocusedPolling(refreshVehicles, {
    enabled: Boolean(tripData?.serviceId),
    intervalMs: REFRESH_INTERVAL_MS,
  });

  const routeGeoJson = useMemo(() => buildRouteGeoJson(tripData), [tripData]);
  const stopsGeoJson = useMemo(
    () => buildStopsGeoJson(tripData, stopAtcoCode),
    [stopAtcoCode, tripData]
  );
  const vehiclesGeoJson = useMemo(
    () => buildVehiclesGeoJson(allVehicles, tripId),
    [allVehicles, tripId]
  );
  const initialBounds = useMemo(
    () => getInitialBounds(routeGeoJson),
    [routeGeoJson]
  );

  return {
    error,
    initialBounds,
    isLoading,
    routeGeoJson,
    stopsGeoJson,
    vehiclesGeoJson,
  };
}
