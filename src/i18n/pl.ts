// src/i18n/en.ts
const pl = {
  header: {
    help: "Pomoc",
    account: "Konto",
    accountLoading: "Konto…",
    upsell: "Kliknij Konto, aby rozpocząć okres próbny lub uaktualnić",
    plan: "Plan",
    expires: "Wygasa",
    statusError: "Błąd statusu",
    planStatusTitle:
      "Status planu pochodzi z Workera (Firestore jest źródłem prawdy). Aplikacja nie podejmuje decyzji dotyczących płatności.",
    logoTitle: "Otwórz ManageSystem.no (Progress)",
  },

  // ============================
  // ADD: PaywallModal
  // ============================
  paywall: {
    close: "Close",

    tabs: {
      trial: "Trial",
      buy: "Buy license",
    },

    labels: {
      email: "Email address",
      password: "Password",
    },

    placeholders: {
      email: "name@company.com",
      password: "At least 6 characters",
      orgName: "Company Ltd",
      orgNr: "9 digits",
      contactName: "Jane Doe",
      phone: "+47 ...",
      fullName: "Jane Doe",
      country: "Norway",
    },

    buyerType: {
      company: "Company",
      private: "Private",
    },

    fields: {
      orgName: "Company name",
      orgNr: "Org number",
      contactName: "Contact person",
      phone: "Phone",
      fullName: "Full name",
      country: "Country",
    },

    trial: {
      title: "Try Full version free for 10 days",
      body: "Enter email and password to start the trial.",
      action: "Start trial",
      started: "Trial started. You can now use full-version features for 10 days.",
    },

    buy: {
      title: "Buy Full version license",
      body: "Fill in the details once, choose license type, and proceed to checkout.",

      licenseType: "License type",
      subscription: "Subscription",
      oneTime: "One-time",

      payCadence: "With billing:",
      month: "Monthly",
      year: "Yearly",

      duration: "Duration",
      oneMonth: "1 month",
      oneYear: "1 year",

      summary: {
        price: "Price",
        vat: "VAT",
        total: "Price incl. VAT",
        perMonth: "NOK/mo",
        perYear: "NOK/yr",
        currency: "Currency",
      },

      action: "Go to checkout",
    },

    validation: {
      invalidEmail: "Enter a valid email address.",
      invalidPassword: "Password must be at least 6 characters.",
      missingFields: "Fill in all required fields.",
      invalidOrgNr: "Org number looks wrong (9 digits).",
    },

    errors: {
      network: "Something went wrong. Check that the Worker endpoints are correct.",
      wrongEndpoint:
        "It looks like the checkout call is hitting the wrong address (not the Worker). Check VITE_PROGRESS_WORKER_BASE_URL.",
      noCheckoutUrl: "Worker returned no checkout url (expected { url }).",
    },
  },
  // ============================
  // END ADD
  // ============================

  help: {
    title: "Help",
    closeAria: "Close help",

    intro:
      "This panel is designed for day-to-day use: when you need the plan to be correct right now. Open a question and use it as a quick reference.",

    faqText: `Q: How do the table and Gantt relate?
A: The table is the source of truth where you enter activities, dates and data. Gantt renders the exact same rows as timeline bars.
- Scrolling is synchronized: rows should line up perfectly.
- If something looks “missing”, check if sub-rows are collapsed.

Q: How do I edit a cell without messing up everything else?
A: Click a cell and start typing. Enter commits the edit.
- Esc cancels editing (and closes panels).
- Use arrow keys/tab to navigate like a spreadsheet.

Q: How do I add rows quickly?
A: Use Table → Rows.
- “Add row at end” creates a new row at the bottom.
- “Add row below selection” inserts directly under the current row.
- “Delete selected rows” removes what you selected.

Q: Hierarchy / sub-tasks: how does it work?
A: Rows can be indented/outdented to create structure (a parent task with sub-tasks).
- Alt + ArrowRight = indent (make it a sub-task).
- Alt + ArrowLeft = outdent.
- Use the toggle to collapse/expand sub-rows.

Q: What do Activity / Start / End / Duration mean?
A: Activity is the task name. Start/End are dates. Duration is how long the task lasts.
- You can control the plan by entering Start+End, or using Duration where enabled.
- The calendar (holidays/vacation) can affect workday-based calculations.

Q: What’s the easiest way to pick dates?
A: Double-click a date cell to open the date picker.
- You can also type common formats like 2026-01-17 (and many others).

Q: What is “Calendar — holidays and vacation” and why should I use it?
A: The calendar lets you register non-working days (vacation, shutdowns, public holidays).
- This affects workday-based duration/lag calculations (where used).
- Quick add can insert public holidays for a selected year.
- You can edit and delete entries later.

Q: Columns: show/hide/move/resize — how?
A: Table → Columns lets you choose visible columns and add custom ones.
- Drag the header to reorder columns.
- Drag the edge to resize.
- You can add custom columns (Text, Number, Date).

Q: What is Project info and what should I fill in?
A: Project info stores metadata: project name, customer, project number, start date, notes and owners.
- Useful for professional sharing and later reporting/printing.
- The right side shows the last saved preview.

Q: How is my plan saved? (Save/Open/My saved projects)
A: In this version, projects are stored locally in the browser database (IndexedDB).
- File → Save stores the current plan.
- File → Open loads locally saved projects.
- “My saved projects” shows a list where you can open/duplicate/delete.

Q: What does “free mode: one project at a time” mean?
A: In free mode, the app may ask for confirmation before overwriting the current plan when starting a new one.
- If you want to keep something, save or duplicate first.

Q: Import/Export — how do I share with Excel?
A: Use TSV (tab-separated). It works very well with Excel.
- File → Export → (TSV/CSV depending on your menu).
- File → Import → TSV lets you bring data back in.

Q: Dependencies — what are they in practice?
A: Dependencies say “this task can’t start/finish before another task”.
- The most common is Finish-to-Start (FS): A must finish before B can start.
- Lag (+/- days) lets you add wait time or overlap.

Q: How do I write a dependency correctly?
A: Enter it in the Dependency column.
- Example: 6FS+2 means “after row 6 (FS) + 2 days lag”.
- Multiple dependencies can be separated by comma/semicolon (if supported in your build).

Q: Why do dates move when I add dependencies?
A: When dependencies are active, the app tries to enforce rules and may adjust dates to keep the plan consistent.
- If you want to lock a task, enter both Start and End explicitly.
- Make sure the predecessor has valid dates.

Q: Gantt: what are Zoom / weekend shading / today line for?
A: Gantt is the overview — zoom controls the level of detail.
- Zoom in/out/reset changes scale so bars/text are readable.
- Weekend shading makes weekends visually obvious.
- Today line shows where “today” is on the timeline.

Q: Print… (if it doesn’t work)
A: The Print menu item may be visible even if the print module is disabled in this version.
- If nothing happens, use export (TSV/CSV) as sharing/backup for now.

Q: Most useful shortcuts
A: These are the most helpful day-to-day shortcuts.
- Ctrl+S: save
- Ctrl+O: open
- Ctrl+N: new plan
- Esc: close panels / cancel
- Alt + ArrowLeft/ArrowRight: outdent/indent (hierarchy)
`,

    outro:
      "If something looks off: 1) check collapsed rows, 2) check dependencies, 3) check calendar/holidays. Test big changes in a copy before committing.",

    text1: "",
    text2: "",
    text3: "",
  },

  lang: {
    aria: "Language selection",
  },

  theme: {
    switchToDark: "Switch to dark mode",
    switchToLight: "Switch to light mode",
  },

  toolbar: {
    top: {
      file: "File",
      table: "Table",
      gantt: "Gantt",
      calendar: "Calendar",
      project: "Project",
    },

    file: {
      new: "New",
      newPlan: "New plan",
      fromTemplate: "From template…",
      open: "Open",
      openEllipsis: "Open…",
      openRecent: "Open recent",

      openProject: "Open project",
      openFromCloud: "Open from cloud",
      openFile: "Open from file",

      save: "Save",
      saveAs: "Save as…",

      saveProject: "Save project",
      saveToCloud: "Save to cloud",
      saveToFile: "Save to file",

      print: "Print…",
      export: "Export",
      import: "Import",
    },

    table: {
      columns: "Columns",
      chooseVisibleColumns: "Choose visible columns…",
      rows: "Rows",
      addRowEnd: "Add row at end",
      addRowBelow: "Add row below selection",
      deleteSelectedRows: "Delete selected rows",
    },

    gantt: {
      zoom: "Zoom",
      zoomIn: "Zoom in",
      zoomOut: "Zoom out",
      zoomReset: "Reset (100%)",
      view: "View",
      toggleWeekend: "Toggle weekend shading",
      toggleTodayLine: "Toggle today line",
    
      colorPicker: {
        label: "Color",
        title: "Choose color for Gantt bars",
      },
    },

    calendar: {
      manage: "Holidays and vacation…",
    },

    project: {
      manage: "Project info…",
    },

    confirmOverwrite: {
      title: "Replace current project?",
      textFree:
        "In free mode, you can work on one project at a time. Do you want to overwrite your saved project?",
      textPro:
        "This action will replace the content of the project currently open in this tab. Do you want to continue?",
      cancel: "Cancel",
      confirm: "Overwrite",
    },

    multiTab: {
      title: "Number of open Progress tabs",
      openTabs: "Open tabs",
    },

    a11y: {
      submenuAriaPrefix: "Submenu: ",
    },
  },

  contextMenu: {
    title: "Table menu",
    ariaLabel: "Table menu",
    row: "Row",
    noRow: "No row",
    column: "Column",
    noColumn: "No column",
    selection: "Selection",
    noSelection: "No selection",
    columnShort: "C",
    makeMilestone: "Make milestone",
    removeMilestone: "Remove milestone",
    indentRows: "Indent row / make subtask",
    outdentRows: "Outdent row / make main activity",
    cut: "Cut",
    copy: "Copy",
    paste: "Paste",
    insertRowAbove: "Insert row above",
    insertRowBelow: "Insert row below",
    deleteRows: "Delete row(s)",
    print: "Print",
    close: "Close",
  },

  calendarModal: {
    title: "Calendar – holidays and vacation",
    intro:
      "Add dates that are not working days (public holidays, vacation, shutdowns, etc.). This affects duration and date calculations.",

    left: {
      title: "Add holidays / vacation",
    },

    fields: {
      from: "From",
      to: "To",
      nameOptional: "Name (optional)",
      namePlaceholder: "E.g. Easter, Summer vacation, Shutdown",
      name: "Name",
      nameEditPlaceholder: "Optional name",
    },

    quick: {
      title: "Quick add – public holidays",
      year: "Year",
      addAll: "Add all",
      addPicked: "Add selected",
      resetPick: "Reset selection",
    },

    right: {
      title: "Registered dates / periods",
      countSuffix: "items",
      empty: "No holidays registered yet.",
    },

    actions: {
      addPeriod: "Add period",
      edit: "Edit",
      delete: "Delete",
      save: "Save",
      cancel: "Cancel",
      close: "Close",
    },

    tip:
      "Tip: Choose a year and add public holidays. Each holiday is added as a single date entry.",
  },

  holidays: {
    newYearsDay: "New Year's Day",
    labourDay: "Labour Day",
    constitutionDay: "Constitution Day",
    christmasDay1: "Christmas Day",
    christmasDay2: "Boxing Day",
    maundyThursday: "Maundy Thursday",
    goodFriday: "Good Friday",
    easterSunday: "Easter Sunday",
    easterMonday: "Easter Monday",
    ascensionDay: "Ascension Day",
    whitSunday: "Whit Sunday",
    whitMonday: "Whit Monday",
  },

  columnManagerModal: {
    title: "Columns",
    intro: "Choose which columns are visible, or add your own columns.",

    list: {
      custom: "Custom",
    },

    add: {
      title: "New custom column",
      namePlaceholder: "Column name…",
      types: {
        text: "Text",
        number: "Number",
        date: "Date",
      },
    },

    actions: {
      add: "Add",
      close: "Close",
    },
  },

  projectModal: {
    title: "Project – information",
    intro:
      "The right side shows the last saved state. Project info and owners are saved separately.",

    left: {
      projectDraftTitle: "Project data (draft)",
      ownersDraftTitle: "Owners (draft)",
    },

    fields: {
      projectName: "Project name",
      customer: "Customer",
      projectNo: "Project no.",
      start: "Project start",
      notesOptional: "Notes (optional)",
      onePerLine: "One name per line",
      name: "Name",
      ganttColorOptional: "Gantt color (optional)",
    },

    placeholders: {
      projectName: "E.g. Power plant rehabilitation",
      customer: "E.g. Example Ltd.",
      projectNo: "E.g. 24-1033",
      notes: "E.g. assumptions, scope, milestone notes...",
      ownersList: "John\nOscar\nNina\nHeidi",
    },

    actions: {
      reset: "Reset",
      saveProject: "Save project info",
      saveOwners: "Save owners",
      edit: "Edit",
      delete: "Delete",
      save: "Save",
      cancel: "Cancel",
      close: "Close",
      default: "Default",
      useDefault: "Use default",
    },

    tips: {
      ownerColor:
        "Tip: Set color via Edit on the right. Empty color = default Gantt color.",
    },

    right: {
      previewTitle: "Preview (last saved)",
      ownersTitle: "Owners (last saved)",
      ownersEmpty: "No owners added yet.",
    },

    preview: {
      labels: {
        customer: "Customer:",
        projectNo: "Project no.:",
        start: "Start:",
      },
      defaults: {
        projectName: "Project name",
        notes: "Notes…",
        dash: "—",
      },
    },

    owner: {
      colorCustom: "Custom color",
      colorDefault: "Default color",
    },

    milestoneAnchor: {
      title: "Choose milestone date",
      text: "Should the milestone be placed on the start date or end date?",
      start: "Start date",
      end: "End date",
      cancel: "Cancel",
    },

    footer: {
      next:
        "Next: connect the “Owner” column in the table to this list + mirror colors in Gantt.",
    },
  },

  gantt: {
    milestone: "milestone",
    weekPrefix: "week",
    monthShort: {
      jan: "Jan",
      feb: "Feb",
      mar: "Mar",
      apr: "Apr",
      may: "May",
      jun: "Jun",
      jul: "Jul",
      aug: "Aug",
      sep: "Sep",
      oct: "Oct",
      nov: "Nov",
      dec: "Dec",
    },
    weekdayShort: {
        mon: "Mon.",
        tue: "Tue.",
        wed: "Wed.",
        thu: "Thu.",
        fri: "Fri.",
        sat: "Sat.",
        sun: "Sun.",
      },
  },

  tableCore: {
    summaryTitle: "Summary",
    headerInfoDemo:
      "Demo Project • Jan 2026 • Local draft (later: DB) • Split-view ready",
    dragToMoveColumn: "Drag to move column",
    dragToResizeColumn: "Drag to resize",
    dragToMoveRow: "Drag to move row",
    chooseDate: "Choose date",
    chooseDateFor: "Choose date for",
    datePickerFor: "Date picker for",
    showSubRows: "Show sub-rows",
    hideSubRows: "Hide sub-rows",
  },

  app: {
    columns: {
      activity: "Activity",
      start: "Start",
      end: "End",
      duration: "Duration",
      dependency: "Dependency",
      wbs: "WBS",
      owner: "Owner",
      status: "Status",
      percentComplete: "% complete",
      percentRemaining: "% remaining",
      comment: "Comment",
    },

    progressStatus: {
      notStarted: "Not started",
      inProgress: "In progress",
      delayed: "Delayed",
      completed: "Completed",
      cancelled: "Cancelled",
    },

    demo: {
      phase1Title: "PHASE 1 – PLANNING",
      defineScope: "Define scope",
      stakeholderAlignment: "Stakeholder alignment",
      riskAssessment: "Risk assessment",
      planSignOff: "Plan sign-off",
    },

    header: {
      project: "Project",
      customer: "Customer",
      projectStart: "Project start",
      fallback:
        "Project: Progress Demo • Customer: Example AS • Plan: v0 • Jan 2026",
    },

    split: {
      dragToResize: "Drag to resize",
    },

    aria: {
      tableHorizontalScroll: "Table horizontal scroll",
      ganttHorizontalScroll: "Gantt horizontal scroll",
    },

    datePicker: {
      ariaLabel: "Date picker",
      prevMonthAria: "Previous month",
      nextMonthAria: "Next month",
    
      weekdayShort: {
        mon: "Mon",
        tue: "Tue",
        wed: "Wed",
        thu: "Thu",
        fri: "Fri",
        sat: "Sat",
        sun: "Sun",
      },
    
      monthFull: {
        jan: "January",
        feb: "February",
        mar: "March",
        apr: "April",
        may: "May",
        jun: "June",
        jul: "July",
        aug: "August",
        sep: "September",
        oct: "October",
        nov: "November",
        dec: "December",
      },
    
      clear: "Clear",
      clearTitle: "Clear date",
      ok: "OK",
      okTitle: "Commit",
      today: "Today",
      todayTitle: "Select today",
    },

    durationPopover: {
      title: "Adjust duration",
      moveStart: "Move start",
      moveEnd: "Move end",
      keepEndMoveStartTitle: "Keep end, move start",
      keepStartMoveEndTitle: "Keep start, move end",
    },

    weekendPopover: {
      title: "The date you chose falls on a weekend. Move it to a workday?",
      prevWorkday: "Use previous workday",
      nextWorkday: "Use next workday",
      cancel: "Cancel",
    },

    footer: {
      copyright: "© 2025 Morning Coffee Labs",
      terms: "Terms",
      privacy: "Privacy",
    },
  },

  printPreview: {
    topTitle: "Print / PDF",
    paperLabel: "Paper",
    includeDeps: "Dependencies",
    printBtn: "Print / Save as PDF",
    closeBtn: "Close",
  
    layoutModeLabel: "Print type",
    modeFull: "Complete",
    modeTable: "Table only",
    modeGantt: "Gantt only",
  
    customerLabel: "Customer:",
    projectPeriodLabel: "Project period:",
    notSet: "(not set)",
    projectNameNotSet: "Project name (not set)",
  },

  projectLibrary: {
    title: "My saved projects",
    intro: "Projects are stored locally in the browser database (IndexedDB).",
    current: "Current",
    refresh: "Refresh",
    close: "Close",
    loading: "Loading…",
    empty: "No saved projects yet. Use File → Save to create one.",
    colTitle: "Project",
    colUpdated: "Updated",
    colActions: "Actions",
    open: "Open",
    duplicate: "Duplicate",
    delete: "Delete",
    deleteTip: "Deletes this project from local database",
    activeTip: "Currently loaded project",
    notFound: "Project not found.",
    openConflictTitle: "This tab already contains a project",
    openConflictText: "Do you want to overwrite the current project in this tab, open the project in a new tab, or cancel?",
    cancel: "Cancel",
    openInNewTab: "Open in new tab",
    overwriteCurrent: "Overwrite current",
  },
};

export default pl;
