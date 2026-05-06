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
  "src/domain/permissions.ts",
  "src/domain/review.ts",
  "src/domain/publish.ts",
  "src/domain/status.ts",
  "src/domain/validation.ts",
  "src/adapters/ai/imageGenerationAdapter.ts",
  "src/adapters/wechat/draftClient.ts",
  "src/services/contracts.ts",
  "src/services/authService.ts",
  "src/services/articleStatusService.ts",
  "src/services/complianceService.ts",
  "src/services/contentValidationService.ts",
  "src/services/materialService.ts",
  "src/components/article/MaterialPicker.tsx",
  "src/components/review/CompliancePanel.tsx",
  "src/repositories/types.ts",
  "src/repositories/memoryStore.ts",
  "src/repositories/index.ts",
  "src/repositories/articleRepository.ts",
  "src/repositories/imageRepository.ts",
  "src/repositories/reviewRepository.ts",
  "src/repositories/publishRepository.ts",
  "src/repositories/auditLogRepository.ts",
  "tests/unit/repositories/repositories.test.ts",
  "tests/unit/domain/permissions.test.ts",
  "tests/unit/services/authService.test.ts",
  "tests/unit/services/articleStatusService.test.ts",
  "tests/unit/services/complianceService.test.ts",
  "tests/unit/services/contentValidationService.test.ts",
  "tests/unit/services/materialService.test.ts",
  "tests/unit/services/phase1Workflow.test.ts",
  "docs/开发计划/Phase1合并记录.md"
];

await Promise.all(requiredFiles.map((path) => access(path)));

console.log("Project build baseline verified");
