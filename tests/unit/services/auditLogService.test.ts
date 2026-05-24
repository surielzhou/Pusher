import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  InMemoryAuditLogRepository,
  createMemoryStore,
  createSequentialIdFactory
} from "../../../src/repositories/index.ts";
import { validatePusherEnv } from "../../../src/config/env.ts";
import { AuditLogServiceImpl } from "../../../src/services/auditLogService.ts";

describe("environment validation", () => {
  it("reports missing AI, WeChat, and persistence settings for production operations", () => {
    const report = validatePusherEnv({
      NODE_ENV: "production",
      APP_BASE_URL: "https://pusher.example.com",
      AI_TEXT_PROVIDER: "openai",
      AI_IMAGE_PROVIDER: "openai",
      WECHAT_DRAFT_ENABLED: "true",
      PERSISTENCE_DRIVER: "file"
    });

    assert.equal(report.valid, false);
    assert.equal(report.status, "error");
    assert.deepEqual(
      report.issues.map((issue) => issue.code),
      [
        "ai_text_api_key_missing",
        "ai_image_api_key_missing",
        "wechat_app_id_missing",
        "wechat_app_secret_missing",
        "file_storage_root_missing"
      ]
    );
  });
});

describe("audit log service", () => {
  it("builds an article timeline for generation, editing, review, publish preparation, and draft creation", async () => {
    const auditLogs = new InMemoryAuditLogRepository(
      createMemoryStore(),
      createSequenceClock([
        "2026-05-06T09:00:00.000Z",
        "2026-05-06T09:05:00.000Z",
        "2026-05-06T09:10:00.000Z",
        "2026-05-06T09:20:00.000Z",
        "2026-05-06T09:30:00.000Z"
      ]),
      createSequentialIdFactory()
    );
    const service = new AuditLogServiceImpl({ auditLogs });

    await service.recordArticleAction({
      articleId: "article_001",
      action: "article.generated",
      actorId: "system",
      metadata: { contentVersion: 2 }
    });
    await service.recordArticleAction({
      articleId: "article_001",
      action: "article.edited",
      actorId: "creator_001",
      message: "补充了导语和图片说明"
    });
    await auditLogs.createStatusEvent({
      articleId: "article_001",
      fromStatus: "editing",
      toStatus: "pending_review",
      reason: "submit review"
    });
    await service.recordArticleAction({
      articleId: "article_001",
      action: "publish.prepared",
      actorId: "publisher_001",
      metadata: { channel: "wechat_manual" }
    });
    await service.recordArticleAction({
      articleId: "article_001",
      action: "wechat.draft_created",
      actorId: "publisher_001",
      metadata: { draftId: "draft_001" }
    });

    const timeline = await service.listArticleTimeline("article_001");

    assert.deepEqual(
      timeline.items.map((item) => ({
        action: item.action,
        label: item.label,
        message: item.message,
        actorId: item.actorId,
        source: item.source,
        occurredAt: item.occurredAt.toISOString()
      })),
      [
        {
          action: "wechat.draft_created",
          label: "公众号草稿创建",
          message: "公众号草稿创建",
          actorId: "publisher_001",
          source: "audit_log",
          occurredAt: "2026-05-06T09:30:00.000Z"
        },
        {
          action: "publish.prepared",
          label: "发布准备完成",
          message: "发布准备完成",
          actorId: "publisher_001",
          source: "audit_log",
          occurredAt: "2026-05-06T09:20:00.000Z"
        },
        {
          action: "review.submitted",
          label: "提交 Review",
          message: "submit review",
          actorId: undefined,
          source: "status_event",
          occurredAt: "2026-05-06T09:10:00.000Z"
        },
        {
          action: "article.edited",
          label: "内容编辑",
          message: "补充了导语和图片说明",
          actorId: "creator_001",
          source: "audit_log",
          occurredAt: "2026-05-06T09:05:00.000Z"
        },
        {
          action: "article.generated",
          label: "AI 生成完成",
          message: "AI 生成完成",
          actorId: "system",
          source: "audit_log",
          occurredAt: "2026-05-06T09:00:00.000Z"
        }
      ]
    );
    assert.deepEqual(timeline.items[0]?.metadata, { draftId: "draft_001" });
  });
});

function createSequenceClock(values: string[]): () => Date {
  const dates = values.map((value) => new Date(value));
  let index = 0;

  return () => dates[index++] ?? dates.at(-1) ?? new Date("2026-05-06T00:00:00.000Z");
}
