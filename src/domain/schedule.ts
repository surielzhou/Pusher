export const SCHEDULE_STATUSES = ["scheduled", "cancelled"] as const;

export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

export interface PublishSchedule {
  id: string;
  articleId: string;
  articleVersion: number;
  channel: "wechat_manual" | string;
  scheduledFor: Date;
  status: ScheduleStatus;
  note?: string;
  cancelReason?: string;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
