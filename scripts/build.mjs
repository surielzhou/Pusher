import { access } from "node:fs/promises";

const requiredFiles = [
  "package.json",
  "tsconfig.json",
  "vitest.config.ts",
  "playwright.config.ts",
  "src/app/workbench/page.tsx",
  "src/domain/article.ts",
  "src/domain/image.ts",
  "src/domain/review.ts",
  "src/domain/publish.ts",
  "src/domain/status.ts",
  "src/domain/validation.ts",
  "src/services/contracts.ts"
];

await Promise.all(requiredFiles.map((path) => access(path)));

console.log("Phase 0 build baseline verified");
