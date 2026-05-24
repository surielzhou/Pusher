import SchedulePanel, { formatScheduleTime } from "../../components/publish/SchedulePanel.tsx";
import type { Article } from "../../domain/article.ts";
import type { PublishSchedule } from "../../domain/schedule.ts";
import { canPreparePublish } from "../../services/articleStatusService.ts";

interface ScheduleRow {
  article: Article;
  schedule: PublishSchedule;
}

function buildArticle(input: {
  id: string;
  title: string;
  status: Article["status"];
  topic: string;
  summary: string;
  updatedAt: string;
}): Article {
  return {
    id: input.id,
    title: input.title,
    summary: input.summary,
    body: "用于发布排期页展示的文章正文占位。",
    category: "finance",
    status: input.status,
    generationConfig: {
      category: "finance",
      topic: input.topic,
      audience: "公众号读者",
      requireRiskNote: true
    },
    riskNote: "本文不构成投资建议。",
    contentVersion: 4,
    reviewedVersion: input.status === "approved" || input.status === "pending_publish" ? 4 : undefined,
    createdAt: new Date("2026-05-06T08:00:00.000Z"),
    updatedAt: new Date(input.updatedAt)
  };
}

function buildSchedule(article: Article, input: {
  id: string;
  scheduledFor: string;
  status?: PublishSchedule["status"];
  note?: string;
}): PublishSchedule {
  return {
    id: input.id,
    articleId: article.id,
    articleVersion: article.contentVersion,
    channel: "wechat_manual",
    scheduledFor: new Date(input.scheduledFor),
    status: input.status ?? "scheduled",
    note: input.note,
    createdAt: new Date("2026-05-06T11:10:00.000Z"),
    updatedAt: new Date("2026-05-06T11:10:00.000Z")
  };
}

function getScheduleRows(): ScheduleRow[] {
  const morningArticle = buildArticle({
    id: "schedule_finance_morning",
    title: "AI 投研工具早间观察",
    status: "pending_publish",
    topic: "AI 投研工具",
    summary: "已通过 review，计划在早间发布。",
    updatedAt: "2026-05-06T11:20:00.000Z"
  });
  const eveningArticle = buildArticle({
    id: "schedule_market_evening",
    title: "宏观市场晚间复盘",
    status: "approved",
    topic: "宏观市场",
    summary: "已通过 review，等待运营确认发布时间。",
    updatedAt: "2026-05-06T10:50:00.000Z"
  });

  return [
    {
      article: morningArticle,
      schedule: buildSchedule(morningArticle, {
        id: "schedule_001",
        scheduledFor: "2026-05-07T01:30:00.000Z",
        note: "早高峰推送"
      })
    },
    {
      article: eveningArticle,
      schedule: buildSchedule(eveningArticle, {
        id: "schedule_002",
        scheduledFor: "2026-05-07T12:00:00.000Z",
        note: "晚间复盘栏目"
      })
    }
  ];
}

export default function SchedulePage() {
  const upcomingSchedules = getScheduleRows();
  const selected = upcomingSchedules[0];
  const canSchedule = selected
    ? canPreparePublish(selected.article.status) && selected.article.reviewedVersion === selected.article.contentVersion
    : false;

  return (
    <main
      style={{
        background: "#f7f8fa",
        minHeight: "100vh",
        padding: "32px clamp(16px, 4vw, 48px)"
      }}
    >
      <div style={{ display: "grid", gap: 22, margin: "0 auto", maxWidth: 1240 }}>
        <header style={{ alignItems: "end", display: "flex", gap: 16, justifyContent: "space-between" }}>
          <div>
            <p style={{ color: "#0f766e", fontSize: 13, fontWeight: 700, margin: "0 0 6px" }}>发布排期</p>
            <h1 style={{ color: "#102a43", fontSize: 30, lineHeight: 1.2, margin: 0 }}>排期日历</h1>
          </div>
          <a href="/workbench" style={secondaryLinkStyle}>
            返回工作台
          </a>
        </header>

        <div style={{ display: "grid", gap: 20, gridTemplateColumns: "minmax(320px, 0.9fr) minmax(0, 1.1fr)" }}>
          {selected ? (
            <SchedulePanel article={selected.article} canSchedule={canSchedule} nextSchedule={selected.schedule} />
          ) : null}

          <section
            aria-labelledby="schedule-list-heading"
            style={{
              background: "#ffffff",
              border: "1px solid #d9e2ec",
              borderRadius: 8,
              padding: 20
            }}
          >
            <h2 id="schedule-list-heading" style={{ color: "#102a43", fontSize: 20, margin: 0 }}>
              排期列表
            </h2>
            <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
              {upcomingSchedules.map(({ article, schedule }) => (
                <article key={schedule.id} style={scheduleRowStyle}>
                  <div style={{ display: "grid", gap: 5 }}>
                    <a href={`/articles/${article.id}/publish`} style={titleLinkStyle}>
                      {article.title}
                    </a>
                    <small style={{ color: "#627d98" }}>{article.summary}</small>
                  </div>
                  <time dateTime={schedule.scheduledFor.toISOString()}>{formatScheduleTime(schedule.scheduledFor)}</time>
                  <span>{schedule.channel}</span>
                  <span>{schedule.status}</span>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

const secondaryLinkStyle = {
  border: "1px solid #bcccdc",
  borderRadius: 6,
  color: "#243b53",
  fontWeight: 700,
  padding: "8px 10px",
  textDecoration: "none"
};

const scheduleRowStyle = {
  alignItems: "center",
  background: "#f8fafc",
  border: "1px solid #e5eaf0",
  borderRadius: 8,
  color: "#334e68",
  display: "grid",
  gap: 12,
  gridTemplateColumns: "minmax(220px, 1.5fr) 160px 120px 100px",
  lineHeight: 1.5,
  padding: 14
};

const titleLinkStyle = {
  color: "#102a43",
  fontWeight: 700,
  textDecoration: "none"
};
