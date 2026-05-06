import { access } from "node:fs/promises";

const requiredFiles = [
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "tsconfig.typecheck.json",
  "vitest.config.ts",
  "playwright.config.ts",
  "src/app/workbench/page.tsx",
  "src/domain/article.ts",
  "src/domain/image.ts",
  "src/domain/review.ts",
  "src/domain/publish.ts",
  "src/domain/status.ts",
  "src/domain/validation.ts",
  "src/services/contracts.ts",
  "src/services/articleStatusService.ts",
  "src/services/contentValidationService.ts",
  "src/repositories/types.ts",
  "src/repositories/memoryStore.ts",
  "src/repositories/index.ts",
  "src/repositories/articleRepository.ts",
  "src/repositories/imageRepository.ts",
  "src/repositories/reviewRepository.ts",
  "src/repositories/publishRepository.ts",
  "src/repositories/auditLogRepository.ts",
  "tests/unit/repositories/repositories.test.ts",
  "tests/unit/services/articleStatusService.test.ts",
  "tests/unit/services/contentValidationService.test.ts",
  "tests/unit/services/phase1Workflow.test.ts",
  "docs/开发计划/Phase1合并记录.md"
];

await Promise.all(requiredFiles.map((path) => access(path)));

console.log("Phase 1 integration build baseline verified");
