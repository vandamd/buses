import type { BusStop } from "@/types/stop";
import { decodeHtmlEntities } from "@/utils/decodeHtml";
import { apiGet, type PaginatedResponse } from "./client";

interface StopSearchResult {
  active: boolean;
  atco_code: string;
  bearing: string;
  bus_stop_type: string;
  common_name: string;
  heading: number | null;
  icon: string | null;
  indicator: string;
  line_names: string[] | null;
  location: [number, number] | null;
  long_name: string;
  name: string;
  naptan_code: string | null;
  stop_type: string;
}

export async function searchStops(
  query: string,
  limit = 20
): Promise<BusStop[]> {
  if (!query.trim()) {
    return [];
  }

  const response = await apiGet<PaginatedResponse<StopSearchResult>>(
    "/stops/",
    {
      search: query,
      limit: limit.toString(),
    }
  );

  return response.results;
}

export function getStop(atcoCode: string): Promise<BusStop> {
  return apiGet<BusStop>(`/stops/${atcoCode}/`);
}

export interface Departure {
  availableSeats?: number;
  destination: string;
  expected: string | null;
  scheduled: string;
  service: string;
  tripId: number | null;
}

interface FirstBusResponse {
  data?: {
    attributes?: {
      "live-departures"?: Array<{
        line?: string;
        operator?: string;
        direction?: string;
        "scheduled-time"?: string;
        occupancy?: {
          types?: Array<{
            name?: string;
            occupied?: number;
            capacity?: number;
          }>;
        };
      }>;
    };
  };
}

interface FirstBusDeparture {
  availableSeats: number;
  destinationName?: string;
  lineRef: string;
  scheduledMinutes: number | null;
}

interface DepartureMatchContext {
  destinationName?: string;
  expectedMinutes: number | null;
  lineRef?: string;
  scheduledMinutes: number | null;
}

const FIRST_BUS_API_HOST = "https://prod.mobileapi.firstbus.co.uk";
const DEPARTURES_REQUEST_TIMEOUT_MS = 4500;
const FIRST_REQUEST_TIMEOUT_MS = 3500;
const FIRST_PROVIDER_TIMEOUT_MS = 4500;
const TIME_PATTERN = /^(\d{1,2}):(\d{2})$/;
const INLINE_TIME_PATTERN = /\b(\d{1,2}):(\d{2})\b/;
const TABLE_PATTERN = /<table>[\s\S]*?<\/table>/i;
const TABLE_ROW_PATTERN = /<tr>([\s\S]*?)<\/tr>/gi;
const TABLE_HEADER_PATTERN = /<th\b/i;
const TABLE_CELL_PATTERN = /<td[^>]*>([\s\S]*?)<\/td>/gi;
const VEHICLE_DIV_PATTERN = /<div class="vehicle">[\s\S]*?<\/div>/gi;
const TRIP_ID_PATTERN = /\/trips\/(\d+)/;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function withProviderTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T
): Promise<T> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(fallback), timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeout);
        resolve(result);
      })
      .catch(() => {
        clearTimeout(timeout);
        resolve(fallback);
      });
  });
}

function normalizeLineRef(
  value: string | null | undefined
): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.replace(/\s+/g, " ").trim().toUpperCase();
  return normalized || undefined;
}

function normalizeText(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = decodeHtmlEntities(value)
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return normalized || undefined;
}

function collectMatches(regex: RegExp, text: string): RegExpExecArray[] {
  const matches: RegExpExecArray[] = [];
  regex.lastIndex = 0;

  for (let match = regex.exec(text); match !== null; match = regex.exec(text)) {
    matches.push(match);
  }

  return matches;
}

function isoToMinutes(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.getHours() * 60 + date.getMinutes();
}

function minuteDiff(a: number, b: number): number {
  const rawDiff = Math.abs(a - b);
  return Math.min(rawDiff, 24 * 60 - rawDiff);
}

async function getFirstBusDepartures(
  atcoCode: string,
  apiKey: string
): Promise<FirstBusDeparture[]> {
  try {
    const response = await fetchWithTimeout(
      `${FIRST_BUS_API_HOST}/api/v2/bus/stop/${encodeURIComponent(atcoCode)}/departure`,
      { headers: { "x-app-key": apiKey } },
      FIRST_REQUEST_TIMEOUT_MS
    );

    if (!response.ok) {
      return [];
    }

    const data: FirstBusResponse = await response.json();
    const liveDepartures = data.data?.attributes?.["live-departures"];
    if (!Array.isArray(liveDepartures)) {
      return [];
    }

    const departures: FirstBusDeparture[] = [];

    for (const dep of liveDepartures) {
      const lineRef = normalizeLineRef(dep.line);
      if (!lineRef) {
        continue;
      }

      const occupancyTypes = dep.occupancy?.types;
      if (!Array.isArray(occupancyTypes)) {
        continue;
      }

      const seated = occupancyTypes.find(
        (type) =>
          type?.name === "seated" &&
          typeof type.occupied === "number" &&
          typeof type.capacity === "number"
      );
      if (seated) {
        const availableSeats = Math.max(
          0,
          (seated.capacity ?? 0) - (seated.occupied ?? 0)
        );

        departures.push({
          lineRef,
          destinationName: normalizeText(dep.direction),
          scheduledMinutes: isoToMinutes(dep["scheduled-time"]),
          availableSeats,
        });
      }
    }

    return departures;
  } catch {
    return [];
  }
}

function getDestinationPenalty(
  departureDestinationName: string | undefined,
  candidateDestinationName: string | undefined
): number {
  if (!(departureDestinationName && candidateDestinationName)) {
    return 0;
  }
  if (departureDestinationName === candidateDestinationName) {
    return -0.5;
  }
  if (
    departureDestinationName.includes(candidateDestinationName) ||
    candidateDestinationName.includes(departureDestinationName)
  ) {
    return 0.25;
  }

  return 1.5;
}

function buildDepartureContexts(
  departures: Departure[]
): DepartureMatchContext[] {
  return departures.map((departure) => ({
    lineRef: normalizeLineRef(departure.service),
    scheduledMinutes: timeToMinutesOrNull(departure.scheduled),
    expectedMinutes: timeToMinutesOrNull(departure.expected),
    destinationName: normalizeText(departure.destination),
  }));
}

function stripHtml(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function extractTime(text: string): string | null {
  const match = text.match(INLINE_TIME_PATTERN);
  if (!match) {
    return null;
  }
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function timeToMinutesOrNull(time: string | null | undefined): number | null {
  if (!time) {
    return null;
  }

  const match = time.match(TIME_PATTERN);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

function getMatchingMinutes(context: DepartureMatchContext): number | null {
  return context.scheduledMinutes ?? context.expectedMinutes;
}

function findBestFirstMatchIndex(
  context: DepartureMatchContext,
  firstDepartures: FirstBusDeparture[],
  usedFirstIndexes: Set<number>
): number | null {
  const targetMinutes = getMatchingMinutes(context);
  if (!context.lineRef || targetMinutes === null) {
    return null;
  }

  let bestIndex = -1;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let i = 0; i < firstDepartures.length; i += 1) {
    if (usedFirstIndexes.has(i)) {
      continue;
    }

    const candidate = firstDepartures[i];
    if (candidate.lineRef !== context.lineRef) {
      continue;
    }
    if (candidate.scheduledMinutes === null) {
      continue;
    }

    const diff = minuteDiff(candidate.scheduledMinutes, targetMinutes);
    if (diff > 5) {
      continue;
    }

    const score =
      diff +
      getDestinationPenalty(context.destinationName, candidate.destinationName);

    if (score < bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex >= 0 ? bestIndex : null;
}

function mergeOccupancy(
  departures: Departure[],
  contexts: DepartureMatchContext[],
  firstDepartures: FirstBusDeparture[]
): Departure[] {
  const usedFirstIndexes = new Set<number>();

  return departures.map((departure, index) => {
    const context = contexts[index];

    const firstMatchIndex = findBestFirstMatchIndex(
      context,
      firstDepartures,
      usedFirstIndexes
    );
    if (firstMatchIndex !== null) {
      usedFirstIndexes.add(firstMatchIndex);
      return {
        ...departure,
        availableSeats: firstDepartures[firstMatchIndex].availableSeats,
      };
    }

    return departure;
  });
}

function getDepartureSortDiff(
  departure: Departure,
  nowMinutes: number
): number {
  const displayTime = departure.expected || departure.scheduled;
  const departureMinutes = timeToMinutesOrNull(displayTime);
  if (departureMinutes === null) {
    return Number.POSITIVE_INFINITY;
  }

  return (departureMinutes - nowMinutes + 24 * 60) % (24 * 60);
}

function parseDeparturesHtml(html: string): Departure[] {
  const tableMatch = html.match(TABLE_PATTERN);
  if (!tableMatch) {
    return [];
  }

  const rows: Departure[] = [];
  for (const rowMatch of collectMatches(TABLE_ROW_PATTERN, tableMatch[0])) {
    const rowHtml = rowMatch[1];

    if (TABLE_HEADER_PATTERN.test(rowHtml)) {
      continue;
    }

    const cells: string[] = [];
    for (const cellMatch of collectMatches(TABLE_CELL_PATTERN, rowHtml)) {
      cells.push(cellMatch[1]);
    }

    if (cells.length < 3) {
      continue;
    }

    const service = stripHtml(cells[0]);
    const destination = stripHtml(cells[1].replace(VEHICLE_DIV_PATTERN, " "));
    const scheduled = extractTime(stripHtml(cells[2]));
    const expected = cells[3] ? extractTime(stripHtml(cells[3])) : null;
    const tripIdMatch = cells[2].match(TRIP_ID_PATTERN);
    const tripId = tripIdMatch ? Number(tripIdMatch[1]) : null;

    if (!(service && destination && scheduled)) {
      continue;
    }

    rows.push({
      service,
      tripId,
      destination,
      scheduled,
      expected,
    });
  }

  return rows;
}

function sortDepartures(departures: Departure[]): Departure[] {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return departures
    .map((departure, index) => ({
      departure,
      index,
      diff: getDepartureSortDiff(departure, nowMinutes),
    }))
    .sort((a, b) => {
      if (a.diff === b.diff) {
        return a.index - b.index;
      }
      return a.diff < b.diff ? -1 : 1;
    })
    .map(({ departure }) => departure);
}

interface GetStopDeparturesOptions {
  includeOccupancy?: boolean;
}

export async function getStopDepartures(
  atcoCode: string,
  { includeOccupancy = true }: GetStopDeparturesOptions = {}
): Promise<Departure[]> {
  const departuresResponse = await fetchWithTimeout(
    `https://bustimes.org/stops/${atcoCode}/departures`,
    {},
    DEPARTURES_REQUEST_TIMEOUT_MS
  ).catch(() => null);

  let departures: Departure[] = [];

  if (departuresResponse?.ok) {
    try {
      const departuresHtml = await departuresResponse.text();
      departures = parseDeparturesHtml(departuresHtml);
    } catch {
      departures = [];
    }
  }

  if (departures.length === 0) {
    return [];
  }

  if (!includeOccupancy) {
    return sortDepartures(departures);
  }

  const firstApiKey = process.env.EXPO_PUBLIC_FIRST_BUS_API_KEY;
  if (!(firstApiKey && firstApiKey.trim().length > 0)) {
    return sortDepartures(departures);
  }

  const firstBusDepartures = await withProviderTimeout(
    getFirstBusDepartures(atcoCode, firstApiKey),
    FIRST_PROVIDER_TIMEOUT_MS,
    []
  );

  if (firstBusDepartures.length === 0) {
    return sortDepartures(departures);
  }

  return sortDepartures(
    mergeOccupancy(
      departures,
      buildDepartureContexts(departures),
      firstBusDepartures
    )
  );
}
