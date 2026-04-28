import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const workerSrc = path.join(appRoot, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const publicDir = path.join(appRoot, "public");

await mkdir(publicDir, { recursive: true });
await copyFile(workerSrc, path.join(publicDir, "pdf.worker.min.mjs"));
console.log("Copied pdf.worker.min.mjs to public/");
