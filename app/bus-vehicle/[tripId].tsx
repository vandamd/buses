import {
  Camera,
  CircleLayer,
  Images,
  LineLayer,
  MapView,
  ShapeSource,
  SymbolLayer,
} from "@maplibre/maplibre-react-native";
import { router, useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import darkMatterStyle from "@/assets/maps/dark_matter.json";
import positronStyle from "@/assets/maps/positron.json";
import { CenteredMessage } from "@/components/CenteredMessage";
import { Header } from "@/components/Header";
import { SwipeBackContainer } from "@/components/SwipeBackContainer";
import { useInvertColors } from "@/contexts/InvertColorsContext";
import { useVehicleMapData } from "@/hooks/useVehicleMapData";
import { n } from "@/utils/scaling";

const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_KEY || "";
const MAP_CAMERA_PADDING = {
  paddingTop: n(20),
  paddingBottom: n(20),
  paddingLeft: n(20),
  paddingRight: n(20),
};

const VEHICLE_IMAGES = {
  busMarker: require("@/assets/icons/bus-marker.png"),
};

type VehicleMapData = ReturnType<typeof useVehicleMapData>;
type RouteGeoJson = NonNullable<VehicleMapData["routeGeoJson"]>;
type StopsGeoJson = NonNullable<VehicleMapData["stopsGeoJson"]>;
type VehiclesGeoJson = NonNullable<VehicleMapData["vehiclesGeoJson"]>;
type InitialBounds = NonNullable<VehicleMapData["initialBounds"]>;

function injectMapTilerKey(style: unknown) {
  const json = JSON.stringify(style);
  return JSON.parse(json.replace(/MAPTILER_KEY/g, MAPTILER_KEY));
}

const MAP_STYLE_DARK = injectMapTilerKey(darkMatterStyle);
const MAP_STYLE_LIGHT = injectMapTilerKey(positronStyle);

function getRouteLineStyle(invertColors: boolean) {
  return {
    lineCap: "round",
    lineColor: invertColors ? "#000000" : "#ffffff",
    lineJoin: "round",
    lineOpacity: invertColors ? 0.3 : 0.6,
    lineWidth: n(4),
  } as const;
}

function getCurrentStopOuterStyle() {
  return {
    circleColor: "rgba(66, 133, 244, 0.3)",
    circleRadius: ["case", ["get", "isCurrent"], n(12), 0],
  } as const;
}

function getCurrentStopMiddleStyle() {
  return {
    circleColor: "#ffffff",
    circleRadius: ["case", ["get", "isCurrent"], n(10), 0],
  } as const;
}

function getCurrentStopInnerStyle() {
  return {
    circleColor: "#4285F4",
    circleRadius: ["case", ["get", "isCurrent"], n(8), 0],
  } as const;
}

function getStopLabelStyle(invertColors: boolean) {
  return {
    textAnchor: ["case", ["get", "isCurrent"], "left", "center"],
    textColor: invertColors ? "#000000" : "#ffffff",
    textField: ["get", "eta"],
    textHaloColor: invertColors ? "#ffffff" : "#000000",
    textHaloWidth: n(1),
    textOffset: [
      "case",
      ["get", "isCurrent"],
      ["literal", [0.8, 0]],
      ["literal", [0, 0]],
    ],
    textSize: n(14),
  } as const;
}

function getVehicleIconStyle() {
  return {
    iconAllowOverlap: true,
    iconAnchor: "center",
    iconIgnorePlacement: true,
    iconImage: "busMarker",
    iconOpacity: ["case", ["get", "isCurrent"], 1, 0.4],
    iconRotate: ["get", "heading"],
    iconRotationAlignment: "map",
    iconSize: 0.18,
  } as const;
}

function getVehicleLabelStyle() {
  return {
    textAllowOverlap: true,
    textAnchor: "center",
    textColor: "black",
    textField: ["get", "service"],
    textFont: ["literal", ["Noto Sans Regular"]],
    textIgnorePlacement: true,
    textOffset: [0, 0],
    textOpacity: ["case", ["get", "isCurrent"], 1, 0.4],
    textRotate: ["get", "heading"],
    textRotationAlignment: "map",
    textSize: n(10),
  } as const;
}

function VehicleMapShell({
  children,
  title,
}: {
  children?: ReactNode;
  title: string;
}) {
  const { invertColors } = useInvertColors();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    }
  };

  return (
    <SwipeBackContainer enabled onSwipeBack={handleBack}>
      <View
        style={[
          styles.screen,
          { backgroundColor: invertColors ? "white" : "black" },
        ]}
      >
        <Header headerTitle={title} />
        {children ?? <View style={styles.fill} />}
      </View>
    </SwipeBackContainer>
  );
}

function RouteLayer({
  invertColors,
  routeGeoJson,
}: {
  invertColors: boolean;
  routeGeoJson: RouteGeoJson;
}) {
  return (
    <ShapeSource id="route-source" shape={routeGeoJson}>
      <LineLayer id="route-line" style={getRouteLineStyle(invertColors)} />
    </ShapeSource>
  );
}

function StopsLayer({
  invertColors,
  stopsGeoJson,
}: {
  invertColors: boolean;
  stopsGeoJson: StopsGeoJson;
}) {
  return (
    <ShapeSource id="stops-source" shape={stopsGeoJson}>
      <CircleLayer
        id="stops-circles-outer"
        style={getCurrentStopOuterStyle()}
      />
      <CircleLayer
        id="stops-circles-middle"
        style={getCurrentStopMiddleStyle()}
      />
      <CircleLayer id="stops-circles" style={getCurrentStopInnerStyle()} />
      <SymbolLayer id="stops-labels" style={getStopLabelStyle(invertColors)} />
    </ShapeSource>
  );
}

function VehiclesLayer({
  vehiclesGeoJson,
}: {
  vehiclesGeoJson: VehiclesGeoJson;
}) {
  return (
    <ShapeSource id="vehicles-source" shape={vehiclesGeoJson}>
      <SymbolLayer id="vehicle-icon" style={getVehicleIconStyle()} />
      <SymbolLayer id="vehicle-label" style={getVehicleLabelStyle()} />
    </ShapeSource>
  );
}

function VehicleMap({
  initialBounds,
  invertColors,
  routeGeoJson,
  stopsGeoJson,
  vehiclesGeoJson,
}: {
  initialBounds: InitialBounds;
  invertColors: boolean;
  routeGeoJson: VehicleMapData["routeGeoJson"];
  stopsGeoJson: VehicleMapData["stopsGeoJson"];
  vehiclesGeoJson: VehicleMapData["vehiclesGeoJson"];
}) {
  return (
    <MapView
      attributionEnabled={false}
      logoEnabled={false}
      mapStyle={invertColors ? MAP_STYLE_LIGHT : MAP_STYLE_DARK}
      style={styles.fill}
    >
      <Camera
        defaultSettings={{
          bounds: initialBounds,
          padding: MAP_CAMERA_PADDING,
        }}
      />

      <Images images={VEHICLE_IMAGES} />

      {routeGeoJson && (
        <RouteLayer invertColors={invertColors} routeGeoJson={routeGeoJson} />
      )}
      {stopsGeoJson && (
        <StopsLayer invertColors={invertColors} stopsGeoJson={stopsGeoJson} />
      )}
      {vehiclesGeoJson && <VehiclesLayer vehiclesGeoJson={vehiclesGeoJson} />}
    </MapView>
  );
}

export default function VehicleMapScreen() {
  const { tripId, service, destination, stopAtcoCode } = useLocalSearchParams<{
    tripId: string;
    service: string;
    destination: string;
    stopAtcoCode: string;
  }>();
  const { invertColors } = useInvertColors();
  const {
    routeGeoJson,
    stopsGeoJson,
    vehiclesGeoJson,
    initialBounds,
    isLoading,
    error,
  } = useVehicleMapData({
    mapEnabled: Boolean(MAPTILER_KEY),
    stopAtcoCode,
    tripId,
  });

  const headerTitle = service
    ? `${service} to ${destination}`
    : "Vehicle Tracking";

  if (isLoading) {
    return <VehicleMapShell title={headerTitle} />;
  }

  if (error || !initialBounds) {
    return (
      <VehicleMapShell title={headerTitle}>
        <CenteredMessage message={error || "Could not load route."} />
      </VehicleMapShell>
    );
  }

  return (
    <VehicleMapShell title={headerTitle}>
      <VehicleMap
        initialBounds={initialBounds}
        invertColors={invertColors}
        routeGeoJson={routeGeoJson}
        stopsGeoJson={stopsGeoJson}
        vehiclesGeoJson={vehiclesGeoJson}
      />
    </VehicleMapShell>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: n(10)
  },
  fill: {
    flex: 1,
  },
});
