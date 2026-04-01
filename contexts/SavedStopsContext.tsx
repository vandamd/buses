import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { BusStop, SavedStop } from "@/types/stop";

const STORAGE_KEY = "@buses/saved_stops";
const noop = () => undefined;

interface SavedStopsContextType {
  addStop: (stop: BusStop) => void;
  isLoading: boolean;
  isStopSaved: (atcoCode: string) => boolean;
  removeStop: (atcoCode: string) => void;
  reorderStop: (atcoCode: string, direction: "up" | "down") => void;
  savedStops: SavedStop[];
}

const SavedStopsContext = createContext<SavedStopsContextType>({
  savedStops: [],
  isLoading: true,
  addStop: noop,
  removeStop: noop,
  isStopSaved: () => false,
  reorderStop: noop,
});

export const useSavedStops = () => useContext(SavedStopsContext);

export const SavedStopsProvider = ({ children }: { children: ReactNode }) => {
  const [savedStops, setSavedStops] = useState<SavedStop[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      if (value !== null) {
        setSavedStops(JSON.parse(value));
      }
      setIsLoading(false);
    });
  }, []);

  const persistStops = useCallback(async (stops: SavedStop[]) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stops));
  }, []);

  const addStop = useCallback(
    (stop: BusStop) => {
      const newSavedStop: SavedStop = {
        atco_code: stop.atco_code,
        common_name: stop.common_name,
        indicator: stop.indicator,
        line_names: stop.line_names || [],
        location: stop.location,
        saved_at: new Date().toISOString(),
      };

      setSavedStops((prev) => {
        if (prev.some((s) => s.atco_code === stop.atco_code)) {
          return prev;
        }
        const updated = [newSavedStop, ...prev];
        persistStops(updated);
        return updated;
      });
    },
    [persistStops]
  );

  const removeStop = useCallback(
    (atcoCode: string) => {
      setSavedStops((prev) => {
        const updated = prev.filter((s) => s.atco_code !== atcoCode);
        persistStops(updated);
        return updated;
      });
    },
    [persistStops]
  );

  const isStopSaved = useCallback(
    (atcoCode: string) => {
      return savedStops.some((s) => s.atco_code === atcoCode);
    },
    [savedStops]
  );

  const reorderStop = useCallback(
    (atcoCode: string, direction: "up" | "down") => {
      setSavedStops((prev) => {
        const currentIndex = prev.findIndex((s) => s.atco_code === atcoCode);
        if (currentIndex === -1) {
          return prev;
        }
        if (direction === "up" && currentIndex === 0) {
          return prev;
        }
        if (direction === "down" && currentIndex === prev.length - 1) {
          return prev;
        }

        const newIndex =
          direction === "up" ? currentIndex - 1 : currentIndex + 1;
        const updated = [...prev];
        const [item] = updated.splice(currentIndex, 1);
        updated.splice(newIndex, 0, item);
        persistStops(updated);
        return updated;
      });
    },
    [persistStops]
  );

  const value = useMemo(
    () => ({
      savedStops,
      isLoading,
      addStop,
      removeStop,
      isStopSaved,
      reorderStop,
    }),
    [savedStops, isLoading, addStop, removeStop, isStopSaved, reorderStop]
  );

  return (
    <SavedStopsContext.Provider value={value}>
      {children}
    </SavedStopsContext.Provider>
  );
};
