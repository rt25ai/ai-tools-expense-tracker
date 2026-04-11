"use client";

import { useEffect, useState } from "react";
import {
  DASHBOARD_SETTINGS_STORAGE_KEY,
  DASHBOARD_SETTINGS_UPDATED_EVENT,
  DEFAULT_MONTHLY_BUDGET,
  sanitizeMonthlyBudget,
} from "@/lib/monthly-budget";

type StoredSettingsShape = {
  finance?: {
    monthlyBudget?: unknown;
  };
};

function parseStoredMonthlyBudget(raw: string | null, fallback: number) {
  if (!raw) return sanitizeMonthlyBudget(fallback);

  try {
    const parsed = JSON.parse(raw) as StoredSettingsShape;
    return sanitizeMonthlyBudget(parsed.finance?.monthlyBudget, fallback);
  } catch {
    return sanitizeMonthlyBudget(fallback);
  }
}

export function readStoredMonthlyBudget(fallback = DEFAULT_MONTHLY_BUDGET) {
  if (typeof window === "undefined") {
    return sanitizeMonthlyBudget(fallback);
  }

  return parseStoredMonthlyBudget(window.localStorage.getItem(DASHBOARD_SETTINGS_STORAGE_KEY), fallback);
}

export function dispatchSettingsUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DASHBOARD_SETTINGS_UPDATED_EVENT));
}

export function useMonthlyBudget(fallback = DEFAULT_MONTHLY_BUDGET) {
  const normalizedFallback = sanitizeMonthlyBudget(fallback);
  const [monthlyBudget, setMonthlyBudget] = useState(normalizedFallback);

  useEffect(() => {
    const syncBudget = () => {
      setMonthlyBudget(readStoredMonthlyBudget(normalizedFallback));
    };

    syncBudget();
    window.addEventListener("storage", syncBudget);
    window.addEventListener(DASHBOARD_SETTINGS_UPDATED_EVENT, syncBudget);

    return () => {
      window.removeEventListener("storage", syncBudget);
      window.removeEventListener(DASHBOARD_SETTINGS_UPDATED_EVENT, syncBudget);
    };
  }, [normalizedFallback]);

  return monthlyBudget;
}
