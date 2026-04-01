import type { TripData, VehicleLocation } from "@/services/api/bus-vehicles";

export function buildRouteGeoJson(tripData: TripData | null) {
  if (!tripData) {
    return null;
  }

  const coordinates: [number, number][] = [];

  for (const stop of tripData.stops) {
    if (!stop.track) {
      continue;
    }

    for (const coordinate of stop.track) {
      coordinates.push(coordinate);
    }
  }

  if (coordinates.length === 0) {
    return null;
  }

  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "LineString" as const,
      coordinates,
    },
  };
}

export function buildStopsGeoJson(
  tripData: TripData | null,
  currentStopAtcoCode?: string
) {
  if (!tripData) {
    return null;
  }

  return {
    type: "FeatureCollection" as const,
    features: tripData.stops
      .filter((stop) => stop.location)
      .map((stop) => ({
        type: "Feature" as const,
        properties: {
          eta: stop.aimed_departure_time || stop.aimed_arrival_time || "",
          isCurrent: stop.atco_code === currentStopAtcoCode,
          name: stop.name,
        },
        geometry: {
          type: "Point" as const,
          coordinates: stop.location,
        },
      })),
  };
}

export function buildVehiclesGeoJson(
  vehicles: VehicleLocation[],
  currentTripId?: string
) {
  if (vehicles.length === 0) {
    return null;
  }

  const parsedTripId = Number.parseInt(currentTripId || "0", 10);

  return {
    type: "FeatureCollection" as const,
    features: vehicles.map((vehicle) => ({
      type: "Feature" as const,
      properties: {
        heading: vehicle.heading - 90,
        isCurrent: vehicle.trip_id === parsedTripId,
        service: vehicle.service.line_name,
      },
      geometry: {
        type: "Point" as const,
        coordinates: vehicle.coordinates,
      },
    })),
  };
}

export function getInitialBounds(
  routeGeoJson: ReturnType<typeof buildRouteGeoJson>
) {
  if (!routeGeoJson) {
    return null;
  }

  const coordinates = routeGeoJson.geometry.coordinates;

  if (coordinates.length === 0) {
    return null;
  }

  let minLon = coordinates[0][0];
  let maxLon = coordinates[0][0];
  let minLat = coordinates[0][1];
  let maxLat = coordinates[0][1];

  for (const [lon, lat] of coordinates) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  return {
    ne: [maxLon, maxLat] as [number, number],
    sw: [minLon, minLat] as [number, number],
  };
}
