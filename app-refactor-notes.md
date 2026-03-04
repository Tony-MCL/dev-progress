Progress – App.tsx Refactor Notes (Updated)
Background

App.tsx i Progress-app’en hadde vokst seg stor og vanskelig å vedlikeholde (tidligere >2000 linjer) med blandede ansvar:

UI rendering (layout, modaler, popovers)

Gantt kontroll (zoom, visningsinnstillinger)

prosjekt save/load (lokalt og cloud)

date picker state

row editing (onCellCommit, warnings, auto schedule)

localStorage / persist

actions/kommandoer fra toolbar

Dette gjorde det vanskelig å:

navigere trygt i fila

endre features uten side-effekter

bruke AI-verktøy pga. kontekstgrenser

holde ryddig skille mellom features

Målet er praktisk vedlikeholdbarhet, ikke arkitektonisk “perfeksjon”.

Mål / constraints:

Filer helst rundt 400–900 linjer

Samle relatert funksjonalitet i få, tydelige moduler

Unngå at hver liten ting krever 10 filer

Bevare eksisterende oppførsel

AppShell-reglene gjelder fortsatt (AppShell read-only)

Resultat etter refaktor

App.tsx er nå primært:

“Orchestrator” som kobler sammen state + hooks

Renderer layout (JSX) og sender props videre

Har kun den “tynne” koblingen mellom TableCore ↔ Gantt ↔ modaler

Tunge blokker som ofte endres er flyttet ut i egne hooks.

Hva som ble gjort (opprinnelig + denne chatten)
1) Import-blokk ryddet og gruppert (tidligere refaktor)

Hvor: src/App.tsx
Hva: Imports ble gruppert logisk (React, core, progress, storage/cloud, commands, domain, UI, utils, styles), duplikater fjernet og oversikt forbedret.

2) Cloud / Project IO flyttet ut (tidligere refaktor)

Ny modul: src/progress/app/useProgressProjectIO.ts

Flyttet ut av App.tsx:

bygge snapshot (prosjektdata)

apply snapshot

lagring/åpning (lokalt og cloud / Pro-only)

file actions (import/export)

Gantt zoom helper-funksjoner (zoom delta, reset)

“request focus” til Gantt

App.tsx bruker nå:

const {
  applySnapshot,
  requestGanttFocus,
  handleGanttZoomDelta,
  resetGanttZoom,
  handleFileAction,
} = useProgressProjectIO(...);
3) Date Picker UI state flyttet ut (tidligere refaktor)

Ny modul: src/progress/app/useDatePickerPopover.ts

Flyttet ut av App.tsx:

datePickReq + ref

open/close av date picker UI

onRequestDatePicker

App.tsx bruker nå:

const { datePickReq, closeDatePickerUI, onRequestDatePicker } =
  useDatePickerPopover();
Nye endringer i denne chatten
4) Split-pane (mellom tabell og Gantt) flyttet ut

Ny modul: src/progress/app/useSplitPane.ts

Flyttet ut av App.tsx:

splitLeft state + persist (localStorage)

ref til split-grid

pointer drag handler

keyboard handler (ArrowLeft/Right, Home/End)

prosentberegning fra mus-posisjon → --split-left

App.tsx bruker nå:

const {
  splitGridRef,
  splitLeft,
  setSplitLeft,
  onDividerPointerDown,
  onDividerKeyDown,
} = useSplitPane();

Note: vi måtte justere typing på ref for å få grønn build igjen.

5) ViewModel (derived data) flyttet ut

Modul: src/progress/app/useProgressViewModel.ts (allerede opprettet i refaktoren)

Flyttet ut av App.tsx:

ownerOptions / ownerColorMap

progressCalendar (workWeekDays + non-working dates fra calendar entries)

deps (dependency compute)

visibleColumnsPatched (owner som select + options)

printColumnsPatched (sørger for start/end også når skjult)

headerInfo (tekstlinja over tabell/gantt)

App.tsx bruker nå:

const {
  ownerColorMap,
  progressCalendar,
  deps,
  visibleColumnsPatched,
  printColumnsPatched,
  headerInfo,
} = useProgressViewModel({ ... });
6) Row editing (onRowsChange + onCellCommit + popovers) flyttet ut

Modul: src/progress/app/useProgressRowEditing.ts

Flyttet ut av App.tsx:

onRowsChange (recomputeAllRows + freeze)

onCellCommit (helgevarsel + duration popover)

state + refs for DurPopover og WeekendPopover

apply/cancel logic for weekend justering

apply/close logic for duration justering

“lastPointer” tracking (for popover-posisjon)

App.tsx bruker nå:

const {
  durPop,
  weekendPop,
  onRowsChange,
  onCellCommit,
  applyWeekendChoice,
  cancelWeekendAdjust,
  applyDurationChoice,
  closeDurationPopover,
} = useProgressRowEditing({ ... });

Dette er en av de viktigste vedlikeholdsvinnene, fordi dette er typisk logikk vi endrer ofte.

7) Actions/kommando-routing flyttet ut

Modul: src/progress/app/useProgressActions.ts

Flyttet ut av App.tsx:

handleGanttAction

handleCalendarAction

handleProjectAction

handleTableAction

App.tsx gir hooken “primitive handlers” og state-settere (som setProjectOpen, setColMgrOpen, onRowsChange, handleGanttZoomDelta, osv.) og hooken gjør switch/case mapping.

App.tsx bruker nå:

const {
  handleGanttAction,
  handleCalendarAction,
  handleProjectAction,
  handleTableAction,
} = useProgressActions({ ... });
8) Gantt UI settings (zoom + toggles + farge) flyttet ut

Ny modul: src/progress/app/useGanttUiSettings.ts

Flyttet ut av App.tsx:

ganttZoomLevels + ganttZoomIdx

ganttPxPerDay (derived fra zoom)

ganttWeekendShade

ganttTodayLine

ganttShowBarText

ganttDefaultBarColor

localStorage persist for alt over

App.tsx bruker nå:

const {
  ganttZoomLevels,
  ganttZoomIdx,
  setGanttZoomIdx,
  ganttPxPerDay,
  ganttWeekendShade,
  setGanttWeekendShade,
  ganttTodayLine,
  setGanttTodayLine,
  ganttShowBarText,
  setGanttShowBarText,
  ganttDefaultBarColor,
  setGanttDefaultBarColor,
} = useGanttUiSettings();

Dette er perfekt å ha isolert, fordi Gantt UI er et område vi kommer til å tweake.

Nåværende “hvor bor hva” (kart)
App.tsx eier nå:

“top-level state” som trenger å være i App (rows, selection, modals)

hook-wiring (kobler hooks sammen)

JSX layout (rendering av TableCore/GanttView/modaler)

noen få små wrapper callbacks (f.eks. openFreeProject, startNewBlankProject)

Hooks/Moduler eier:
Ansvar	Fil
Project IO + snapshots + file actions + zoom helpers	src/progress/app/useProgressProjectIO.ts
Date picker popover state	src/progress/app/useDatePickerPopover.ts
Split-pane (drag + keyboard + persist)	src/progress/app/useSplitPane.ts
ViewModel / derived data (calendar, deps, owner, patched columns, headerInfo)	src/progress/app/useProgressViewModel.ts
Row editing (commit, warnings, popovers, recompute flow)	src/progress/app/useProgressRowEditing.ts
Action routing (switch/case for toolbar actions)	src/progress/app/useProgressActions.ts
Gantt UI settings + persist	src/progress/app/useGanttUiSettings.ts
Prinsipper vi fulgte (viktig)

AppShell er “read-only”: ingen Progress-spesifikk logikk inn i AppShell

TableCore holdes “hellig”: ingen domene-logikk der

Domene/semantikk ligger i app-laget (progress/*)

Løsningen skal være kjedelig, tydelig og robust

Små, verifiserbare steg: alltid grønn build mellom steg

Hvorfor dette er lettere å jobbe med nå

App.tsx kan leses som en “oppskrift”:

init state → derived viewmodel → handlers → render

Om du skal endre “owner”-flyt: gå til useProgressViewModel

Om du skal endre helgevarsel/duration: gå til useProgressRowEditing

Om du skal endre split-behaviour: gå til useSplitPane

Om du skal endre zoom/toggles/farge: gå til useGanttUiSettings

Om du skal endre hva en knapp gjør: gå til useProgressActions

Neste mulige steg (men vi stoppet her nå)

Dette er “nice to have”, ikke nødvendig nå:

samle table column reorder/width persist i egen hook (hvis du vil)

vurdere å dele JSX i “AppLayout.tsx” kun hvis App.tsx blir for stor igjen

Oppsummering

Vi startet med en App.tsx som var vanskelig å navigere og vedlikeholde.

Vi har nå en struktur der de mest endringsutsatte delene er flyttet ut i egne, tydelig navngitte hooks:

Project IO

Date picker state

Split-pane

ViewModel / derived data

Row editing

Actions

Gantt UI settings

App.tsx er igjen et sted du kan finne frem i uten å bli svimmel, og endringer skjer i riktig “bolk” uten at alt blir blandet sammen.
