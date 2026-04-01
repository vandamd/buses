export interface Departure {
  aimed_departure_time: string; // ISO 8601
  destination: string;
  expected_departure_time: string | null; // null if no live data
  id: string;
  is_live: boolean;
  service: ServiceSummary;
}

export interface ServiceSummary {
  id: number;
  line_name: string; // e.g., "25", "N98"
  operator: string;
}
