// src/storage/projectDbTypes.ts
import type { RowData } from "../core/TableTypes";
import type { AppColumnDef } from "../progress/tableCommands";
import type { ProjectInfo } from "../progress/ProjectModal";
import type { CalendarEntry } from "../progress/CalendarModal";

export type ProgressProjectSnapshotV1 = {
  v: 1;

  // Human friendly name (for list)
  title: string;

  // Data
  rows: RowData[];
  appColumns: AppColumnDef[];

  // Extras that affect behavior/derived data
  projectInfo: ProjectInfo;
  calendarEntries: CalendarEntry[];

  // Optional UI prefs (safe to evolve)
  ui?: {
    splitLeft?: number;
    ganttZoomIdx?: number;
    ganttWeekendShade?: boolean;
    ganttTodayLine?: boolean;
    ganttShowBarText?: boolean;
    ganttDefaultBarColor?: string;
  };
};

export type ProjectListItem = {
  id: string;
  title: string;
  updatedAt: string; // ISO
  createdAt: string; // ISO
};

export type ProjectRecord = {
  id: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  title: string;
  snapshot: ProgressProjectSnapshotV1;
};

export type ProjectDb = {
  list(): Promise<ProjectListItem[]>;
  get(id: string): Promise<ProjectRecord | null>;
  upsert(input: { id?: string; title: string; snapshot: ProgressProjectSnapshotV1 }): Promise<ProjectRecord>;
  remove(id: string): Promise<void>;
  duplicate(id: string): Promise<ProjectRecord | null>;
};
