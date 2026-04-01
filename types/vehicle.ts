export interface VehicleJourney {
  datetime: string;
  destination: string;
  id: number;
  latitude: number | null;
  longitude: number | null;
  route_name: string;
  trip_id: number | null;
  vehicle: VehicleSummary | null;
}

export interface VehicleSummary {
  fleet_code: string | null;
  id: number;
  reg: string;
  slug: string;
}
