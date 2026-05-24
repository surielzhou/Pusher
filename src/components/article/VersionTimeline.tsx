"use client";

import type { ArticleVersionSnapshot } from "../../domain/version.ts";

interface VersionTimelineProps {
  versions: ArticleVersionSnapshot[];
  selectedVersionId?: string;
  onSelectVersion?: (versionId: string) => void;
}

function formatVersionDate(value: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

export default function VersionTimeline({
  versions,
  selectedVersionId,
  onSelectVersion
}: VersionTimelineProps) {
  return (
    <section
      aria-labelledby="version-timeline-heading"
      style={{
        background: "#ffffff",
        border: "1px solid #d9e2ec",
        borderRadius: 8,
        padding: 20
      }}
    >
      <header style={{ display: "grid", gap: 6 }}>
        <p style={{ color: "#0f766e", fontSize: 13, fontWeight: 700, margin: 0 }}>版本时间线</p>
        <h2 id="version-timeline-heading" style={{ color: "#102a43", fontSize: 22, lineHeight: 1.25, margin: 0 }}>
          内容版本回看
        </h2>
      </header>

      <ol style={{ display: "grid", gap: 12, listStyle: "none", margin: "18px 0 0", padding: 0 }}>
        {versions.map((version) => {
          const selected = version.id === selectedVersionId;

          return (
            <li
              key={version.id}
              style={{
                background: selected ? "#e6fffa" : "#f8fafc",
                border: selected ? "1px solid #5eead4" : "1px solid #e5eaf0",
                borderRadius: 8,
                padding: 14
              }}
            >
              <button
                aria-pressed={selected}
                onClick={() => onSelectVersion?.(version.id)}
                style={{
                  background: "transparent",
                  border: 0,
                  color: "#102a43",
                  cursor: onSelectVersion ? "pointer" : "default",
                  display: "grid",
                  font: "inherit",
                  gap: 8,
                  padding: 0,
                  textAlign: "left",
                  width: "100%"
                }}
                type="button"
              >
                <span style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <strong>v{version.contentVersion}</strong>
                  <span
                    style={{
                      background: "#ffffff",
                      border: "1px solid #d9e2ec",
                      borderRadius: 999,
                      color: "#52606d",
                      fontSize: 12,
                      fontWeight: 700,
                      padding: "3px 8px"
                    }}
                  >
                    {version.label || version.reason || "未标记版本"}
                  </span>
                </span>
                <span style={{ color: "#52606d", fontSize: 13, lineHeight: 1.5 }}>
                  {formatVersionDate(version.createdAt)} / {version.status}
                  {version.reason ? ` / ${version.reason}` : ""}
                </span>
                <span style={{ color: "#243b53", fontSize: 14, lineHeight: 1.6 }}>
                  {version.title || "未命名图文"}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
