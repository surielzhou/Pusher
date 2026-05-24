import type { Article } from "../domain/article.ts";
import type { PublishSchedule } from "../domain/schedule.ts";
import type { ArticleStatus } from "../domain/status.ts";
import type { ArticleRepository, RepositoryClock } from "../repositories/types.ts";
import type { ScheduleRepository } from "../repositories/scheduleRepository.ts";
import { assertTransition, canPreparePublish } from "./articleStatusService.ts";

export class ScheduleArticleNotFoundError extends Error {
  readonly articleId: string;

  constructor(articleId: string) {
    super(`Article not found: ${articleId}`);
    this.name = "ScheduleArticleNotFoundError";
    this.articleId = articleId;
  }
}

export class ArticleNotSchedulableError extends Error {
  readonly articleId: string;
  readonly status: ArticleStatus;

  constructor(articleId: string, status: ArticleStatus) {
    super(`Article ${articleId} cannot be scheduled while ${status}`);
    this.name = "ArticleNotSchedulableError";
    this.articleId = articleId;
    this.status = status;
  }
}

export class ArticleScheduleReviewVersionMismatchError extends Error {
  readonly articleId: string;
  readonly reviewedVersion: number | undefined;
  readonly contentVersion: number;

  constructor(articleId: string, reviewedVersion: number | undefined, contentVersion: number) {
    super(`Article ${articleId} content version ${contentVersion} has not been reviewed for scheduling`);
    this.name = "ArticleScheduleReviewVersionMismatchError";
    this.articleId = articleId;
    this.reviewedVersion = reviewedVersion;
    this.contentVersion = contentVersion;
  }
}

export class ScheduleTimeInPastError extends Error {
  readonly scheduledFor: Date;

  constructor(scheduledFor: Date) {
    super(`Schedule time must be in the future: ${scheduledFor.toISOString()}`);
    this.name = "ScheduleTimeInPastError";
    this.scheduledFor = new Date(scheduledFor);
  }
}

export class ScheduleNotFoundError extends Error {
  readonly scheduleId: string;

  constructor(scheduleId: string) {
    super(`Schedule not found: ${scheduleId}`);
    this.name = "ScheduleNotFoundError";
    this.scheduleId = scheduleId;
  }
}

export class ScheduleCannotChangeError extends Error {
  readonly scheduleId: string;
  readonly status: PublishSchedule["status"];

  constructor(scheduleId: string, status: PublishSchedule["status"]) {
    super(`Schedule ${scheduleId} cannot be changed while ${status}`);
    this.name = "ScheduleCannotChangeError";
    this.scheduleId = scheduleId;
    this.status = status;
  }
}

export interface ScheduleServiceDependencies {
  articles: Pick<ArticleRepository, "getById" | "update" | "recordStatusEvent">;
  schedules: ScheduleRepository;
  now?: RepositoryClock;
}

export class ScheduleServiceImpl {
  private readonly articles: Pick<ArticleRepository, "getById" | "update" | "recordStatusEvent">;
  private readonly schedules: ScheduleRepository;
  private readonly now: RepositoryClock;

  constructor(dependencies: ScheduleServiceDependencies) {
    this.articles = dependencies.articles;
    this.schedules = dependencies.schedules;
    this.now = dependencies.now ?? (() => new Date());
  }

  async createSchedule(input: {
    articleId: string;
    channel: "wechat_manual" | string;
    scheduledFor: Date;
    note?: string;
  }): Promise<{
    scheduleId: string;
    status: "scheduled";
    articleStatus: "pending_publish";
    scheduledFor: Date;
  }> {
    this.assertFutureScheduleTime(input.scheduledFor);
    const article = await this.getExistingArticle(input.articleId);
    this.assertSchedulableArticle(article);
    const schedule = await this.schedules.create({
      articleId: article.id,
      articleVersion: article.contentVersion,
      channel: input.channel,
      scheduledFor: input.scheduledFor,
      note: normalizeOptionalText(input.note)
    });

    await this.moveArticleToPendingPublishIfNeeded(article);

    return {
      scheduleId: schedule.id,
      status: "scheduled",
      articleStatus: "pending_publish",
      scheduledFor: new Date(schedule.scheduledFor)
    };
  }

  async reschedule(input: {
    scheduleId: string;
    scheduledFor: Date;
    note?: string;
  }): Promise<{ scheduleId: string; status: "scheduled"; scheduledFor: Date }> {
    this.assertFutureScheduleTime(input.scheduledFor);
    const schedule = await this.getExistingSchedule(input.scheduleId);
    this.assertActiveSchedule(schedule);
    const updated = await this.schedules.update(schedule.id, {
      scheduledFor: input.scheduledFor,
      note: normalizeOptionalText(input.note)
    });

    return {
      scheduleId: updated.id,
      status: "scheduled",
      scheduledFor: new Date(updated.scheduledFor)
    };
  }

  async cancelSchedule(input: {
    scheduleId: string;
    cancelReason?: string;
  }): Promise<{ scheduleId: string; status: "cancelled" }> {
    const schedule = await this.getExistingSchedule(input.scheduleId);
    this.assertActiveSchedule(schedule);
    const updated = await this.schedules.update(schedule.id, {
      status: "cancelled",
      cancelReason: normalizeOptionalText(input.cancelReason),
      cancelledAt: this.now()
    });

    return { scheduleId: updated.id, status: "cancelled" };
  }

  async getNextSchedule(articleId: string): Promise<PublishSchedule | undefined> {
    return this.schedules.latestActiveByArticleId(articleId);
  }

  async listUpcomingSchedules(input: { from?: Date; to?: Date } = {}): Promise<PublishSchedule[]> {
    return this.schedules.listUpcoming(input);
  }

  private async getExistingArticle(articleId: string): Promise<Article> {
    const article = await this.articles.getById(articleId);
    if (!article) {
      throw new ScheduleArticleNotFoundError(articleId);
    }

    return article;
  }

  private async getExistingSchedule(scheduleId: string): Promise<PublishSchedule> {
    const schedule = await this.schedules.getById(scheduleId);
    if (!schedule) {
      throw new ScheduleNotFoundError(scheduleId);
    }

    return schedule;
  }

  private assertFutureScheduleTime(scheduledFor: Date): void {
    if (Number.isNaN(scheduledFor.getTime()) || scheduledFor <= this.now()) {
      throw new ScheduleTimeInPastError(scheduledFor);
    }
  }

  private assertSchedulableArticle(article: Article): void {
    if (!canPreparePublish(article.status)) {
      throw new ArticleNotSchedulableError(article.id, article.status);
    }

    if (article.reviewedVersion !== article.contentVersion) {
      throw new ArticleScheduleReviewVersionMismatchError(article.id, article.reviewedVersion, article.contentVersion);
    }
  }

  private assertActiveSchedule(schedule: PublishSchedule): void {
    if (schedule.status !== "scheduled") {
      throw new ScheduleCannotChangeError(schedule.id, schedule.status);
    }
  }

  private async moveArticleToPendingPublishIfNeeded(article: Article): Promise<void> {
    if (article.status !== "approved") {
      return;
    }

    assertTransition(article.status, "pending_publish");
    await this.articles.update(article.id, { status: "pending_publish" });
    await this.articles.recordStatusEvent({
      articleId: article.id,
      fromStatus: article.status,
      toStatus: "pending_publish",
      reason: "publish scheduled"
    });
  }
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
