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

function createSavedStop(stop: BusStop): SavedStop {
  return {
    atco_code: stop.atco_code,
    common_name: stop.common_name,
    indicator: stop.indicator,
    line_names: stop.line_names || [],
    location: stop.location,
    saved_at: new Date().toISOString(),
  };
}

function moveSavedStop(
  savedStops: SavedStop[],
  atcoCode: string,
  direction: "up" | "down"
) {
  const currentIndex = savedStops.findIndex(
    (stop) => stop.atco_code === atcoCode
  );

  if (currentIndex === -1) {
    return savedStops;
  }

  if (direction === "up" && currentIndex === 0) {
    return savedStops;
  }

  if (direction === "down" && currentIndex === savedStops.length - 1) {
    return savedStops;
  }

  const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  const updatedStops = [...savedStops];
  const [savedStop] = updatedStops.splice(currentIndex, 1);

  updatedStops.splice(nextIndex, 0, savedStop);
  return updatedStops;
}

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

  const updateSavedStops = useCallback(
    (updater: (current: SavedStop[]) => SavedStop[]) => {
      setSavedStops((current) => {
        const updatedStops = updater(current);

        if (updatedStops !== current) {
          persistStops(updatedStops);
        }

        return updatedStops;
      });
    },
    [persistStops]
  );

  const addStop = useCallback(
    (stop: BusStop) => {
      const savedStop = createSavedStop(stop);

      updateSavedStops((current) => {
        if (current.some((item) => item.atco_code === stop.atco_code)) {
          return current;
        }

        return [savedStop, ...current];
      });
    },
    [updateSavedStops]
  );

  const removeStop = useCallback(
    (atcoCode: string) => {
      updateSavedStops((current) => {
        const updatedStops = current.filter(
          (stop) => stop.atco_code !== atcoCode
        );
        return updatedStops.length === current.length ? current : updatedStops;
      });
    },
    [updateSavedStops]
  );

  const isStopSaved = useCallback(
    (atcoCode: string) => {
      return savedStops.some((s) => s.atco_code === atcoCode);
    },
    [savedStops]
  );

  const reorderStop = useCallback(
    (atcoCode: string, direction: "up" | "down") => {
      updateSavedStops((current) =>
        moveSavedStop(current, atcoCode, direction)
      );
    },
    [updateSavedStops]
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
