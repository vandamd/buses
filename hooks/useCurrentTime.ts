import { useEffect, useState } from "react";

const MINUTE_MS = 60_000;

function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function getDelayUntilNextMinute(date: Date) {
  return MINUTE_MS - (date.getSeconds() * 1000 + date.getMilliseconds());
}

export function useCurrentTime() {
  const [time, setTime] = useState(() => formatTime(new Date()));

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    const updateTime = () => {
      setTime(formatTime(new Date()));
    };

    const timeout = setTimeout(() => {
      updateTime();
      interval = setInterval(updateTime, MINUTE_MS);
    }, getDelayUntilNextMinute(new Date()));

    return () => {
      clearTimeout(timeout);
      if (interval) {
        clearInterval(interval);
      }
    };
  }, []);

  return time;
}
