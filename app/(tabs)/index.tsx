import { router } from "expo-router";
import { CenteredMessage } from "@/components/CenteredMessage";
import ContentContainer from "@/components/ContentContainer";
import { ListItem } from "@/components/ListItem";
import { useSavedStops } from "@/contexts/SavedStopsContext";
import { useCurrentTime } from "@/hooks/useCurrentTime";
import { useSavedStopsNextDepartures } from "@/hooks/useSavedStopsNextDepartures";
import type { SavedStop } from "@/types/stop";
import { getStopDisplayName, getStopListSecondaryText } from "@/utils/stops";

export default function BusStopsTab() {
  const { savedStops, isLoading } = useSavedStops();
  const currentTime = useCurrentTime();
  const nextDepartures = useSavedStopsNextDepartures(savedStops);
  const containerProps = {
    contentGap: 8,
    headerTitle: currentTime,
    hideBackButton: true,
    rightAction: {
      icon: "swap-vert" as const,
      onPress: () => router.push("/reorder-stops"),
      show: savedStops.length > 1,
    },
  };

  const handleStopPress = (stop: SavedStop) => {
    router.push({
      pathname: "/bus-stop/[atcoCode]",
      params: {
        atcoCode: stop.atco_code,
        stopName: getStopDisplayName(stop),
        lineNames: stop.line_names.join(","),
      },
    });
  };

  if (isLoading) {
    return <ContentContainer {...containerProps} />;
  }

  if (savedStops.length === 0) {
    return (
      <ContentContainer {...containerProps}>
        <CenteredMessage
          hint="Open the Search tab to add your first stop."
          message="No saved stops"
        />
      </ContentContainer>
    );
  }

  return (
    <ContentContainer {...containerProps}>
      {savedStops.map((item) => (
        <ListItem
          key={item.atco_code}
          onPress={() => handleStopPress(item)}
          primaryText={getStopDisplayName(item)}
          secondaryText={getStopListSecondaryText(
            item,
            nextDepartures[item.atco_code]
          )}
        />
      ))}
    </ContentContainer>
  );
}
