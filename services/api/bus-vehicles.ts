export interface TripStop {
  aimed_arrival_time: string | null;
  aimed_departure_time: string | null;
  atco_code: string;
  location: [number, number]; // [lat, lon]
  name: string;
  track: [number, number][] | null; // route to next stop
}

export interface TripData {
  destination: string;
  id: number;
  serviceId: number;
  stops: TripStop[];
}

export interface VehicleService {
  line_name: string;
  url: string;
}

export interface VehicleInfo {
  colour: string | null;
  features: string;
  livery: number | null;
  name: string;
  url: string;
}

export interface VehicleProgress {
  id: number;
  next_stop: string;
  prev_stop: string;
  progress: number;
  sequence: number;
}

export interface VehicleLocation {
  block: string | null;
  coordinates: [number, number]; // [longitude, latitude]
  datetime: string;
  delay?: number;
  destination: string;
  heading: number;
  id: number;
  journey_id: number;
  progress?: VehicleProgress;
  service: VehicleService;
  service_id: number;
  trip_id: number;
  vehicle: VehicleInfo;
}

export async function getVehicleLocation(
  serviceId: number,
  tripId: number
): Promise<VehicleLocation | null> {
  const vehicles = await getAllVehicles(serviceId);
  return vehicles.find((v) => v.trip_id === tripId) || null;
}

export async function getAllVehicles(
  serviceId: number
): Promise<VehicleLocation[]> {
  const url = `https://bustimes.org/vehicles.json?service=${serviceId}`;
  const response = await fetch(url);

  if (!response.ok) {
    return [];
  }

  return await response.json();
}

interface TripApiTime {
  aimed_arrival_time: string | null;
  aimed_departure_time: string | null;
  stop: {
    atco_code: string;
    name: string;
    location: [number, number];
  };
  track: [number, number][] | null;
}

interface TripApiResponse {
  destination: { name: string };
  id: number;
  service: { id: number };
  times: TripApiTime[];
}

export async function getTripData(tripId: number): Promise<TripData | null> {
  const url = `https://bustimes.org/api/trips/${tripId}/`;
  const response = await fetch(url);

  if (!response.ok) {
    return null;
  }

  const data: TripApiResponse = await response.json();

  return {
    id: data.id,
    serviceId: data.service?.id,
    destination: data.destination?.name || "",
    stops:
      data.times?.map((time) => ({
        atco_code: time.stop.atco_code,
        name: time.stop.name,
        location: time.stop.location,
        aimed_arrival_time: time.aimed_arrival_time,
        aimed_departure_time: time.aimed_departure_time,
        track: time.track,
      })) || [],
  };
}
