# Progress – Quick Navigation (Where to change what)

## Start here
- **Main orchestrator + layout wiring**
  - `src/App.tsx`

---

## Gantt (UI / zoom / toggles / colors)
- **Zoom levels, pxPerDay, weekend shading, today line, bar text, default bar color + persistence**
  - `src/progress/app/useGanttUiSettings.ts`
- **Zoom behavior (zoom in/out with anchor, reset) + focus helpers**
  - `src/progress/app/useProgressProjectIO.ts`
- **Gantt rendering / visuals**
  - `src/progress/GanttView.tsx`
  - `src/styles/gantt.css`

---

## Split between Table and Gantt
- **Drag divider + keyboard resize + saved splitLeft**
  - `src/progress/app/useSplitPane.ts`
- **Split layout markup**
  - `src/App.tsx`
- **Split styling**
  - `src/styles/appshell.css` (split styles)
  - (ev. `src/styles/tablecore.css` / `src/styles/gantt.css` hvis relevant)

---

## Table editing / commit rules / popovers
- **onRowsChange + recompute flow (freeze row), onCellCommit, weekend warning, duration popover**
  - `src/progress/app/useProgressRowEditing.ts`
- **Auto schedule recompute**
  - `src/progress/autoSchedule.ts`
- **Weekend/Duration popover UI components**
  - `src/progress/AdjustPopovers.tsx`
- **Date parsing/formatting helpers used in editing**
  - `src/progress/ProgressCore.ts`

---

## Date picker UI
- **Date picker request state + open/close handling**
  - `src/progress/app/useDatePickerPopover.ts`
- **Date picker UI component**
  - `src/progress/AppDatePickerPopover.tsx`
- **Who triggers it**
  - `src/App.tsx` (TableCore prop: `onRequestDatePicker`)

---

## Columns (visibility, custom columns, width/order)
- **Column definitions (base columns list)**
  - `src/App.tsx` (columns useMemo)
- **Column visibility, custom column add/remove, row apply helpers**
  - `src/progress/tableCommands.ts`
- **Column manager modal**
  - `src/progress/ColumnManagerModal.tsx`
- **Persist / keys for column-related settings (if used)**
  - `src/storage/progressLocalKeys.ts`
  - `src/storage/localSettings.ts`

---

## Owners (dropdown options + colors)
- **Owner options (dropdown) + owner color map**
  - `src/progress/app/useProgressViewModel.ts`
- **Where owners are edited (project settings UI)**
  - `src/progress/ProjectModal.tsx`

---

## Calendar / non-working dates / workweek days
- **Project calendar model (workWeekDays + calendar entries → nonWorkingDates)**
  - `src/progress/app/useProgressViewModel.ts`
- **Calendar UI (manage entries)**
  - `src/progress/CalendarModal.tsx`
- **Core calendar helpers**
  - `src/progress/ProgressCore.ts`

---

## Dependencies (WBS + dep links)
- **Compute dependencies (deps.links)**
  - `src/progress/app/useProgressViewModel.ts`
  - `src/progress/ProgressCore.ts` (dependency compute functions)

---

## Project open/save (Local + Cloud)
- **Snapshot build/apply, open/save behavior, file actions, cloud pro-only saving**
  - `src/progress/app/useProgressProjectIO.ts`
- **Local project library (IndexedDB)**
  - `src/progress/ProjectLibraryModal.tsx`
  - `src/storage/indexedDbProjectStore.ts`
- **Cloud project library (Pro/Trial)**
  - `src/progress/CloudProjectLibraryModal.tsx`
  - `src/cloud/cloudProjects.ts`
- **Project keys / persistence**
  - `src/storage/progressLocalKeys.ts`
  - `src/storage/localSettings.ts`

---

## Toolbar actions (what buttons do)
- **Action routing (table/gantt/calendar/project)**
  - `src/progress/app/useProgressActions.ts`
- **Toolbar UI (buttons/menus)**
  - `src/progress/ProgressToolbar.tsx`
- **App wiring (passes handlers into toolbar)**
  - `src/App.tsx`

---

## Printing
- **Print overlay UI**
  - `src/print2/PrintPreviewOverlay.tsx`
- **Print column patching (ensures start/end for gantt bars)**
  - `src/progress/app/useProgressViewModel.ts`
- **Print open/close and props wiring**
  - `src/App.tsx`

---

## Auth / plan / org
- **Auth hook**
  - `src/auth/useAuthUser.ts`
- **Org/plan context**
  - `src/orgs/useOrgContext.ts`
  - `src/orgs/optimisticPlan.ts`
- **Header account UI (plan pill, login/register/logout)**
  - `src/components/Header.tsx` (og evt. underkomponenter)

---

## Local settings / persistence utilities
- **Typed localStorage helpers**
  - `src/storage/localSettings.ts`
- **Keys**
  - `src/storage/progressLocalKeys.ts`

---

## Styling (most common)
- **AppShell + overall layout**
  - `src/styles/appshell.css`
- **Header**
  - `src/styles/header.css`
- **Table**
  - `src/styles/tablecore.css`
- **Gantt**
  - `src/styles/gantt.css`
- **Toolbar**
  - `src/styles/progress-toolbar.css`
- **Theme tokens**
  - `src/styles/mcl-theme.css`
- **Watermark**
  - `src/styles/watermark.css`
