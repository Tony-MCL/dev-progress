// src/storage/progressLocalKeys.ts

export const PROGRESS_KEYS = {
  // Project identity
  currentProjectId: "progress_currentProjectId",

  // Free "single project" snapshot (localStorage)
  freeProjectSnapshotV1: "progress_freeProjectSnapshotV1",

  // UI
  splitLeft: "progress_splitLeft",

  // Gantt
  ganttZoomIdx: "progress_ganttZoomIdx",
  ganttWeekendShade: "progress_ganttWeekendShade",
  ganttTodayLine: "progress_ganttTodayLine",

  // ✅ NYTT: Gantt bar-tekst + standardfarge
  ganttShowBarText: "progress_ganttShowBarText",
  ganttDefaultBarColor: "progress_ganttDefaultBarColor",
} as const;

export type ProgressLocalKey = keyof typeof PROGRESS_KEYS;
