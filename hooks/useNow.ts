"use client";

import { useEffect, useState } from "react";

/**
 * Client clock in unix seconds — null until mounted, then ticking.
 * SSR safety (CLAUDE.md): never Date.now() in render; countdowns hydrate to
 * their server markup first and start moving on the first tick.
 */
export function useNow(intervalMs = 1_000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNow(Math.floor(Date.now() / 1000));
    const first = setTimeout(update, 0);
    const timer = setInterval(update, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [intervalMs]);
  return now;
}
