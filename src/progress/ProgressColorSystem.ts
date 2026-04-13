// ===============================
// src/progress/ProgressColorSystem.ts
// ===============================

export type ProgressSwatch = {
  id: string;
  label: string;
  hex: string;
  text: "#111111" | "#ffffff";
};

// Fast rekkefølge (muskelminne):
// 1-3 Blå, 4-6 Grønn, 7-9 Rød/Oransje/Gul, 10 Teal, 11 Lilla, 12 Grå

export const PROGRESS_GLOBAL_BAR_PALETTE: ProgressSwatch[] = [
  { id: "blueLight", label: "Light Blue", hex: "#6B8FB3", text: "#ffffff" },
  { id: "blueSteel", label: "Steel Blue", hex: "#4F6F8F", text: "#ffffff" },
  { id: "blueNavy", label: "Navy", hex: "#2E4A66", text: "#ffffff" },

  { id: "greenLight", label: "Light Green", hex: "#7FA67F", text: "#111111" },
  { id: "greenMoss", label: "Moss Green", hex: "#5F875F", text: "#ffffff" },
  { id: "greenForest", label: "Forest", hex: "#3F633F", text: "#ffffff" },

  { id: "redBrick", label: "Brick", hex: "#9A4F4F", text: "#ffffff" },
  { id: "orangeBurnt", label: "Burnt Orange", hex: "#B36A3C", text: "#ffffff" },
  { id: "yellowMustard", label: "Mustard", hex: "#B89A3C", text: "#111111" },

  { id: "tealDeep", label: "Teal", hex: "#3F7F7A", text: "#ffffff" },
  { id: "violetMuted", label: "Muted Violet", hex: "#6E5A8A", text: "#ffffff" },
  { id: "greyMid", label: "Mid Grey", hex: "#6F6F6F", text: "#ffffff" },
];

export const PROGRESS_RESPONSIBILITY_PALETTE: ProgressSwatch[] = [
  { id: "blueClear", label: "Clear Blue", hex: "#2F80ED", text: "#ffffff" },
  { id: "blueRoyal", label: "Royal Blue", hex: "#1C5CCF", text: "#ffffff" },
  { id: "blueDeep", label: "Deep Navy", hex: "#153E75", text: "#ffffff" },

  { id: "greenClear", label: "Clear Green", hex: "#27AE60", text: "#ffffff" },
  { id: "greenStrong", label: "Strong Green", hex: "#1E874B", text: "#ffffff" },
  { id: "greenDeep", label: "Deep Green", hex: "#145A32", text: "#ffffff" },

  { id: "redClear", label: "Clear Red", hex: "#D64545", text: "#ffffff" },
  { id: "orangeStrong", label: "Strong Orange", hex: "#E67E22", text: "#111111" },
  { id: "yellowGolden", label: "Golden Yellow", hex: "#D4A017", text: "#111111" },

  { id: "tealClear", label: "Clear Teal", hex: "#1ABC9C", text: "#111111" },
  { id: "purpleStrong", label: "Strong Purple", hex: "#7D3C98", text: "#ffffff" },
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
