import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const nextDir = join(scriptDir, "..", ".next");

rmSync(nextDir, { recursive: true, force: true });
console.log(`Removed ${nextDir}.`);
