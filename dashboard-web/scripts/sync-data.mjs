import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(appRoot, "..");
const sourceDocs = path.join(repoRoot, "docs");
const publicDir = path.join(appRoot, "public");

await rm(path.join(appRoot, "out"), { recursive: true, force: true });
await mkdir(publicDir, { recursive: true });
await copyFile(path.join(sourceDocs, "data.json"), path.join(publicDir, "data.json"));
await copyFile(path.join(sourceDocs, "logo.png"), path.join(publicDir, "logo.png"));

console.log("Synced dashboard data into public assets.");
