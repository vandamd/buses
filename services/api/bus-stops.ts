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
  occupancySource?: "first" | "bods";
  occupancyStatus?: "seatsAvailable" | "standingAvailable" | "full";
  scheduled: string;
  service: string;
  tripId: number | null;
}

interface TimesApiResponse {
  times: Array<{
    trip_id: number | null;
    service: {
      line_name: string;
      operators?: Array<{
        id?: string | null;
      }>;
    };
    destination: {
      name: string;
      locality: string;
      atco_code?: string | null;
    };
    aimed_departure_time: string | null;
    expected_departure_time: string | null;
  }>;
}

function formatTime(isoString: string | null): string | null {
  if (!isoString) {
    return null;
  }
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
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
  destinationRef?: string;
  lineRef: string;
  operatorRef?: string;
  scheduledMinutes: number | null;
}

type OccupancyStatus = NonNullable<Departure["occupancyStatus"]>;

interface BodsOccupancyRecord {
  aimedDepartureMinutes: number | null;
  destinationRef?: string;
  lineRef: string;
  occupancyStatus: OccupancyStatus;
  operatorRef?: string;
}

interface TimesMatchRecord {
  destinationName?: string;
  destinationRef?: string;
  expectedMinutes: number | null;
  lineRef: string;
  operatorRef?: string;
  scheduledMinutes: number | null;
  tripId: number | null;
}

interface DepartureMatchContext {
  destinationName?: string;
  destinationRef?: string;
  expectedMinutes: number | null;
  lineRef?: string;
  operatorRef?: string;
  scheduledMinutes: number | null;
}

interface BodsQuery {
  destinationRef?: string;
  lineRef: string;
  operatorRef: string;
}

const FIRST_BUS_API_HOST = "https://prod.mobileapi.firstbus.co.uk";
const BODS_DATAFEED_URL = "https://data.bus-data.dft.gov.uk/api/v1/datafeed/";
const FIRST_REQUEST_TIMEOUT_MS = 3500;
const BODS_REQUEST_TIMEOUT_MS = 4500;
const FIRST_PROVIDER_TIMEOUT_MS = 4500;
const BODS_PROVIDER_TIMEOUT_MS = 7000;
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

function normalizeOperatorRef(
  value: string | null | undefined
): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  return normalized || undefined;
}

function normalizeStopRef(
  value: string | null | undefined
): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
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
          operatorRef: normalizeOperatorRef(dep.operator),
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

function buildTimesMatchRecords(
  times: TimesApiResponse["times"]
): TimesMatchRecord[] {
  const records: TimesMatchRecord[] = [];

  for (const time of times) {
    const lineRef = normalizeLineRef(time.service?.line_name);
    if (!lineRef) {
      continue;
    }

    records.push({
      tripId: time.trip_id,
      lineRef,
      scheduledMinutes: isoToMinutes(time.aimed_departure_time),
      expectedMinutes: isoToMinutes(time.expected_departure_time),
      operatorRef: normalizeOperatorRef(time.service?.operators?.[0]?.id),
      destinationRef: normalizeStopRef(time.destination?.atco_code),
      destinationName: normalizeText(
        time.destination?.locality || time.destination?.name
      ),
    });
  }

  return records;
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

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: occupancy matching uses weighted heuristics.
function findBestTimesMatchRecord(
  departure: Departure,
  lineRef: string | undefined,
  scheduledMinutes: number | null,
  expectedMinutes: number | null,
  timesRecords: TimesMatchRecord[]
): TimesMatchRecord | undefined {
  if (departure.tripId !== null) {
    const byTrip = timesRecords.find(
      (record) => record.tripId === departure.tripId
    );
    if (byTrip) {
      return byTrip;
    }
  }

  if (!lineRef) {
    return undefined;
  }

  const targetMinutes = scheduledMinutes ?? expectedMinutes;
  const destinationName = normalizeText(departure.destination);

  let best: TimesMatchRecord | undefined;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const record of timesRecords) {
    if (record.lineRef !== lineRef) {
      continue;
    }

    if (targetMinutes !== null) {
      const recordMinutes = record.scheduledMinutes ?? record.expectedMinutes;
      if (recordMinutes === null) {
        continue;
      }

      const diff = minuteDiff(recordMinutes, targetMinutes);
      if (diff > 8) {
        continue;
      }

      const score =
        diff + getDestinationPenalty(destinationName, record.destinationName);
      if (score < bestScore) {
        bestScore = score;
        best = record;
      }
      continue;
    }

    if (!best) {
      best = record;
    }
  }

  return best;
}

function buildDepartureContexts(
  departures: Departure[],
  timesRecords: TimesMatchRecord[]
): DepartureMatchContext[] {
  return departures.map((departure) => {
    const lineRef = normalizeLineRef(departure.service);
    const scheduledMinutes = timeToMinutesOrNull(departure.scheduled);
    const expectedMinutes = timeToMinutesOrNull(departure.expected);
    const matchedTimesRecord = findBestTimesMatchRecord(
      departure,
      lineRef,
      scheduledMinutes,
      expectedMinutes,
      timesRecords
    );

    return {
      lineRef,
      scheduledMinutes,
      expectedMinutes,
      operatorRef: matchedTimesRecord?.operatorRef,
      destinationRef: matchedTimesRecord?.destinationRef,
      destinationName: matchedTimesRecord?.destinationName,
    };
  });
}

function enrichFirstDepartureWithDestinationRef(
  departure: FirstBusDeparture,
  timesRecords: TimesMatchRecord[]
): FirstBusDeparture {
  if (departure.scheduledMinutes === null) {
    return departure;
  }

  let bestDestinationRef: string | undefined;
  let bestDestinationName = departure.destinationName;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const record of timesRecords) {
    if (record.lineRef !== departure.lineRef) {
      continue;
    }
    if (record.scheduledMinutes === null) {
      continue;
    }
    if (!record.destinationRef) {
      continue;
    }
    if (
      departure.operatorRef &&
      record.operatorRef &&
      departure.operatorRef !== record.operatorRef
    ) {
      continue;
    }

    const diff = minuteDiff(
      record.scheduledMinutes,
      departure.scheduledMinutes
    );
    if (diff > 5) {
      continue;
    }

    const score =
      diff +
      getDestinationPenalty(departure.destinationName, record.destinationName);

    if (score < bestScore) {
      bestScore = score;
      bestDestinationRef = record.destinationRef;
      bestDestinationName = record.destinationName ?? bestDestinationName;
    }
  }

  if (!bestDestinationRef) {
    return departure;
  }

  return {
    ...departure,
    destinationRef: bestDestinationRef,
    destinationName: bestDestinationName,
  };
}

function enrichFirstWithDestinationRefs(
  firstDepartures: FirstBusDeparture[],
  timesRecords: TimesMatchRecord[]
): FirstBusDeparture[] {
  return firstDepartures.map((departure) =>
    enrichFirstDepartureWithDestinationRef(departure, timesRecords)
  );
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

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractXmlTagValue(xml: string, tagName: string): string | null {
  const regex = new RegExp(
    `<(?:\\w+:)?${tagName}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${tagName}>`,
    "i"
  );
  const match = xml.match(regex);
  if (!match) {
    return null;
  }

  return decodeXmlEntities(match[1]).trim();
}

function normalizeBodsOccupancyStatus(
  value: string | null
): OccupancyStatus | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, "").trim().toLowerCase();
  if (normalized === "seatsavailable") {
    return "seatsAvailable";
  }
  if (normalized === "standingavailable") {
    return "standingAvailable";
  }
  if (normalized === "full") {
    return "full";
  }

  return null;
}

function parseBodsVehicleActivity(xml: string): BodsOccupancyRecord[] {
  const activityRegex =
    /<(?:\w+:)?VehicleActivity\b[\s\S]*?<\/(?:\w+:)?VehicleActivity>/gi;
  const activities = xml.match(activityRegex);
  if (!activities) {
    return [];
  }

  const records: BodsOccupancyRecord[] = [];

  for (const activity of activities) {
    const occupancyStatus = normalizeBodsOccupancyStatus(
      extractXmlTagValue(activity, "Occupancy")
    );
    if (!occupancyStatus) {
      continue;
    }

    const lineRef = normalizeLineRef(
      extractXmlTagValue(activity, "PublishedLineName") ||
        extractXmlTagValue(activity, "LineRef")
    );
    if (!lineRef) {
      continue;
    }

    records.push({
      operatorRef: normalizeOperatorRef(
        extractXmlTagValue(activity, "OperatorRef")
      ),
      lineRef,
      destinationRef: normalizeStopRef(
        extractXmlTagValue(activity, "DestinationRef")
      ),
      aimedDepartureMinutes: isoToMinutes(
        extractXmlTagValue(activity, "OriginAimedDepartureTime")
      ),
      occupancyStatus,
    });
  }

  return records;
}

function buildBodsQueries(contexts: DepartureMatchContext[]): BodsQuery[] {
  const uniqueQueries = new Map<string, BodsQuery>();

  for (const context of contexts) {
    if (!(context.operatorRef && context.lineRef)) {
      continue;
    }

    const key = `${context.operatorRef}|${context.lineRef}|${context.destinationRef || ""}`;
    if (!uniqueQueries.has(key)) {
      uniqueQueries.set(key, {
        operatorRef: context.operatorRef,
        lineRef: context.lineRef,
        destinationRef: context.destinationRef,
      });
    }
  }

  return [...uniqueQueries.values()];
}

async function getBodsOccupancy(
  queries: BodsQuery[],
  apiKey: string
): Promise<BodsOccupancyRecord[]> {
  if (queries.length === 0) {
    return [];
  }

  const queryResults = await Promise.all(
    queries.map(async (query) => {
      const url = new URL(BODS_DATAFEED_URL);
      url.searchParams.set("operatorRef", query.operatorRef);
      url.searchParams.set("lineRef", query.lineRef);
      if (query.destinationRef) {
        url.searchParams.set("destinationRef", query.destinationRef);
      }

      try {
        const response = await fetchWithTimeout(
          url.toString(),
          {
            headers: {
              Authorization: `Token ${apiKey}`,
            },
          },
          BODS_REQUEST_TIMEOUT_MS
        );

        if (!response.ok) {
          return [];
        }

        const xml = await response.text();
        return parseBodsVehicleActivity(xml);
      } catch {
        return [];
      }
    })
  );

  return queryResults.flat();
}

function getMatchingMinutes(context: DepartureMatchContext): number | null {
  return context.scheduledMinutes ?? context.expectedMinutes;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: occupancy matching uses weighted heuristics.
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
    if (
      context.operatorRef &&
      candidate.operatorRef &&
      context.operatorRef !== candidate.operatorRef
    ) {
      continue;
    }

    const diff = minuteDiff(candidate.scheduledMinutes, targetMinutes);
    if (diff > 5) {
      continue;
    }

    let score = diff;
    if (context.destinationRef && candidate.destinationRef) {
      if (context.destinationRef === candidate.destinationRef) {
        score -= 0.5;
      } else {
        score += 8;
      }
    } else {
      score += getDestinationPenalty(
        context.destinationName,
        candidate.destinationName
      );
    }

    if (score < bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex >= 0 ? bestIndex : null;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: occupancy matching uses weighted heuristics.
function findBestBodsMatch(
  context: DepartureMatchContext,
  bodsRecords: BodsOccupancyRecord[]
): BodsOccupancyRecord | null {
  const targetMinutes = getMatchingMinutes(context);
  if (!context.lineRef || targetMinutes === null) {
    return null;
  }

  let bestExact: { record: BodsOccupancyRecord; score: number } | null = null;
  let bestLoose: { record: BodsOccupancyRecord; score: number } | null = null;

  for (const record of bodsRecords) {
    if (record.lineRef !== context.lineRef) {
      continue;
    }
    if (record.aimedDepartureMinutes === null) {
      continue;
    }
    if (
      context.operatorRef &&
      record.operatorRef &&
      context.operatorRef !== record.operatorRef
    ) {
      continue;
    }

    const diff = minuteDiff(record.aimedDepartureMinutes, targetMinutes);
    if (diff > 10) {
      continue;
    }

    const destinationExact =
      !!context.destinationRef &&
      !!record.destinationRef &&
      context.destinationRef === record.destinationRef;
    const destinationMismatch =
      !!context.destinationRef &&
      !!record.destinationRef &&
      context.destinationRef !== record.destinationRef;
    const score = diff + (destinationMismatch ? 4 : 0);

    if (destinationExact) {
      if (!bestExact || score < bestExact.score) {
        bestExact = { record, score };
      }
    } else if (!bestLoose || score < bestLoose.score) {
      bestLoose = { record, score };
    }
  }

  return bestExact?.record ?? bestLoose?.record ?? null;
}

function mergeOccupancy(
  departures: Departure[],
  contexts: DepartureMatchContext[],
  firstDepartures: FirstBusDeparture[],
  bodsRecords: BodsOccupancyRecord[]
): { departures: Departure[]; firstMatches: number; bodsMatches: number } {
  let firstMatches = 0;
  let bodsMatches = 0;
  const usedFirstIndexes = new Set<number>();

  const mergedDepartures = departures.map((departure, index) => {
    const context = contexts[index];

    const firstMatchIndex = findBestFirstMatchIndex(
      context,
      firstDepartures,
      usedFirstIndexes
    );
    if (firstMatchIndex !== null) {
      usedFirstIndexes.add(firstMatchIndex);
      firstMatches += 1;
      return {
        ...departure,
        availableSeats: firstDepartures[firstMatchIndex].availableSeats,
        occupancySource: "first" as const,
        occupancyStatus: undefined,
      };
    }

    const bodsMatch = findBestBodsMatch(context, bodsRecords);
    if (bodsMatch) {
      bodsMatches += 1;
      return {
        ...departure,
        availableSeats: undefined,
        occupancySource: "bods" as const,
        occupancyStatus: bodsMatch.occupancyStatus,
      };
    }

    return departure;
  });

  return { departures: mergedDepartures, firstMatches, bodsMatches };
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

export async function getStopDepartures(
  atcoCode: string
): Promise<Departure[]> {
  const firstApiKey = process.env.EXPO_PUBLIC_FIRST_BUS_API_KEY;
  const bodsApiKey = process.env.EXPO_PUBLIC_BODS_API_KEY;

  const firstBusDeparturesPromise =
    firstApiKey && firstApiKey.trim().length > 0
      ? withProviderTimeout(
          getFirstBusDepartures(atcoCode, firstApiKey),
          FIRST_PROVIDER_TIMEOUT_MS,
          []
        )
      : Promise.resolve<FirstBusDeparture[]>([]);

  const [departuresResponse, timesResponse] = await Promise.all([
    fetch(`https://bustimes.org/stops/${atcoCode}/departures`).catch(
      () => null
    ),
    fetch(`https://bustimes.org/stops/${atcoCode}/times.json`).catch(
      () => null
    ),
  ]);

  let departures: Departure[] = [];
  let timesData: TimesApiResponse | null = null;

  if (departuresResponse?.ok) {
    try {
      const departuresHtml = await departuresResponse.text();
      departures = parseDeparturesHtml(departuresHtml);
    } catch {
      departures = [];
    }
  }

  if (timesResponse?.ok) {
    try {
      timesData = await timesResponse.json();
    } catch {
      timesData = null;
    }
  }

  const times = Array.isArray(timesData?.times) ? timesData.times : [];
  const timesRecords = buildTimesMatchRecords(times);

  if (departures.length === 0 && times.length > 0) {
    departures = times.map((time) => {
      const expected = formatTime(time.expected_departure_time);
      const scheduled =
        formatTime(time.aimed_departure_time) ?? expected ?? "--:--";

      return {
        service: time.service.line_name,
        tripId: time.trip_id,
        destination: time.destination.locality || time.destination.name,
        scheduled,
        expected,
      };
    });
  }

  if (departures.length === 0) {
    return [];
  }

  const departureContexts = buildDepartureContexts(departures, timesRecords);

  const bodsPromise =
    bodsApiKey && bodsApiKey.trim().length > 0
      ? withProviderTimeout(
          getBodsOccupancy(buildBodsQueries(departureContexts), bodsApiKey),
          BODS_PROVIDER_TIMEOUT_MS,
          []
        )
      : Promise.resolve<BodsOccupancyRecord[]>([]);

  const [rawFirstBusDepartures, bodsRecords] = await Promise.all([
    firstBusDeparturesPromise,
    bodsPromise,
  ]);
  const firstBusDepartures = enrichFirstWithDestinationRefs(
    rawFirstBusDepartures,
    timesRecords
  );

  const {
    departures: departuresWithOccupancy,
    firstMatches,
    bodsMatches,
  } = mergeOccupancy(
    departures,
    departureContexts,
    firstBusDepartures,
    bodsRecords
  );

  const isDev = process.env.NODE_ENV !== "production";
  if (isDev) {
    const total = departuresWithOccupancy.length;
    const unmatched = total - firstMatches - bodsMatches;
    console.log(
      `[occupancy] stop=${atcoCode} total=${total} first=${firstMatches} bods=${bodsMatches} unmatched=${unmatched}`
    );
  }

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return departuresWithOccupancy
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
