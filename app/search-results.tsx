import { router, useLocalSearchParams } from "expo-router";
import { CenteredMessage } from "@/components/CenteredMessage";
import ContentContainer from "@/components/ContentContainer";
import { ListItem } from "@/components/ListItem";
import { useStopSearchResults } from "@/hooks/useStopSearchResults";
import type { LocalStopResult } from "@/services/localStopSearch";
import { getStopDisplayName } from "@/utils/stops";

export default function SearchResultsScreen() {
  const { query = "" } = useLocalSearchParams<{ query?: string }>();
  const { results, isLoading, error, trimmedQuery } =
    useStopSearchResults(query);
  const headerTitle = trimmedQuery
    ? `Results for "${trimmedQuery}"`
    : "Search Results";

  const handleStopPress = (stop: LocalStopResult) => {
    router.push({
      pathname: "/bus-stop/[atcoCode]",
      params: {
        atcoCode: stop.atco_code,
        stopName: getStopDisplayName(stop),
      },
    });
  };

  if (!trimmedQuery) {
    return (
      <ContentContainer contentGap={8} headerTitle={headerTitle}>
        <CenteredMessage
          hint="Enter a stop name and run a search."
          message="No search query"
        />
      </ContentContainer>
    );
  }

  if (error) {
    return (
      <ContentContainer contentGap={8} headerTitle={headerTitle}>
        <CenteredMessage message={error.message} />
      </ContentContainer>
    );
  }

  if (isLoading) {
    return <ContentContainer contentGap={8} headerTitle={headerTitle} />;
  }

  if (results.length === 0) {
    return (
      <ContentContainer contentGap={8} headerTitle={headerTitle}>
        <CenteredMessage message={`No stops found for "${trimmedQuery}"`} />
      </ContentContainer>
    );
  }

  return (
    <ContentContainer contentGap={8} headerTitle={headerTitle}>
      {results.map((item) => (
        <ListItem
          key={item.atco_code}
          onPress={() => handleStopPress(item)}
          primaryText={getStopDisplayName(item)}
          secondaryText={item.locality}
        />
      ))}
    </ContentContainer>
  );
}
