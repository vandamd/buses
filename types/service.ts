export interface BusService {
  description: string;
  id: number;
  line_name: string;
  mode: "bus" | "coach" | "tram" | "metro";
  operators: OperatorSummary[];
  region_id: string;
  slug: string;
}

export interface OperatorSummary {
  name: string;
  noc: string;
  slug: string;
  vehicle_mode: string;
}
