import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  ArticleService,
  ContentValidationService,
  ComplianceService,
  EditorService,
  GenerationService,
  ImageService,
  PublishPreparationService,
  ReviewService
} from "../../../src/services/contracts.ts";
import { SERVICE_CONTRACTS } from "../../../src/services/contracts.ts";

describe("service contracts", () => {
  it("publishes the required service contract names", () => {
    assert.deepEqual(SERVICE_CONTRACTS, [
      "ArticleService",
      "GenerationService",
      "ImageService",
      "EditorService",
      "ReviewService",
      "PublishPreparationService",
      "ContentValidationService",
      "ComplianceService"
    ]);
  });

  it("can be implemented by module-specific workers without sharing concrete code", async () => {
    const articleService: ArticleService = {
      async createArticle(input) {
        return { articleId: `article_${input.category}`, status: "drafting" };
      },
      async getArticleDetail(articleId) {
        return {
          article: {
            id: articleId,
            category: "tech_internet",
            status: "drafting",
            generationConfig: {
              category: "tech_internet",
              topic: "AI Agent",
              requireRiskNote: false
            },
            contentVersion: 1,
            createdAt: new Date("2026-05-06T00:00:00.000Z"),
            updatedAt: new Date("2026-05-06T00:00:00.000Z")
          },
          images: []
        };
      },
      async listArticles() {
        return { items: [], total: 0 };
      }
    };

    const generationService: GenerationService = {
      async generateDraft(articleId) {
        return {
          articleId,
          status: "editing",
          contentVersion: 1
        };
      },
      async regenerateDraft(articleId) {
        return {
          articleId,
          status: "editing",
          contentVersion: 2
        };
      }
    };

    const imageService: ImageService = {
      async listArticleImages() {
        return { items: [] };
      },
      async saveImageSuggestion() {
        return { imageId: "image_001", type: "suggestion" };
      },
      async replaceImage() {
        return { imageId: "image_001", type: "uploaded" };
      }
    };

    const editorService: EditorService = {
      async saveArticleContent(articleId) {
        return { articleId, status: "editing", contentVersion: 2 };
      },
      async submitForReview() {
        return { status: "pending_review" };
      }
    };

    const reviewService: ReviewService = {
      async getReviewView() {
        return {
          article: {},
          images: [],
          complianceReport: {
            status: "not_applicable",
            requiredDisclaimer: undefined,
            issues: []
          },
          checklist: {
            hasTitle: true,
            hasBody: true,
            hasImageOrSuggestion: true,
            categoryMatched: true
          }
        };
      },
      async submitReview() {
        return { status: "approved", reviewedVersion: 2 };
      }
    };

    const publishPreparationService: PublishPreparationService = {
      async preparePublish() {
        return {
          publishRecordId: "publish_001",
          status: "prepared",
          articleStatus: "pending_publish",
          exportContent: "公众号可复制内容"
        };
      },
      async markPublished() {
        return { articleStatus: "published", publishStatus: "published" };
      },
      async markPublishFailed() {
        return { articleStatus: "publish_failed", publishStatus: "failed" };
      }
    };

    const validationService: ContentValidationService = {
      async validateForReview() {
        return {
          valid: true,
          missingFields: [],
          warnings: []
        };
      }
    };

    const complianceService: ComplianceService = {
      analyzeArticle() {
        return {
          status: "passed",
          requiredDisclaimer: "本文仅为信息分享，不构成任何投资建议。市场有风险，决策需谨慎。",
          issues: []
        };
      }
    };

    assert.equal((await articleService.createArticle({ category: "finance", topic: "市场观察" })).status, "drafting");
    assert.equal((await generationService.generateDraft("article_001")).status, "editing");
    assert.equal((await imageService.saveImageSuggestion({
      articleId: "article_001",
      description: "配图建议"
    })).type, "suggestion");
    assert.equal((await editorService.submitForReview("article_001")).status, "pending_review");
    assert.equal((await reviewService.submitReview({
      articleId: "article_001",
      result: "approved"
    })).status, "approved");
    assert.equal((await publishPreparationService.preparePublish({
      articleId: "article_001",
      channel: "wechat_manual"
    })).articleStatus, "pending_publish");
    assert.equal((await validationService.validateForReview("article_001")).valid, true);
    assert.equal(complianceService.analyzeArticle({ category: "finance" }).status, "passed");
  });
});
