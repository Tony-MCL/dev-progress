// ===============================
// src/progress/ProgressColorSystem.ts
// ===============================

export type ProgressSwatch = {
  id: string;
  label: string;
  hex: string;
  text: "#111111" | "#ffffff";
};

// Mål:
// - Tydeligere spekter
// - Færre "nesten like"
// - Mer klare farger, mindre dushet
// - Sortert med lignende farger etter hverandre
//
// Rekkefølge:
// 1-3  Blå
// 4-5  Cyan / Teal
// 6-8  Grønn
// 9-10 Gul / Amber
// 11-12 Oransje
// 13-15 Rød / Burgunder
// 16-18 Lilla / Slate / Grå

export const PROGRESS_GLOBAL_BAR_PALETTE: ProgressSwatch[] = [
  { id: "blueSky", label: "Sky Blue", hex: "#4A90E2", text: "#ffffff" },
  { id: "blueRoyal", label: "Royal Blue", hex: "#2F6FE4", text: "#ffffff" },
  { id: "blueNavy", label: "Navy", hex: "#1E3A8A", text: "#ffffff" },

  { id: "cyanClear", label: "Clear Cyan", hex: "#2DA8D8", text: "#ffffff" },
  { id: "tealClear", label: "Clear Teal", hex: "#1FA38A", text: "#ffffff" },

  { id: "greenFresh", label: "Fresh Green", hex: "#4CAF50", text: "#ffffff" },
  { id: "greenStrong", label: "Strong Green", hex: "#2E8B57", text: "#ffffff" },
  { id: "greenForest", label: "Forest", hex: "#1F6B45", text: "#ffffff" },

  { id: "yellowGolden", label: "Golden Yellow", hex: "#D4A017", text: "#111111" },
  { id: "amberWarm", label: "Warm Amber", hex: "#C88719", text: "#111111" },

  { id: "orangeClear", label: "Clear Orange", hex: "#E67E22", text: "#111111" },
  { id: "orangeBurnt", label: "Burnt Orange", hex: "#C96A1B", text: "#ffffff" },

  { id: "redClear", label: "Clear Red", hex: "#D64545", text: "#ffffff" },
  { id: "redBrick", label: "Brick Red", hex: "#B03A3A", text: "#ffffff" },
  { id: "burgundy", label: "Burgundy", hex: "#7E2F4F", text: "#ffffff" },

  { id: "purpleStrong", label: "Strong Purple", hex: "#7D3C98", text: "#ffffff" },
  { id: "slateBlue", label: "Slate Blue", hex: "#5C6FA3", text: "#ffffff" },
  { id: "greyMid", label: "Mid Grey", hex: "#6B7280", text: "#ffffff" },
];

export const PROGRESS_RESPONSIBILITY_PALETTE: ProgressSwatch[] = [
  { id: "blueSky", label: "Sky Blue", hex: "#3FA0FF", text: "#ffffff" },
  { id: "blueRoyal", label: "Royal Blue", hex: "#2F80ED", text: "#ffffff" },
  { id: "blueNavy", label: "Navy", hex: "#1C4FB8", text: "#ffffff" },

  { id: "cyanClear", label: "Clear Cyan", hex: "#20B8D4", text: "#111111" },
  { id: "tealClear", label: "Clear Teal", hex: "#1ABC9C", text: "#111111" },

  { id: "greenFresh", label: "Fresh Green", hex: "#34C759", text: "#111111" },
  { id: "greenClear", label: "Clear Green", hex: "#27AE60", text: "#ffffff" },
  { id: "greenDeep", label: "Deep Green", hex: "#1E874B", text: "#ffffff" },

  { id: "yellowGolden", label: "Golden Yellow", hex: "#E0B400", text: "#111111" },
  { id: "amberClear", label: "Clear Amber", hex: "#F5A623", text: "#111111" },

  { id: "orangeClear", label: "Clear Orange", hex: "#F28C28", text: "#111111" },
  { id: "orangeDeep", label: "Deep Orange", hex: "#D96B1D", text: "#ffffff" },

  { id: "redClear", label: "Clear Red", hex: "#E74C3C", text: "#ffffff" },
  { id: "redStrong", label: "Strong Red", hex: "#C0392B", text: "#ffffff" },
  { id: "burgundy", label: "Burgundy", hex: "#8E2948", text: "#ffffff" },

  { id: "purpleStrong", label: "Strong Purple", hex: "#8E44AD", text: "#ffffff" },
  { id: "slateBlue", label: "Slate Blue", hex: "#607D8B", text: "#ffffff" },
  { id: "greyDark", label: "Dark Grey", hex: "#4A4A4A", text: "#ffffff" },
];

// Handy helpers (vi lagrer hex i state, men velger fra palett)
export function isValidHexColor(v: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(String(v || ""));
}

export function normalizeHex(v: string, fallback: string): string {
  const s = String(v || "").trim();
  return isValidHexColor(s) ? s.toUpperCase() : fallback.toUpperCase();
}
