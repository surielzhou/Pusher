import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ArticleStatus } from "../../../src/domain/status.ts";
import {
  InMemoryArticleRepository,
  InMemoryScheduleRepository,
  createMemoryStore
} from "../../../src/repositories/index.ts";
import {
  ArticleNotSchedulableError,
  ArticleScheduleReviewVersionMismatchError,
  ScheduleNotFoundError,
  ScheduleServiceImpl,
  ScheduleTimeInPastError
} from "../../../src/services/scheduleService.ts";

const fixedNow = () => new Date("2026-05-06T00:00:00.000Z");
const tomorrowMorning = new Date("2026-05-07T01:30:00.000Z");
const tomorrowEvening = new Date("2026-05-07T12:00:00.000Z");

function createHarness() {
  const store = createMemoryStore();
  const articles = new InMemoryArticleRepository(store, fixedNow);
  const schedules = new InMemoryScheduleRepository(fixedNow);
  const service = new ScheduleServiceImpl({ articles, schedules, now: fixedNow });

  return { articles, schedules, service };
}

async function createSchedulableArticle(
  articles: InMemoryArticleRepository,
  status: Extract<ArticleStatus, "approved" | "pending_publish"> = "approved"
) {
  const article = await articles.create({
    category: "finance",
    title: "AI 投研工具排期稿",
    summary: "面向公众号读者的 AI 投研工具观察摘要。",
    body: "正文包含行业变化、风险因素和非投资建议表达。",
    riskNote: "市场有风险，本文不构成投资建议。",
    generationConfig: {
      category: "finance",
      topic: "AI 投研工具",
      audience: "公众号读者",
      style: "稳健",
      requireRiskNote: true
    },
    status
  });

  return articles.update(article.id, { reviewedVersion: article.contentVersion });
}

describe("schedule service", () => {
  it("schedules approved articles and moves them to pending publish", async () => {
    const { articles, schedules, service } = createHarness();
    const article = await createSchedulableArticle(articles);

    const result = await service.createSchedule({
      articleId: article.id,
      channel: "wechat_manual",
      scheduledFor: tomorrowMorning,
      note: "  早高峰推送  "
    });

    const updatedArticle = await articles.getById(article.id);
    const latestSchedule = await schedules.latestActiveByArticleId(article.id);
    const statusEvents = await articles.listStatusEvents(article.id);

    assert.equal(result.scheduleId, latestSchedule?.id);
    assert.equal(result.status, "scheduled");
    assert.equal(result.articleStatus, "pending_publish");
    assert.deepEqual(result.scheduledFor, tomorrowMorning);
    assert.equal(updatedArticle?.status, "pending_publish");
    assert.equal(latestSchedule?.articleVersion, article.contentVersion);
    assert.equal(latestSchedule?.channel, "wechat_manual");
    assert.equal(latestSchedule?.note, "早高峰推送");
    assert.deepEqual(
      statusEvents.map((event) => [event.fromStatus, event.toStatus, event.reason]),
      [["approved", "pending_publish", "publish scheduled"]]
    );
  });

  it("schedules already pending publish articles without another status event", async () => {
    const { articles, schedules, service } = createHarness();
    const article = await createSchedulableArticle(articles, "pending_publish");

    const result = await service.createSchedule({
      articleId: article.id,
      channel: "wechat_manual",
      scheduledFor: tomorrowMorning
    });

    assert.equal(result.articleStatus, "pending_publish");
    assert.equal((await schedules.latestActiveByArticleId(article.id))?.status, "scheduled");
    assert.deepEqual(await articles.listStatusEvents(article.id), []);
  });

  it("rejects unschedulable articles, stale reviews, and past schedule times", async () => {
    const { articles, schedules, service } = createHarness();
    const pendingReview = await articles.create({
      category: "tech_internet",
      title: "待审核文章",
      summary: "摘要",
      body: "正文",
      generationConfig: {
        category: "tech_internet",
        topic: "AI Agent",
        requireRiskNote: false
      },
      status: "pending_review"
    });
    const stale = await createSchedulableArticle(articles);
    const staleUpdated = await articles.update(stale.id, {
      contentVersion: stale.contentVersion + 1,
      reviewedVersion: stale.contentVersion
    });

    await assert.rejects(
      () => service.createSchedule({ articleId: pendingReview.id, channel: "wechat_manual", scheduledFor: tomorrowMorning }),
      (error) => {
        assert.equal(error instanceof ArticleNotSchedulableError, true);
        assert.equal((error as ArticleNotSchedulableError).articleId, pendingReview.id);
        assert.equal((error as ArticleNotSchedulableError).status, "pending_review");
        return true;
      }
    );
    await assert.rejects(
      () => service.createSchedule({ articleId: staleUpdated.id, channel: "wechat_manual", scheduledFor: tomorrowMorning }),
      (error) => {
        assert.equal(error instanceof ArticleScheduleReviewVersionMismatchError, true);
        assert.equal((error as ArticleScheduleReviewVersionMismatchError).articleId, staleUpdated.id);
        assert.equal((error as ArticleScheduleReviewVersionMismatchError).reviewedVersion, stale.contentVersion);
        assert.equal((error as ArticleScheduleReviewVersionMismatchError).contentVersion, staleUpdated.contentVersion);
        return true;
      }
    );
    await assert.rejects(
      () => service.createSchedule({
        articleId: stale.id,
        channel: "wechat_manual",
        scheduledFor: new Date("2026-05-05T23:59:00.000Z")
      }),
      ScheduleTimeInPastError
    );

    assert.equal((await schedules.listByArticleId(pendingReview.id)).length, 0);
    assert.equal((await schedules.listByArticleId(stale.id)).length, 0);
  });

  it("reschedules active schedules and returns cloned date values", async () => {
    const { articles, schedules, service } = createHarness();
    const article = await createSchedulableArticle(articles);
    const created = await service.createSchedule({
      articleId: article.id,
      channel: "wechat_manual",
      scheduledFor: tomorrowMorning
    });

    const result = await service.reschedule({
      scheduleId: created.scheduleId,
      scheduledFor: tomorrowEvening,
      note: "改到晚间黄金时段"
    });
    result.scheduledFor.setUTCFullYear(2030);

    const stored = await schedules.getById(created.scheduleId);

    assert.equal(result.scheduleId, created.scheduleId);
    assert.equal(result.status, "scheduled");
    assert.deepEqual(stored?.scheduledFor, tomorrowEvening);
    assert.equal(stored?.note, "改到晚间黄金时段");
  });

  it("cancels active schedules and excludes them from upcoming results", async () => {
    const { articles, schedules, service } = createHarness();
    const article = await createSchedulableArticle(articles);
    const created = await service.createSchedule({
      articleId: article.id,
      channel: "wechat_manual",
      scheduledFor: tomorrowMorning
    });

    const result = await service.cancelSchedule({
      scheduleId: created.scheduleId,
      cancelReason: "  发布窗口调整  "
    });

    const stored = await schedules.getById(created.scheduleId);

    assert.deepEqual(result, { scheduleId: created.scheduleId, status: "cancelled" });
    assert.equal(stored?.status, "cancelled");
    assert.equal(stored?.cancelReason, "发布窗口调整");
    assert.deepEqual(stored?.cancelledAt, fixedNow());
    assert.equal(await schedules.latestActiveByArticleId(article.id), undefined);
    assert.deepEqual(await service.listUpcomingSchedules(), []);
  });

  it("throws a structured error when rescheduling or cancelling an unknown schedule", async () => {
    const { service } = createHarness();

    await assert.rejects(
      () => service.reschedule({ scheduleId: "schedule_missing", scheduledFor: tomorrowMorning }),
      (error) => {
        assert.equal(error instanceof ScheduleNotFoundError, true);
        assert.equal((error as ScheduleNotFoundError).scheduleId, "schedule_missing");
        return true;
      }
    );
    await assert.rejects(
      () => service.cancelSchedule({ scheduleId: "schedule_missing" }),
      ScheduleNotFoundError
    );
  });
});
