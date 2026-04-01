import { CenteredMessage } from "@/components/CenteredMessage";
import ContentContainer from "@/components/ContentContainer";
import { ReorderItem } from "@/components/ReorderItem";
import { useSavedStops } from "@/contexts/SavedStopsContext";
import { getStopDisplayName } from "@/utils/stops";

export default function ReorderStopsScreen() {
  const { savedStops, isLoading, reorderStop } = useSavedStops();

  if (isLoading) {
    return <ContentContainer headerTitle="Reorder Stops" />;
  }

  if (savedStops.length === 0) {
    return (
      <ContentContainer headerTitle="Reorder Stops">
        <CenteredMessage message="No saved stops" />
      </ContentContainer>
    );
  }

  return (
    <ContentContainer contentGap={8} headerTitle="Reorder Stops">
      {savedStops.map((item, index) => (
        <ReorderItem
          isFirst={index === 0}
          isLast={index === savedStops.length - 1}
          key={item.atco_code}
          label={getStopDisplayName(item)}
          onMoveDown={() => reorderStop(item.atco_code, "down")}
          onMoveUp={() => reorderStop(item.atco_code, "up")}
        />
      ))}
    </ContentContainer>
  );
}
