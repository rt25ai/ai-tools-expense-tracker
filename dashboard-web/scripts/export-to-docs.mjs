import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(appRoot, "..");
const outDir = path.join(appRoot, "out");
const docsDir = path.join(repoRoot, "docs");

async function removeTxtFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === ".well-known") continue;
      await removeTxtFiles(fullPath);
      continue;
    }

    if (entry.name.endsWith(".txt")) {
      await rm(fullPath, { force: true });
    }
  }
}

await mkdir(docsDir, { recursive: true });

for (const entry of await readdir(docsDir)) {
  await rm(path.join(docsDir, entry), { recursive: true, force: true });
}

await cp(outDir, docsDir, { recursive: true, force: true });
await removeTxtFiles(docsDir);
await writeFile(path.join(docsDir, ".nojekyll"), "");

console.log("Exported static dashboard to docs/.");
