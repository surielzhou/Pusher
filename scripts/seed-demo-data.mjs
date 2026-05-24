import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { createJsonFileStore } from "../src/repositories/fileStore.ts";
import { createDemoRepositorySnapshot } from "../src/repositories/persistence.ts";

const outputPath = resolve(process.cwd(), parseOutputPath(process.argv.slice(2)) ?? join(tmpdir(), "pusher-demo-seed.json"));
const snapshot = createDemoRepositorySnapshot({ exportedAt: new Date() });
const store = createJsonFileStore(outputPath);

await store.save(snapshot);

console.log(`Demo persistence seed written: ${outputPath}`);
console.log(`Articles: ${snapshot.articles.length}`);
console.log(`Images: ${snapshot.images.length}`);
console.log(`Reviews: ${snapshot.reviews.length}`);
console.log(`Publishes: ${snapshot.publishes.length}`);

function parseOutputPath(args) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }

    if (arg === "--output" || arg === "-o") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--output requires a file path");
      }

      return value;
    }

    if (arg.startsWith("--output=")) {
      return arg.slice("--output=".length);
    }
  }

  return undefined;
}

function printUsage() {
  console.log("Usage: node --experimental-strip-types scripts/seed-demo-data.mjs [--output <file>]");
}
