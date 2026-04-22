"use client";

import { useEffect, useRef } from "react";
import { withBasePath } from "@/lib/site";

const POLL_INTERVAL_MS = 60_000;

export function LiveRefresh({ initialBuiltAt }: { initialBuiltAt: string }) {
  const baseline = useRef(initialBuiltAt);

  useEffect(() => {
    const url = withBasePath("/data.json");
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { built_at?: string; generated?: string };
        const current = data.built_at ?? data.generated ?? "";
        if (!cancelled && current && current !== baseline.current) {
          window.location.reload();
        }
      } catch {
        // Network hiccup — try again next interval.
      }
    }

    const timer = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return null;
}
