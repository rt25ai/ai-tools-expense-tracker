import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const src = resolve(root, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
const dst = resolve(root, "public/pdfjs/pdf.worker.min.mjs");

await mkdir(dirname(dst), { recursive: true });
await copyFile(src, dst);
console.log(`Copied pdf.worker.min.mjs -> ${dst}`);
