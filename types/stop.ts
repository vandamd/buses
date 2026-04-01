export interface BusStop {
  active: boolean;
  atco_code: string;
  bearing: string;
  bus_stop_type: string;
  common_name: string;
  heading: number | null;
  icon: string | null;
  indicator: string; // e.g., "Stop A", "Stand 3"
  line_names: string[] | null;
  location: [number, number] | null; // [longitude, latitude]
  long_name: string;
  name: string;
  naptan_code: string | null;
  stop_type: string;
}

export interface SavedStop {
  atco_code: string;
  common_name: string;
  indicator: string;
  line_names: string[];
  location: [number, number] | null;
  saved_at: string; // ISO 8601
}
