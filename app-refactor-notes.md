Progress – App.tsx Refactor Notes
Background

App.tsx in the Progress application had grown very large and difficult to maintain.
The file contained well over 2000 lines of mixed responsibilities:

UI rendering

Gantt control logic

project save/load logic

date picker state

popovers

table editing logic

cloud interaction

local storage

zoom handling

modal control

This made it difficult to:

navigate the file

modify features safely

work with AI tools like ChatGPT (context limits)

maintain clear separation between features

The goal of this refactor is not architectural purity, but practical maintainability.

Target constraints:

No single file should exceed roughly 700–800 lines

Related functionality should stay together

Avoid spreading one feature across many files

Preserve existing behaviour

The AppShell architecture rules remain unchanged.

What Was Done In This Refactor
1. Import Block Cleanup

The original App.tsx had accumulated a large number of imports, some of which were duplicated or no longer used.

Actions taken:

Imports were grouped into logical blocks.

Duplicate imports were removed.

Unused imports were cleaned up where safe.

The structure now follows this pattern:

React / hooks
core components
progress components
storage / cloud
table commands
progress domain logic
UI popovers
utilities
styles

This makes the dependency structure of the file easier to read.

2. Cloud / Project IO Logic Extraction

Project save/load functionality was extracted into a separate hook.

New module:

src/progress/app/useProgressProjectIO.ts

This hook now owns functionality related to:

project snapshot creation

applying snapshots

cloud saving

file menu actions

gantt zoom helpers

project open / save behaviour

The hook returns:

buildSnapshot
applySnapshot
saveToCloudProOnly
requestGanttFocus
handleGanttZoomDelta
handleFileAction

App.tsx now consumes these through:

const {
  buildSnapshot,
  applySnapshot,
  saveToCloudProOnly,
  requestGanttFocus,
  handleGanttZoomDelta,
  handleFileAction,
} = useProgressProjectIO(...);

This removed a large amount of project storage logic from App.tsx.

3. Date Picker UI State Extraction

Date picker UI state previously lived inside App.tsx.

This was extracted to:

src/progress/app/useDatePickerPopover.ts

This hook manages:

datePickReq
datePickReqRef
closeDatePickerUI
onRequestDatePicker

App.tsx now simply uses:

const {
  datePickReq,
  closeDatePickerUI,
  onRequestDatePicker
} = useDatePickerPopover();

This keeps the App responsible for rendering the popover UI, but removes the internal state management.

4. Gantt Action Handling Simplified

handleGanttAction remains in App.tsx but now delegates zoom behaviour to the IO hook:

handleGanttZoomDelta(...)

This keeps the UI action handler simple while centralizing zoom logic.

Current Structure of App.tsx

After the changes made so far, App.tsx is primarily responsible for:

Application State

rows

columns

selection

gantt zoom state

project metadata

calendar entries

modal visibility

UI Rendering

TableCore

GanttView

toolbars

modals

popovers

Event Wiring

table change handlers

gantt actions

modal triggers

Heavy domain logic has begun to move into hooks.

What Was Intentionally NOT Moved (Yet)

The following logic is still in App.tsx and may be refactored later:

Row editing logic
onCellCommit
weekend warnings
duration adjustments

These interact deeply with the table model and were left in place to avoid introducing regressions.

Row recomputation
recomputeAllRows

Still triggered directly from App.tsx.

Next Possible Refactor Steps

Future refactoring could further extract:

1. Row Editing Logic

Possible hook:

useProgressRowEditing.ts

Would contain:

onCellCommit

weekend adjustment logic

duration adjustment logic

This is a larger move and should be done carefully.

2. Render Layout Extraction

The JSX render structure could be extracted to:

AppLayout.tsx

This would isolate the visual layout from the application logic.

3. Gantt Behaviour

Zoom / scroll behaviour could eventually move into:

useGanttController.ts

But this is optional.

Important Design Principles For This Project

This refactor follows the existing project rules:

AppShell is read-only

No app-specific logic is added to:

Header
Toolbar
TableCore
App owns semantics

All domain logic stays inside the Progress app layer.

Keep solutions boring

The goal is not clever architecture, but:

maintainability

clarity

safe iteration

Summary

This refactor began the process of breaking down a large App.tsx into smaller logical units.

So far the following responsibilities have been separated:

Responsibility	Location
Project IO / Cloud	useProgressProjectIO
DatePicker UI State	useDatePickerPopover
Main application orchestration	App.tsx

Further extractions are possible but should be done gradually to avoid introducing instability.
