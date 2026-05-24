"use client";

import { type CSSProperties, type FormEvent, useState } from "react";
import type { ContentCategory } from "../../domain/status.ts";
import {
  CATEGORY_OPTIONS,
  CREATE_ARTICLE_ENDPOINT,
  buildGenerationPayload,
  isGenerationInputReady,
  resolveArticleGenerationEndpoint,
  resolveGenerationFailureMessage,
  resolveGenerationRedirect,
  type GenerationFormInput,
  type GenerationFailurePayload
} from "./generationFormModel.ts";

type SubmitState = "idle" | "submitting" | "failed";

const initialInput: GenerationFormInput = {
  category: "",
  topic: "",
  audience: "",
  style: "",
  length: "",
  references: ""
};

export default function GenerationForm() {
  const [input, setInput] = useState<GenerationFormInput>(initialInput);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [lastFailure, setLastFailure] = useState("");
  const [createdArticleId, setCreatedArticleId] = useState("");
  const canGenerate = isGenerationInputReady(input);

  function updateField(field: keyof GenerationFormInput) {
    return (event: { target: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement }) => {
      const value = event.target.value;
      setCreatedArticleId("");
      setInput((current) => ({
        ...current,
        [field]: value
      }));
    };
  }

  function updateCategory(category: ContentCategory) {
    setCreatedArticleId("");
    setInput((current) => ({
      ...current,
      category
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canGenerate || submitState === "submitting") return;

    setSubmitState("submitting");
    setLastFailure("");

    try {
      let articleId = createdArticleId;

      if (!createdArticleId) {
        const payload = buildGenerationPayload(input);
        const createdResponse = await fetch(CREATE_ARTICLE_ENDPOINT, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        const created = (await readGenerationResponse(createdResponse)) as
          | ({ data?: { articleId?: string } } & GenerationFailurePayload)
          | undefined;

        if (!createdResponse.ok) {
          throw new Error(resolveGenerationFailureMessage(created?.error ? created : undefined));
        }

        articleId = created?.data?.articleId ?? "";
      }

      if (!createdArticleId) {
        setCreatedArticleId(articleId);
      }

      const generatedResponse = await fetch(resolveArticleGenerationEndpoint(articleId), {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({})
      });

      const generated = (await readGenerationResponse(generatedResponse)) as GenerationFailurePayload | undefined;
      if (!generatedResponse.ok) {
        throw new Error(resolveGenerationFailureMessage(generated));
      }

      window.location.assign(resolveGenerationRedirect(articleId));
    } catch (error) {
      setSubmitState("failed");
      setLastFailure(error instanceof Error ? error.message : "生成失败，请重试。");
    }
  }

  return (
    <section aria-labelledby="generation-form-title" style={styles.panel}>
      <div style={styles.header}>
        <p style={styles.kicker}>文章创建</p>
        <h1 id="generation-form-title" style={styles.title}>
          生成配置
        </h1>
      </div>

      <form onSubmit={handleSubmit} style={styles.form}>
        <fieldset style={styles.fieldset}>
          <legend style={styles.label}>内容方向</legend>
          <div style={styles.segmentGrid}>
            {CATEGORY_OPTIONS.map((option) => {
              const selected = input.category === option.value;

              return (
                <label
                  key={option.value}
                  style={{
                    ...styles.segment,
                    ...(selected ? styles.segmentSelected : undefined)
                  }}
                >
                  <input
                    checked={selected}
                    name="category"
                    onChange={() => updateCategory(option.value)}
                    required
                    style={styles.radio}
                    type="radio"
                    value={option.value}
                  />
                  <span style={styles.segmentLabel}>{option.label}</span>
                  <span style={styles.segmentDetail}>{option.detail}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <label style={styles.field}>
          <span style={styles.label}>主题或关键词</span>
          <input
            autoComplete="off"
            name="topic"
            onChange={updateField("topic")}
            placeholder="如：AI Agent 产品化趋势"
            required
            style={styles.input}
            value={input.topic}
          />
        </label>

        <div style={styles.twoColumn}>
          <label style={styles.field}>
            <span style={styles.label}>目标读者</span>
            <input
              name="audience"
              onChange={updateField("audience")}
              placeholder="如：产品经理、创业者"
              style={styles.input}
              value={input.audience}
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>文章风格</span>
            <input
              name="style"
              onChange={updateField("style")}
              placeholder="如：克制、深度、观点鲜明"
              style={styles.input}
              value={input.style}
            />
          </label>
        </div>

        <label style={styles.field}>
          <span style={styles.label}>篇幅要求</span>
          <select name="length" onChange={updateField("length")} style={styles.input} value={input.length}>
            <option value="">默认篇幅</option>
            <option value="800-1000 字">800-1000 字</option>
            <option value="1200-1500 字">1200-1500 字</option>
            <option value="1800-2200 字">1800-2200 字</option>
          </select>
        </label>

        <label style={styles.field}>
          <span style={styles.label}>参考素材</span>
          <textarea
            name="references"
            onChange={updateField("references")}
            placeholder="每行一条参考素材"
            rows={5}
            style={styles.textarea}
            value={input.references}
          />
        </label>

        {submitState === "failed" ? (
          <div role="alert" style={styles.failure}>
            <span>{lastFailure}</span>
            <button disabled={!canGenerate || submitState === "submitting"} style={styles.retryButton} type="submit">
              重试
            </button>
          </div>
        ) : null}

        <div style={styles.actions}>
          <button disabled={!canGenerate || submitState === "submitting"} style={styles.primaryButton} type="submit">
            {submitState === "submitting" ? "生成中..." : "生成文章"}
          </button>
        </div>
      </form>
    </section>
  );
}

async function readGenerationResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

const styles: Record<string, CSSProperties> = {
  panel: {
    width: "min(100%, 760px)",
    border: "1px solid #d8dee8",
    borderRadius: 8,
    background: "#ffffff",
    boxShadow: "0 18px 45px rgba(31, 41, 51, 0.08)",
    padding: 32
  },
  header: {
    display: "grid",
    gap: 6,
    marginBottom: 28
  },
  kicker: {
    margin: 0,
    color: "#0f766e",
    fontSize: 14,
    fontWeight: 700
  },
  title: {
    margin: 0,
    color: "#111827",
    fontSize: 28,
    fontWeight: 700,
    lineHeight: 1.2
  },
  form: {
    display: "grid",
    gap: 20
  },
  fieldset: {
    display: "grid",
    gap: 10,
    margin: 0,
    padding: 0,
    border: 0
  },
  label: {
    color: "#26313f",
    fontSize: 14,
    fontWeight: 700
  },
  segmentGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 10
  },
  segment: {
    display: "grid",
    gap: 6,
    minHeight: 92,
    border: "1px solid #cfd7e3",
    borderRadius: 8,
    background: "#fbfcfe",
    cursor: "pointer",
    padding: 14
  },
  segmentSelected: {
    borderColor: "#0f766e",
    background: "#effaf7",
    boxShadow: "inset 0 0 0 1px #0f766e"
  },
  radio: {
    position: "absolute",
    opacity: 0,
    pointerEvents: "none"
  },
  segmentLabel: {
    color: "#111827",
    fontSize: 16,
    fontWeight: 700
  },
  segmentDetail: {
    color: "#4b5563",
    fontSize: 13,
    lineHeight: 1.45
  },
  field: {
    display: "grid",
    gap: 8
  },
  twoColumn: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16
  },
  input: {
    width: "100%",
    minHeight: 42,
    border: "1px solid #cfd7e3",
    borderRadius: 6,
    color: "#111827",
    font: "inherit",
    padding: "9px 11px"
  },
  textarea: {
    width: "100%",
    minHeight: 118,
    resize: "vertical",
    border: "1px solid #cfd7e3",
    borderRadius: 6,
    color: "#111827",
    font: "inherit",
    padding: "10px 11px"
  },
  failure: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    border: "1px solid #f0b4a8",
    borderRadius: 6,
    background: "#fff4f1",
    color: "#9f2a16",
    padding: "12px 14px"
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end"
  },
  primaryButton: {
    minWidth: 128,
    minHeight: 42,
    border: 0,
    borderRadius: 6,
    background: "#0f766e",
    color: "#ffffff",
    cursor: "pointer",
    font: "inherit",
    fontWeight: 700,
    padding: "10px 16px"
  },
  retryButton: {
    minHeight: 34,
    border: "1px solid #d65a3a",
    borderRadius: 6,
    background: "#ffffff",
    color: "#9f2a16",
    cursor: "pointer",
    font: "inherit",
    fontWeight: 700,
    padding: "6px 12px"
  }
};

export default GenerationForm;
