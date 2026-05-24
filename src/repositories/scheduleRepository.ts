import type { PublishSchedule, ScheduleStatus } from "../domain/schedule.ts";
import { RepositoryError, type RepositoryClock, type RepositoryIdFactory } from "./types.ts";
import { createSequentialIdFactory, systemClock } from "./memoryStore.ts";

export interface CreateScheduleInput {
  articleId: string;
  articleVersion: number;
  channel: "wechat_manual" | string;
  scheduledFor: Date;
  note?: string;
}

export interface UpdateScheduleInput {
  scheduledFor?: Date;
  status?: ScheduleStatus;
  note?: string;
  cancelReason?: string;
  cancelledAt?: Date;
}

export interface ScheduleListQuery {
  from?: Date;
  to?: Date;
  status?: ScheduleStatus;
}

export interface ScheduleRepository {
  create(input: CreateScheduleInput): Promise<PublishSchedule>;
  getById(scheduleId: string): Promise<PublishSchedule | undefined>;
  listByArticleId(articleId: string): Promise<PublishSchedule[]>;
  latestActiveByArticleId(articleId: string): Promise<PublishSchedule | undefined>;
  listUpcoming(query?: ScheduleListQuery): Promise<PublishSchedule[]>;
  update(scheduleId: string, input: UpdateScheduleInput): Promise<PublishSchedule>;
}

interface ScheduleRepositoryDeps {
  now?: RepositoryClock;
  createId?: RepositoryIdFactory;
  seed?: PublishSchedule[];
}

export function createScheduleRepository(deps: ScheduleRepositoryDeps = {}): ScheduleRepository {
  const now = deps.now ?? systemClock;
  const createId = deps.createId ?? createSequentialIdFactory();
  const schedules = new Map((deps.seed ?? []).map((schedule) => [schedule.id, cloneSchedule(schedule)]));

  const repository = {
    async create(input: CreateScheduleInput): Promise<PublishSchedule> {
      const currentTime = now();
      const schedule: PublishSchedule = {
        id: createId("schedule"),
        articleId: input.articleId,
        articleVersion: input.articleVersion,
        channel: input.channel,
        scheduledFor: new Date(input.scheduledFor),
        status: "scheduled",
        note: input.note,
        createdAt: currentTime,
        updatedAt: currentTime
      };

      schedules.set(schedule.id, cloneSchedule(schedule));
      return cloneSchedule(schedule);
    },

    async getById(scheduleId: string): Promise<PublishSchedule | undefined> {
      const schedule = schedules.get(scheduleId);
      return schedule ? cloneSchedule(schedule) : undefined;
    },

    async listByArticleId(articleId: string): Promise<PublishSchedule[]> {
      return [...schedules.values()]
        .filter((schedule) => schedule.articleId === articleId)
        .sort(compareScheduleTime)
        .map(cloneSchedule);
    },

    async latestActiveByArticleId(articleId: string): Promise<PublishSchedule | undefined> {
      return (await repository.listByArticleId(articleId)).find((schedule) => schedule.status === "scheduled");
    },

    async listUpcoming(query: ScheduleListQuery = {}): Promise<PublishSchedule[]> {
      return [...schedules.values()]
        .filter((schedule) => {
          if (query.status && schedule.status !== query.status) return false;
          if (!query.status && schedule.status !== "scheduled") return false;
          if (query.from && schedule.scheduledFor < query.from) return false;
          if (query.to && schedule.scheduledFor > query.to) return false;
          return true;
        })
        .sort(compareScheduleTime)
        .map(cloneSchedule);
    },

    async update(scheduleId: string, input: UpdateScheduleInput): Promise<PublishSchedule> {
      const existing = schedules.get(scheduleId);
      if (!existing) {
        throw new RepositoryError("not_found", `Schedule not found: ${scheduleId}`);
      }

      const updated: PublishSchedule = {
        ...existing,
        ...input,
        scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : existing.scheduledFor,
        cancelledAt: input.cancelledAt ? new Date(input.cancelledAt) : existing.cancelledAt,
        updatedAt: now()
      };

      schedules.set(scheduleId, cloneSchedule(updated));
      return cloneSchedule(updated);
    }
  };

  return repository;
}

export class InMemoryScheduleRepository implements ScheduleRepository {
  private readonly repository: ScheduleRepository;

  constructor(
    now: RepositoryClock = systemClock,
    createId: RepositoryIdFactory = createSequentialIdFactory(),
    seed?: PublishSchedule[]
  ) {
    this.repository = createScheduleRepository({ now, createId, seed });
  }

  create(input: CreateScheduleInput): Promise<PublishSchedule> {
    return this.repository.create(input);
  }

  getById(scheduleId: string): Promise<PublishSchedule | undefined> {
    return this.repository.getById(scheduleId);
  }

  listByArticleId(articleId: string): Promise<PublishSchedule[]> {
    return this.repository.listByArticleId(articleId);
  }

  latestActiveByArticleId(articleId: string): Promise<PublishSchedule | undefined> {
    return this.repository.latestActiveByArticleId(articleId);
  }

  listUpcoming(query?: ScheduleListQuery): Promise<PublishSchedule[]> {
    return this.repository.listUpcoming(query);
  }

  update(scheduleId: string, input: UpdateScheduleInput): Promise<PublishSchedule> {
    return this.repository.update(scheduleId, input);
  }
}

export function cloneSchedule(schedule: PublishSchedule): PublishSchedule {
  return {
    ...schedule,
    scheduledFor: new Date(schedule.scheduledFor),
    cancelledAt: schedule.cancelledAt ? new Date(schedule.cancelledAt) : undefined,
    createdAt: new Date(schedule.createdAt),
    updatedAt: new Date(schedule.updatedAt)
  };
}

function compareScheduleTime(left: PublishSchedule, right: PublishSchedule): number {
  return left.scheduledFor.getTime() - right.scheduledFor.getTime()
    || left.createdAt.getTime() - right.createdAt.getTime()
    || left.id.localeCompare(right.id);
}
