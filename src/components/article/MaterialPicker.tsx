import type { MaterialAsset } from "../../services/contracts.ts";

interface MaterialPickerProps {
  imageId: string;
  materials: MaterialAsset[];
  readOnly: boolean;
}

export default function MaterialPicker({ imageId, materials, readOnly }: MaterialPickerProps) {
  const disabled = readOnly || materials.length === 0;

  return (
    <section
      aria-labelledby={`${imageId}-material-picker-heading`}
      style={{
        background: "#f8fafc",
        border: "1px solid #d9e2ec",
        borderRadius: 8,
        display: "grid",
        gap: 12,
        padding: 12
      }}
    >
      <div style={{ alignItems: "start", display: "flex", gap: 12, justifyContent: "space-between" }}>
        <div>
          <h3 id={`${imageId}-material-picker-heading`} style={{ color: "#102a43", fontSize: 14, margin: 0 }}>
            素材库
          </h3>
          <p style={{ color: "#627d98", fontSize: 12, margin: "4px 0 0" }}>{materials.length} 张可选素材</p>
        </div>
        <span style={{ color: "#0f766e", fontSize: 12, fontWeight: 700 }}>material</span>
      </div>

      <form aria-label={`选择素材库图片 ${imageId}`} style={{ display: "grid", gap: 10 }}>
        <input type="hidden" value="material" name="type" />
        <label style={{ color: "#243b53", display: "grid", fontSize: 13, fontWeight: 700, gap: 6 }}>
          选择素材
          <select
            disabled={disabled}
            name="materialId"
            style={{ border: "1px solid #bcccdc", borderRadius: 6, font: "inherit", padding: 10 }}
          >
            {materials.map((material) => (
              <option key={material.id} value={material.id}>
                {material.title}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: "grid", gap: 8 }}>
          {materials.map((material) => (
            <div
              key={material.id}
              style={{
                background: "#ffffff",
                border: "1px solid #e5eaf0",
                borderRadius: 6,
                display: "grid",
                gap: 4,
                padding: 10
              }}
            >
              <strong style={{ color: "#102a43", fontSize: 13 }}>{material.title}</strong>
              <span style={{ color: "#52606d", fontSize: 12, lineHeight: 1.5 }}>{material.description}</span>
              <span style={{ color: "#627d98", fontSize: 12 }}>{material.tags.join(" / ")}</span>
            </div>
          ))}
        </div>

        <button
          disabled={disabled}
          style={{
            background: disabled ? "#d9e2ec" : "#0f766e",
            border: 0,
            borderRadius: 6,
            color: "#ffffff",
            font: "inherit",
            fontWeight: 700,
            justifySelf: "start",
            padding: "9px 12px"
          }}
          type="submit"
        >
          使用素材
        </button>
      </form>
    </section>
  );
}
