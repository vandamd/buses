import { MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { type ReactNode, useCallback, useState } from "react";
import type { StyleProp, TextStyle } from "react-native";
import { StyleSheet, View } from "react-native";
import { CenteredMessage } from "@/components/CenteredMessage";
import ContentContainer from "@/components/ContentContainer";
import { HapticPressable } from "@/components/HapticPressable";
import { StyledText } from "@/components/StyledText";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { useSavedStops } from "@/contexts/SavedStopsContext";
import { useCurrentTime } from "@/hooks/useCurrentTime";
import { useStopDetails } from "@/hooks/useStopDetails";
import type { Departure } from "@/services/api/bus-stops";
import { n } from "@/utils/scaling";
import { getStopDisplayName, parseLineNamesParam } from "@/utils/stops";

interface DetailSectionProps {
  children: ReactNode;
  title: string;
}

interface TimetableRowProps {
  departure: Departure;
  isServiceWidthReady: boolean;
  onMeasureServiceWidth: (service: string, width: number) => void;
  serviceWidth?: number;
  stopAtcoCode: string;
}

interface TimetableSectionProps {
  atcoCode: string;
  departures: Departure[];
}

function DetailSection({ title, children }: DetailSectionProps) {
  return (
    <View style={styles.section}>
      <StyledText style={styles.sectionHeader}>{title}</StyledText>
      {children}
    </View>
  );
}

function StopNameSection({ stopName }: { stopName: string }) {
  return (
    <DetailSection title="Bus Stop">
      <StyledText style={styles.largeText}>{stopName}</StyledText>
    </DetailSection>
  );
}

function ServicesSection({ routes }: { routes: string[] }) {
  if (routes.length === 0) {
    return null;
  }

  return (
    <DetailSection title="Services">
      <StyledText style={styles.largeText}>{routes.join(", ")}</StyledText>
    </DetailSection>
  );
}

function getDepartureKey(departure: Departure): string {
  return [
    departure.tripId ?? "no-trip",
    departure.service,
    departure.scheduled,
    departure.destination,
  ].join("-");
}

function getDepartureMetaText(departure: Departure): string {
  const metaParts = [departure.scheduled];

  if (departure.expected && departure.expected !== departure.scheduled) {
    metaParts.push(`Expected ${departure.expected}`);
  }

  return metaParts.join(" · ");
}

function TimetableRow({
  departure,
  isServiceWidthReady,
  onMeasureServiceWidth,
  serviceWidth,
  stopAtcoCode,
}: TimetableRowProps) {
  const { invertColors } = useInvertColors();
  const tripId = departure.tripId;
  const canTrack = tripId !== null;
  const textStyle: StyleProp<TextStyle> = canTrack ? undefined : styles.dimmed;
  const destinationText = departure.destination;

  const handlePress = () => {
    if (tripId === null) {
      return;
    }

    router.push({
      pathname: "/bus-vehicle/[tripId]",
      params: {
        tripId: tripId.toString(),
        service: departure.service,
        destination: destinationText,
        stopAtcoCode,
      },
    });
  };

  const seatInfo =
    departure.availableSeats === undefined ? null : (
      <View style={styles.seatInfo}>
        <MaterialIcons
          color={invertColors ? "black" : "white"}
          name="airline-seat-legroom-normal"
          size={n(14)}
        />
        <StyledText style={styles.seatText}>
          {departure.availableSeats}
        </StyledText>
      </View>
    );

  return (
    <HapticPressable
      disabled={!(canTrack && isServiceWidthReady)}
      onPress={handlePress}
      style={[
        styles.departureRow,
        !isServiceWidthReady && styles.departureRowHidden,
      ]}
    >
      <StyledText
        onLayout={(event) =>
          onMeasureServiceWidth(
            departure.service,
            event.nativeEvent.layout.width
          )
        }
        style={styles.departureServiceMeasure}
      >
        {departure.service}
      </StyledText>
      <StyledText
        style={[
          styles.departureService,
          serviceWidth ? { width: serviceWidth } : undefined,
          textStyle,
        ]}
      >
        {departure.service}
      </StyledText>
      <View style={styles.departureInfo}>
        <StyledText
          numberOfLines={1}
          style={[styles.departureDestination, textStyle]}
        >
          {destinationText}
        </StyledText>
        <View style={styles.departureMetaRow}>
          <StyledText style={[styles.departureMetaText, textStyle]}>
            {getDepartureMetaText(departure)}
          </StyledText>
          {seatInfo}
        </View>
      </View>
    </HapticPressable>
  );
}

function TimetableSection({ atcoCode, departures }: TimetableSectionProps) {
  const [serviceWidths, setServiceWidths] = useState<Record<string, number>>(
    {}
  );

  const handleMeasureServiceWidth = useCallback(
    (service: string, width: number) => {
      setServiceWidths((current) => {
        if ((current[service] ?? 0) >= width) {
          return current;
        }

        return {
          ...current,
          [service]: width,
        };
      });
    },
    []
  );

  const uniqueServices = Array.from(
    new Set(departures.map((departure) => departure.service))
  );
  const areAllServiceWidthsMeasured = uniqueServices.every((service) => {
    return serviceWidths[service] !== undefined;
  });

  const serviceWidth =
    departures.reduce((widest, departure) => {
      return Math.max(widest, serviceWidths[departure.service] ?? 0);
    }, 0) || undefined;

  return (
    <DetailSection title="Timetable">
      {departures.length > 0 ? (
        departures.map((departure) => (
          <TimetableRow
            departure={departure}
            isServiceWidthReady={areAllServiceWidthsMeasured}
            key={getDepartureKey(departure)}
            onMeasureServiceWidth={handleMeasureServiceWidth}
            serviceWidth={serviceWidth}
            stopAtcoCode={atcoCode}
          />
        ))
      ) : (
        <StyledText style={styles.largeText}>No upcoming departures</StyledText>
      )}
    </DetailSection>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <ContentContainer headerTitle="Error">
      <CenteredMessage message={message} />
    </ContentContainer>
  );
}

export default function StopDetailScreen() {
  const {
    atcoCode,
    stopName: passedStopName,
    lineNames: passedLineNames,
  } = useLocalSearchParams<{
    atcoCode: string;
    stopName?: string;
    lineNames?: string;
  }>();
  const currentTime = useCurrentTime();
  const { addStop, removeStop, isStopSaved } = useSavedStops();
  const { stop, departures, isLoading, error } = useStopDetails(atcoCode);

  const isSaved = stop ? isStopSaved(stop.atco_code) : false;
  const fallbackRoutes = parseLineNamesParam(passedLineNames);

  const handleToggleSave = () => {
    if (!stop) {
      return;
    }
    if (isSaved) {
      removeStop(stop.atco_code);
      return;
    }
    addStop(stop);
  };

  const stopName = stop ? getStopDisplayName(stop) : (passedStopName ?? "Stop");
  const routes = stop?.line_names ?? fallbackRoutes;

  if (isLoading) {
    return (
        <ContentContainer headerTitle={currentTime}>
          <CenteredMessage message={"Loading..."} />
        </ContentContainer>
    );
  }

  if (error || !stop) {
    return <ErrorState message={error?.message || "Failed to load stop"} />;
  }

  return (
    <ContentContainer
      contentGap={20}
      headerTitle={currentTime}
      rightAction={{
        icon: isSaved ? "star" : "star-border",
        onPress: handleToggleSave,
      }}
    >
      <StopNameSection stopName={stopName} />
      <ServicesSection routes={routes} />
      <TimetableSection atcoCode={atcoCode} departures={departures} />
    </ContentContainer>
  );
}

const styles = StyleSheet.create({
  departureDestination: {
    fontSize: n(26),
  },
  departureInfo: {
    flex: 1,
    paddingRight: n(10),
  },
  departureMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: n(6),
  },
  departureMetaText: {
    fontSize: n(16),
    lineHeight: n(18),
  },
  departureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    position: "relative",
    width: "100%",
  },
  departureRowHidden: {
    opacity: 0,
  },
  departureService: {
    fontSize: n(26),
    paddingRight: n(8),
  },
  departureServiceMeasure: {
    fontSize: n(26),
    paddingRight: n(16),
    opacity: 0,
    position: "absolute",
    left: 0,
    top: 0,
  },
  dimmed: {
    color: "gray",
  },
  largeText: {
    fontSize: n(26),
    paddingRight: n(10),
  },
  section: {
    alignSelf: "stretch",
  },
  sectionHeader: {
    fontSize: n(16),
    marginBottom: n(4),
  },
  seatInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: n(8),
  },
  seatText: {
    fontSize: n(14),
    marginLeft: n(2),
  },
});
