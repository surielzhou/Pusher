import type { Article } from "../../domain/article.ts";
import type { PublishSchedule } from "../../domain/schedule.ts";

interface SchedulePanelProps {
  article: Article;
  canSchedule: boolean;
  nextSchedule?: PublishSchedule;
}

const buttonBaseStyle = {
  border: 0,
  borderRadius: 6,
  color: "#ffffff",
  font: "inherit",
  fontWeight: 700,
  justifySelf: "start",
  minHeight: 40,
  padding: "10px 14px"
};

function getButtonStyle(disabled: boolean, background: string) {
  return {
    ...buttonBaseStyle,
    background: disabled ? "#d9e2ec" : background,
    color: disabled ? "#52606d" : "#ffffff"
  };
}

export default function SchedulePanel({ article, canSchedule, nextSchedule }: SchedulePanelProps) {
  const scheduleBlocked = !canSchedule;
  const nextScheduleTime = nextSchedule ? formatScheduleTime(nextSchedule.scheduledFor) : undefined;
  const defaultScheduleValue = toDateTimeLocalValue(nextSchedule?.scheduledFor ?? getDefaultScheduleTime());

  return (
    <section
      aria-labelledby="publish-schedule-heading"
      style={{
        background: "#ffffff",
        border: "1px solid #d9e2ec",
        borderRadius: 8,
        padding: 20
      }}
    >
      <header style={{ alignItems: "start", display: "flex", gap: 16, justifyContent: "space-between" }}>
        <div>
          <p style={{ color: "#0f766e", fontSize: 13, fontWeight: 700, margin: "0 0 6px" }}>发布排期</p>
          <h2 id="publish-schedule-heading" style={{ color: "#102a43", fontSize: 22, lineHeight: 1.25, margin: 0 }}>
            下一次计划发布时间
          </h2>
        </div>
        <span
          style={{
            background: nextSchedule ? "#ecfdf5" : "#f0f4f8",
            borderRadius: 999,
            color: nextSchedule ? "#047857" : "#52606d",
            fontSize: 12,
            fontWeight: 700,
            padding: "5px 10px",
            whiteSpace: "nowrap"
          }}
        >
          {nextSchedule?.status ?? "未排期"}
        </span>
      </header>

      {scheduleBlocked ? (
        <div
          role="alert"
          style={{
            background: "#fff5f5",
            border: "1px solid #ffd6d6",
            borderRadius: 8,
            color: "#9b1c1c",
            lineHeight: 1.6,
            marginTop: 16,
            padding: 14
          }}
        >
          排期阻断：{getBlockedReason(article)}
        </div>
      ) : (
        <div
          role="status"
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: 8,
            color: "#166534",
            lineHeight: 1.6,
            marginTop: 16,
            padding: 14
          }}
        >
          {nextScheduleTime ? `已排期：${nextScheduleTime}` : "Review 已通过，可以创建公众号计划发布时间。"}
        </div>
      )}

      <form action={`/articles/${article.id}/schedule`} data-action={nextSchedule ? "reschedule" : "createSchedule"} style={formStyle}>
        {nextSchedule ? <input name="scheduleId" type="hidden" value={nextSchedule.id} /> : null}
        <input name="articleId" type="hidden" value={article.id} />
        <input name="channel" type="hidden" value="wechat_manual" />
        <label style={labelStyle}>
          计划发布时间
          <input
            defaultValue={defaultScheduleValue}
            disabled={scheduleBlocked}
            name="scheduledFor"
            required
            style={inputStyle}
            type="datetime-local"
          />
        </label>
        <label style={labelStyle}>
          排期备注
          <textarea
            defaultValue={nextSchedule?.note ?? ""}
            disabled={scheduleBlocked}
            name="note"
            placeholder="记录推送窗口、栏目或运营提醒"
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </label>
        <button disabled={scheduleBlocked} style={getButtonStyle(scheduleBlocked, "#0f766e")} type="submit">
          {nextSchedule ? "修改排期" : "创建排期"}
        </button>
      </form>

      {nextSchedule ? (
        <form action={`/articles/${article.id}/schedule`} data-action="cancelSchedule" style={cancelFormStyle}>
          <input name="scheduleId" type="hidden" value={nextSchedule.id} />
          <label style={labelStyle}>
            取消原因
            <textarea
              disabled={scheduleBlocked}
              name="cancelReason"
              placeholder="记录取消排期原因"
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </label>
          <button disabled={scheduleBlocked} style={getButtonStyle(scheduleBlocked, "#9b1c1c")} type="submit">
            取消排期
          </button>
        </form>
      ) : null}
    </section>
  );
}

function getBlockedReason(article: Article): string {
  if (article.reviewedVersion !== article.contentVersion) {
    return "内容版本已变化，需要重新 review 后才能进入排期。";
  }

  if (article.status === "not_publish") {
    return "文章已被标记为暂不发布，不能创建发布排期。";
  }

  if (article.status === "pending_review" || article.status === "review_rejected") {
    return "文章未通过 review，不能创建发布排期。";
  }

  return "当前状态不能创建排期，仅 approved 或 pending_publish 状态可继续。";
}

function getDefaultScheduleTime(): Date {
  return new Date("2026-05-07T09:00:00.000Z");
}

export function formatScheduleTime(value: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

function toDateTimeLocalValue(value: Date): string {
  const offsetMs = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}

const formStyle = {
  borderTop: "1px solid #e5eaf0",
  display: "grid",
  gap: 12,
  marginTop: 16,
  paddingTop: 16
};

const cancelFormStyle = {
  ...formStyle,
  marginTop: 14
};

const labelStyle = {
  color: "#243b53",
  display: "grid",
  fontSize: 13,
  fontWeight: 700,
  gap: 6
};

const inputStyle = {
  border: "1px solid #bcccdc",
  borderRadius: 6,
  font: "inherit",
  padding: 11
};
