"use client";

import { useEffect, useState } from "react";

export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setHydrated(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  return hydrated;
}
