import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(appRoot, "..");
const sourceDocs = path.join(repoRoot, "docs");
const publicDir = path.join(appRoot, "public");
const officialRateUrl = "https://boi.org.il/PublicApi/GetExchangeRate?key=USD";
const logoCandidates = [
  path.join(repoRoot, "..", "OneDrive", "Desktop", "AI-PRO", "Logo - רקע שקןף.png"),
  path.join(sourceDocs, "logo.png"),
];

async function fetchOfficialUsdRate() {
  const response = await fetch(officialRateUrl, {
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Official exchange-rate request failed with ${response.status}.`);
  }

  const payload = await response.json();
  const rate = Number(payload.currentExchangeRate);

  if (!Number.isFinite(rate)) {
    throw new Error("Official exchange-rate response did not include a numeric USD rate.");
  }

  return {
    rate: Number(rate.toFixed(3)),
    updatedAt: typeof payload.lastUpdate === "string" ? payload.lastUpdate : null,
    source: "Bank of Israel Public API",
  };
}

async function resolveExchangeRate(currentRate) {
  try {
    return await fetchOfficialUsdRate();
  } catch (error) {
    return {
      rate: Number((currentRate ?? 3.65).toFixed(3)),
      updatedAt: null,
      source: "Bank of Israel Public API (fallback)",
      error,
    };
  }
}

async function copyLogo() {
  for (const candidate of logoCandidates) {
    try {
      await copyFile(candidate, path.join(publicDir, "logo.png"));
      return candidate;
    } catch {}
  }

  throw new Error("Could not find a logo file to copy into the dashboard build.");
}

await rm(path.join(appRoot, "out"), { recursive: true, force: true });
await mkdir(publicDir, { recursive: true });

const sourceDataPath = path.join(sourceDocs, "data.json");
const sourceData = JSON.parse(await readFile(sourceDataPath, "utf-8"));
const exchangeRate = await resolveExchangeRate(sourceData.usd_rate);
const mergedData = {
  ...sourceData,
  usd_rate: exchangeRate.rate,
  exchange_rate_updated_at: exchangeRate.updatedAt,
  exchange_rate_source: exchangeRate.source,
  grand_total_ils: Number((sourceData.grand_total * exchangeRate.rate).toFixed(2)),
  current_month_total_ils: Number((sourceData.current_month_total * exchangeRate.rate).toFixed(2)),
};

await writeFile(path.join(publicDir, "data.json"), JSON.stringify(mergedData, null, 2), "utf-8");
const copiedLogo = await copyLogo();

console.log(`Synced dashboard data with USD/ILS rate ${exchangeRate.rate} from ${exchangeRate.source}.`);
console.log(`Copied logo from ${copiedLogo}.`);
