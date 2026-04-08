export function formatCurrencyUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCurrencyIls(value: number) {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 2,
  }).format(value);
}

export function convertUsdToIls(value: number, usdRate: number) {
  return Number((value * usdRate).toFixed(2));
}

export function formatExchangeRate(usdRate: number) {
  return `${usdRate.toFixed(3)} ש"ח לכל $1`;
}

export function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("he-IL", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function formatDateTimeLabel(value: string) {
  return new Intl.DateTimeFormat("he-IL", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatMonthLabel(monthKey: string, format: "short" | "long" = "long") {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1, 1);

  return new Intl.DateTimeFormat("he-IL", {
    month: format,
    year: "numeric",
  }).format(date);
}

export function monthToken(monthKey: string) {
  const [, month] = monthKey.split("-").map(Number);
  return ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"][month - 1];
}
