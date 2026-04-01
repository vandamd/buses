import { useFocusEffect } from "expo-router";
import { useCallback } from "react";

interface UseFocusedPollingOptions {
  enabled?: boolean;
  intervalMs: number;
  runImmediately?: boolean;
}

type PollingTask = (isActive: () => boolean) => Promise<void> | void;

export function useFocusedPolling(
  task: PollingTask,
  {
    enabled = true,
    intervalMs,
    runImmediately = false,
  }: UseFocusedPollingOptions
) {
  useFocusEffect(
    useCallback(() => {
      if (!enabled) {
        return undefined;
      }

      let active = true;

      const isActive = () => active;
      const runTask = () => {
        Promise.resolve(task(isActive)).catch(() => undefined);
      };

      if (runImmediately) {
        runTask();
      }

      const interval = setInterval(runTask, intervalMs);

      return () => {
        active = false;
        clearInterval(interval);
      };
    }, [enabled, intervalMs, runImmediately, task])
  );
}
