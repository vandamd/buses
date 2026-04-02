import { Logger } from "@maplibre/maplibre-react-native";
import { Stack } from "expo-router";
import { StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  InvertColorsProvider,
  useInvertColors,
} from "@/contexts/InvertColorsContext";
import { SavedStopsProvider } from "@/contexts/SavedStopsContext";

const MAPLIBRE_CANCELED_REQUESTS = [
  "Request failed due to a permanent error: Canceled",
  "Request failed due to a permanent error: stream was reset: CANCEL",
] as const;

Logger.setLogCallback((log) => {
  return (
    log.tag === "Mbgl-HttpRequest" &&
    MAPLIBRE_CANCELED_REQUESTS.some((message) =>
      log.message.startsWith(message)
    )
  );
});

function RootNavigation() {
  const { invertColors } = useInvertColors();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "none",
        contentStyle: {
          backgroundColor: invertColors ? "white" : "black",
        },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="search-results" />
      <Stack.Screen name="bus-stop/[atcoCode]" />
      <Stack.Screen name="reorder-stops" />
      <Stack.Screen name="bus-vehicle/[tripId]" />
    </Stack>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <InvertColorsProvider>
        <SavedStopsProvider>
          <StatusBar hidden />
          <RootNavigation />
        </SavedStopsProvider>
      </InvertColorsProvider>
    </GestureHandlerRootView>
  );
}
