import type { Departure } from "@/services/api/bus-stops";

const ROUTE_PREVIEW_LIMIT = 9;

interface StopNameLike {
  common_name: string;
  indicator?: string | null;
}

interface StopRoutesLike {
  line_names?: string[] | null;
}

export function getStopDisplayName(stop: StopNameLike): string {
  return stop.indicator
    ? `${stop.common_name} (${stop.indicator})`
    : stop.common_name;
}

export function getStopListSecondaryText(
  stop: StopRoutesLike,
  nextDeparture?: Departure | null
): string {
  if (nextDeparture) {
    const timeText =
      nextDeparture.expected &&
      nextDeparture.expected !== nextDeparture.scheduled
        ? `${nextDeparture.expected} (${nextDeparture.scheduled})`
        : nextDeparture.scheduled;

    return `${timeText}, ${nextDeparture.destination} (${nextDeparture.service})`;
  }

  const routeCount = stop.line_names?.length || 0;
  const routePreview =
    stop.line_names?.slice(0, ROUTE_PREVIEW_LIMIT).join(", ") || "";

  return routeCount > 0
    ? routePreview +
        (routeCount > ROUTE_PREVIEW_LIMIT
          ? ` +${routeCount - ROUTE_PREVIEW_LIMIT}`
          : "")
    : "No routes listed";
}
