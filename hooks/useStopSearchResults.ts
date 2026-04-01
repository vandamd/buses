import { useEffect, useState } from "react";
import {
  type LocalStopResult,
  searchStopsLocal,
} from "@/services/localStopSearch";

export function useStopSearchResults(query: string) {
  const trimmedQuery = query.trim();
  const [results, setResults] = useState<LocalStopResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isActive = true;

    if (!trimmedQuery) {
      setResults([]);
      setError(null);
      setIsLoading(false);
      return () => {
        isActive = false;
      };
    }

    setIsLoading(true);
    setError(null);

    searchStopsLocal(trimmedQuery)
      .then((data) => {
        if (!isActive) {
          return;
        }

        setResults(data);
      })
      .catch((err: unknown) => {
        if (!isActive) {
          return;
        }

        setError(err instanceof Error ? err : new Error("Search failed"));
      })
      .finally(() => {
        if (!isActive) {
          return;
        }

        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [trimmedQuery]);

  return {
    error,
    isLoading,
    results,
    trimmedQuery,
  };
}
