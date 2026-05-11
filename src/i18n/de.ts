const de = {
  header: {
    help: "Hilfe",
    account: "Konto",
    accountLoading: "Konto…",
    upsell: "Klicke auf Konto für eine Testphase oder ein Upgrade",
    plan: "Plan",
    expires: "Läuft ab",
    statusError: "Statusfehler",
    planStatusTitle:
      "Der Planstatus kommt vom Worker (Firestore ist die Datenquelle). Die App trifft keine Zahlungsentscheidungen.",
    logoTitle: "ManageSystem.no öffnen (Progress)",
  },

  paywall: {
    close: "Schließen",

    tabs: {
      trial: "Testphase",
      buy: "Lizenz kaufen",
    },

    labels: {
      email: "E-Mail-Adresse",
      password: "Passwort",
    },

    placeholders: {
      email: "name@firma.com",
      password: "Mindestens 6 Zeichen",
      orgName: "Firma GmbH",
      orgNr: "9 Ziffern",
      contactName: "Max Mustermann",
      phone: "+47 ...",
      fullName: "Max Mustermann",
      country: "Norwegen",
    },

    buyerType: {
      company: "Firma",
      private: "Privatperson",
    },

    fields: {
      orgName: "Firmenname",
      orgNr: "Organisationsnummer",
      contactName: "Kontaktperson",
      phone: "Telefon",
      fullName: "Name",
      country: "Land",
    },

    trial: {
      title: "Vollversion 10 Tage kostenlos testen",
      body: "Gib E-Mail und Passwort ein, um die Testphase zu starten.",
      action: "Testphase starten",
      started:
        "Die Testphase wurde gestartet. Du kannst die Funktionen der Vollversion nun 10 Tage nutzen.",
    },

    buy: {
      title: "Lizenz für die Vollversion kaufen",
      body: "Fülle die Angaben einmal aus, wähle den Lizenztyp und gehe zur Zahlung.",

      licenseType: "Lizenztyp",
      subscription: "Abonnement",
      oneTime: "Einmalig",

      payCadence: "Abrechnung:",
      month: "Monatlich",
      year: "Jährlich",

      duration: "Dauer",
      oneMonth: "1 Monat",
      oneYear: "1 Jahr",

      summary: {
        price: "Preis",
        vat: "MwSt.",
        total: "Preis inkl. MwSt.",
        perMonth: "NOK/Monat",
        perYear: "NOK/Jahr",
        currency: "Währung",
      },

      action: "Zur Zahlung",
    },

    validation: {
      invalidEmail: "Gib eine gültige E-Mail-Adresse ein.",
      invalidPassword: "Das Passwort muss mindestens 6 Zeichen haben.",
      missingFields: "Fülle alle Pflichtfelder aus.",
      invalidOrgNr: "Die Organisationsnummer sieht falsch aus (9 Ziffern).",
    },

    errors: {
      network:
        "Etwas ist schiefgelaufen. Prüfe, ob die Worker-Endpunkte korrekt sind.",
      wrongEndpoint:
        "Es sieht so aus, als ob der Checkout-Aufruf an die falsche Adresse geht (nicht an den Worker). Prüfe VITE_PROGRESS_WORKER_BASE_URL.",
      noCheckoutUrl:
        "Der Worker hat keine checkout-url zurückgegeben (erwartet: { url }).",
    },
  },

  help: {
    title: "Hilfe",
    closeAria: "Hilfe schließen",

    intro:
      "Dieses Panel ist für den täglichen Gebrauch gedacht: wenn der Plan jetzt korrekt sein muss. Öffne eine Frage und nutze sie als schnelle Nachschlagehilfe.",

    faqText: `Q: Wie hängen Tabelle und Gantt zusammen?
A: Die Tabelle ist die Quelle der Wahrheit. Dort trägst du Aktivitäten, Termine und Daten ein. Gantt zeigt dieselben Zeilen als Zeitbalken.
- Das Scrollen ist synchronisiert: Die Zeilen sollen sauber auf einer Linie liegen.
- Wenn etwas „fehlt“, prüfe, ob Unterzeilen eingeklappt sind.

Q: Wie bearbeite ich eine Zelle, ohne den Rest durcheinanderzubringen?
A: Klicke in eine Zelle und beginne zu schreiben. Enter speichert die Änderung.
- Esc bricht die Bearbeitung ab (und schließt Panels).
- Nutze Pfeiltasten/Tab, um dich wie in einer Tabellenkalkulation zu bewegen.

Q: Wie füge ich schnell Zeilen hinzu?
A: Nutze Tabelle → Zeilen.
- „Zeile am Ende hinzufügen“ erstellt unten eine neue Zeile.
- „Zeile unter Auswahl hinzufügen“ fügt direkt unter der aktuellen Zeile ein.
- „Ausgewählte Zeilen löschen“ entfernt die ausgewählten Zeilen.

Q: Hierarchie / Unteraufgaben: Wie funktioniert das?
A: Zeilen können eingerückt oder ausgerückt werden, um eine Struktur zu bilden (Hauptaufgabe mit Unteraufgaben).
- Alt + Pfeil rechts = einrücken (Unteraufgabe erstellen).
- Alt + Pfeil links = ausrücken.
- Nutze den Umschalter, um Unterzeilen ein- oder auszuklappen.

Q: Was bedeuten Aktivität / Start / Ende / Dauer?
A: Aktivität ist der Name der Aufgabe. Start/Ende sind Termine. Dauer beschreibt, wie lange die Aufgabe dauert.
- Du kannst den Plan über Start+Ende steuern oder Dauer verwenden, wo das aktiviert ist.
- Der Kalender (Feiertage/Urlaub) kann Berechnungen auf Basis von Arbeitstagen beeinflussen.

Q: Wie wähle ich Termine am einfachsten aus?
A: Doppelklicke eine Datumszelle, um den Datepicker zu öffnen.
- Du kannst auch übliche Formate wie 2026-01-17 eingeben (und viele weitere).

Q: Was ist „Kalender — Feiertage und Urlaub“ und warum sollte ich ihn nutzen?
A: Im Kalender kannst du arbeitsfreie Tage erfassen (Feiertage, Urlaub, Stillstände usw.).
- Das beeinflusst Dauer- und Datumsberechnungen auf Basis von Arbeitstagen.
- Die Schnellerfassung kann gesetzliche Feiertage für ein ausgewähltes Jahr einfügen.
- Einträge können später bearbeitet und gelöscht werden.

Q: Spalten: anzeigen/ausblenden/verschieben/Breite ändern — wie?
A: Tabelle → Spalten lässt dich sichtbare Spalten auswählen und eigene Spalten hinzufügen.
- Ziehe den Spaltenkopf, um die Reihenfolge zu ändern.
- Ziehe die Kante, um die Breite zu ändern.
- Du kannst eigene Spalten hinzufügen (Text, Zahl, Datum).

Q: Was sind Projektinformationen und was soll ich eintragen?
A: Projektinformationen speichern Metadaten: Projektname, Kunde, Projektnummer, Startdatum, Notizen und Verantwortliche.
- Das ist nützlich für professionelles Teilen und späteres Reporting/Drucken.
- Rechts siehst du die zuletzt gespeicherte Vorschau.

Q: Wie wird mein Plan gespeichert? (Speichern/Öffnen/Meine gespeicherten Projekte)
A: In dieser Version werden Projekte lokal in der Browserdatenbank gespeichert (IndexedDB).
- Datei → Speichern speichert den aktuellen Plan.
- Datei → Öffnen lädt lokal gespeicherte Projekte.
- „Meine gespeicherten Projekte“ zeigt eine Liste, in der du öffnen, duplizieren oder löschen kannst.

Q: Was bedeutet „kostenloser Modus: ein Projekt gleichzeitig“?
A: Im kostenlosen Modus kann die App um Bestätigung bitten, bevor der aktuelle Plan beim Erstellen eines neuen überschrieben wird.
- Wenn du etwas behalten möchtest, speichere oder dupliziere es zuerst.

Q: Import/Export — wie teile ich Daten mit Excel?
A: Nutze TSV (tabulatorgetrennt). Das funktioniert sehr gut mit Excel.
- Datei → Export → (TSV/CSV je nach Menü).
- Datei → Import → TSV lädt Daten wieder ein.

Q: Abhängigkeiten — was bedeuten sie praktisch?
A: Abhängigkeiten bedeuten: „Diese Aufgabe kann nicht starten/enden, bevor eine andere Aufgabe startet/endet“.
- Am häufigsten ist Finish-to-Start (FS): A muss fertig sein, bevor B starten kann.
- Lag (+/- Tage) erlaubt Wartezeit oder Überlappung.

Q: Wie schreibe ich eine Abhängigkeit richtig?
A: Trage sie in der Spalte Abhängigkeit ein.
- Beispiel: 6FS+2 bedeutet „nach Zeile 6 (FS) + 2 Tage Lag“.
- Mehrere Abhängigkeiten können mit Komma oder Semikolon getrennt werden (wenn deine Version das unterstützt).

Q: Warum verschieben sich Termine, wenn ich Abhängigkeiten eintrage?
A: Wenn Abhängigkeiten aktiv sind, versucht die App die Regeln einzuhalten und kann Termine verschieben, damit der Plan konsistent bleibt.
- Wenn du eine Aufgabe sperren möchtest, trage Start und Ende explizit ein.
- Prüfe, ob der Vorgänger gültige Termine hat.

Q: Gantt: Wofür sind Zoom / Wochenend-Schattierung / Heute-Linie?
A: Gantt ist die Übersicht — Zoom steuert den Detailgrad.
- Zoom rein/raus/reset ändert die Skalierung, damit Balken und Text lesbar sind.
- Wochenend-Schattierung macht Wochenenden sichtbar.
- Die Heute-Linie zeigt, wo „heute“ im Plan liegt.

Q: Drucken… (wenn es nicht funktioniert)
A: Der Menüpunkt Drucken kann sichtbar sein, auch wenn das Druckmodul in dieser Version deaktiviert ist.
- Wenn nichts passiert, nutze Export (TSV/CSV) vorübergehend zum Teilen/Backup.

Q: Die wichtigsten Tastenkürzel
A: Das sind die nützlichsten Kürzel im Alltag.
- Ctrl+S: speichern
- Ctrl+O: öffnen
- Ctrl+N: neuer Plan
- Esc: Panels schließen / abbrechen
- Alt + Pfeil links/rechts: ausrücken/einrücken (Hierarchie)
`,

    outro:
      "Wenn etwas merkwürdig aussieht: 1) prüfe eingeklappte Zeilen, 2) prüfe Abhängigkeiten, 3) prüfe Kalender/Feiertage. Größere Änderungen am besten zuerst in einer Kopie testen.",

    text1: "",
    text2: "",
    text3: "",
  },

  lang: {
    aria: "Sprachauswahl",
  },

  theme: {
    switchToDark: "Zum Dunkelmodus wechseln",
    switchToLight: "Zum Hellmodus wechseln",
  },

  toolbar: {
    top: {
      file: "Datei",
      table: "Tabelle",
      gantt: "Gantt",
      calendar: "Kalender",
      project: "Projekt",
    },

    file: {
      new: "Neu",
      newPlan: "Neuer Plan",
      fromTemplate: "Aus Vorlage…",
      open: "Öffnen",
      openEllipsis: "Öffnen…",
      openRecent: "Zuletzt geöffnet",

      openProject: "Projekt öffnen",
      openFromCloud: "Aus der Cloud öffnen",
      openFile: "Datei öffnen",

      save: "Speichern",
      saveAs: "Speichern unter…",

      saveProject: "Projekt speichern",
      saveToCloud: "In der Cloud speichern",
      saveToFile: "In Datei speichern",

      print: "Drucken…",
      export: "Exportieren",
      import: "Importieren",
    },

    table: {
      columns: "Spalten",
      chooseVisibleColumns: "Sichtbare Spalten wählen…",
      rows: "Zeilen",
      addRowEnd: "Zeile am Ende hinzufügen",
      addRowBelow: "Zeile unter Auswahl hinzufügen",
      deleteSelectedRows: "Ausgewählte Zeilen löschen",
    },

    gantt: {
      zoom: "Zoom",
      zoomIn: "Vergrößern",
      zoomOut: "Verkleinern",
      zoomReset: "Zurücksetzen (100%)",
      view: "Ansicht",
      toggleWeekend: "Wochenend-Schattierung umschalten",
      toggleTodayLine: "Heute-Linie umschalten",

      colorPicker: {
        label: "Farbe",
        title: "Farbe für Gantt-Balken wählen",
      },
    },

    calendar: {
      manage: "Feiertage und Urlaub…",
    },

    project: {
      manage: "Projektinformationen…",
    },

    confirmOverwrite: {
      title: "Aktuelles Projekt ersetzen?",
      textFree:
        "Im kostenlosen Modus kannst du jeweils an einem Projekt arbeiten. Möchtest du dein gespeichertes Projekt überschreiben?",
      textPro:
        "Diese Aktion ersetzt den Inhalt des aktuell in diesem Tab geöffneten Projekts. Möchtest du fortfahren?",
      cancel: "Abbrechen",
      confirm: "Überschreiben",
    },

    multiTab: {
      title: "Anzahl offener Progress-Tabs",
      openTabs: "Offene Tabs",
    },

    a11y: {
      submenuAriaPrefix: "Untermenü: ",
    },
  },

  contextMenu: {
    title: "Tabellenmenü",
    ariaLabel: "Tabellenmenü",
    row: "Zeile",
    noRow: "Keine Zeile",
    column: "Spalte",
    noColumn: "Keine Spalte",
    selection: "Auswahl",
    noSelection: "Keine Auswahl",
    columnShort: "S",
    makeMilestone: "Als Meilenstein setzen",
    removeMilestone: "Meilenstein entfernen",
    indentRows: "Zeile einrücken / Unteraufgabe erstellen",
    outdentRows: "Zeile ausrücken / Hauptaufgabe erstellen",
    cut: "Ausschneiden",
    copy: "Kopieren",
    paste: "Einfügen",
    insertRowAbove: "Zeile oberhalb einfügen",
    insertRowBelow: "Zeile unterhalb einfügen",
    deleteRows: "Zeile(n) löschen",
    print: "Drucken",
    close: "Schließen",
  },

  calendarModal: {
    title: "Kalender – Feiertage und Urlaub",
    intro:
      "Füge Termine hinzu, die keine Arbeitstage sind (Feiertage, Urlaub, Stillstände usw.). Das beeinflusst Dauer- und Datumsberechnungen.",

    left: {
      title: "Feiertage / Urlaub hinzufügen",
    },

    fields: {
      from: "Von",
      to: "Bis",
      nameOptional: "Name (optional)",
      namePlaceholder: "Z. B. Ostern, Sommerurlaub, Stillstand",
      name: "Name",
      nameEditPlaceholder: "Optionaler Name",
    },

    quick: {
      title: "Schnellerfassung – gesetzliche Feiertage",
      year: "Jahr",
      addAll: "Alle hinzufügen",
      addPicked: "Ausgewählte hinzufügen",
      resetPick: "Auswahl zurücksetzen",
    },

    right: {
      title: "Registrierte Termine / Zeiträume",
      countSuffix: "Einträge",
      empty: "Noch keine Feiertage registriert.",
    },

    actions: {
      addPeriod: "Zeitraum hinzufügen",
      edit: "Bearbeiten",
      delete: "Löschen",
      save: "Speichern",
      cancel: "Abbrechen",
      close: "Schließen",
    },

    tip:
      "Tipp: Wähle ein Jahr und füge gesetzliche Feiertage hinzu. Jeder Feiertag wird als einzelner Datumseintrag angelegt.",
  },

  holidays: {
    newYearsDay: "Neujahr",
    labourDay: "Tag der Arbeit",
    constitutionDay: "Verfassungstag",
    christmasDay1: "1. Weihnachtstag",
    christmasDay2: "2. Weihnachtstag",
    maundyThursday: "Gründonnerstag",
    goodFriday: "Karfreitag",
    easterSunday: "Ostersonntag",
    easterMonday: "Ostermontag",
    ascensionDay: "Christi Himmelfahrt",
    whitSunday: "Pfingstsonntag",
    whitMonday: "Pfingstmontag",
  },

  columnManagerModal: {
    title: "Spalten",
    intro: "Wähle sichtbare Spalten aus oder füge eigene Spalten hinzu.",

    list: {
      custom: "Benutzerdefiniert",
    },

    add: {
      title: "Neue benutzerdefinierte Spalte",
      namePlaceholder: "Spaltenname…",
      types: {
        text: "Text",
        number: "Zahl",
        date: "Datum",
      },
    },

    actions: {
      add: "Hinzufügen",
      close: "Schließen",
    },
  },

  projectModal: {
    title: "Projekt – Informationen",
    intro:
      "Die rechte Seite zeigt den zuletzt gespeicherten Stand. Projektinformationen und Verantwortliche werden getrennt gespeichert.",

    left: {
      projectDraftTitle: "Projektdaten (Entwurf)",
      ownersDraftTitle: "Verantwortliche (Entwurf)",
    },

    fields: {
      projectName: "Projektname",
      customer: "Kunde",
      projectNo: "Projektnr.",
      start: "Projektstart",
      notesOptional: "Notizen (optional)",
      onePerLine: "Ein Name pro Zeile",
      name: "Name",
      ganttColorOptional: "Gantt-Farbe (optional)",
    },

    placeholders: {
      projectName: "Z. B. Kraftwerkssanierung",
      customer: "Z. B. Example Ltd.",
      projectNo: "Z. B. 24-1033",
      notes: "Z. B. Annahmen, Umfang, Meilensteinnotizen...",
      ownersList: "Max\nOscar\nNina\nHeidi",
    },

    actions: {
      reset: "Zurücksetzen",
      saveProject: "Projektinfos speichern",
      saveOwners: "Verantwortliche speichern",
      edit: "Bearbeiten",
      delete: "Löschen",
      save: "Speichern",
      cancel: "Abbrechen",
      close: "Schließen",
      default: "Standard",
      useDefault: "Standard verwenden",
    },

    tips: {
      ownerColor:
        "Tipp: Farbe über Bearbeiten auf der rechten Seite setzen. Leere Farbe = Standardfarbe für Gantt.",
    },

    right: {
      previewTitle: "Vorschau (zuletzt gespeichert)",
      ownersTitle: "Verantwortliche (zuletzt gespeichert)",
      ownersEmpty: "Noch keine Verantwortlichen hinzugefügt.",
    },

    preview: {
      labels: {
        customer: "Kunde:",
        projectNo: "Projektnr.:",
        start: "Start:",
      },
      defaults: {
        projectName: "Projektname",
        notes: "Notizen…",
        dash: "—",
      },
    },

    owner: {
      colorCustom: "Benutzerdefinierte Farbe",
      colorDefault: "Standardfarbe",
    },

    milestoneAnchor: {
      title: "Meilensteindatum wählen",
      text: "Soll der Meilenstein auf dem Start- oder Enddatum liegen?",
      start: "Startdatum",
      end: "Enddatum",
      cancel: "Abbrechen",
    },

    footer: {
      next:
        "Nächster Schritt: Die Spalte „Verantwortlich“ in der Tabelle mit dieser Liste verbinden und Farben in Gantt spiegeln.",
    },
  },

  gantt: {
    milestone: "Meilenstein",
    weekPrefix: "Woche",
    monthShort: {
      jan: "Jan",
      feb: "Feb",
      mar: "Mär",
      apr: "Apr",
      may: "Mai",
      jun: "Jun",
      jul: "Jul",
      aug: "Aug",
      sep: "Sep",
      oct: "Okt",
      nov: "Nov",
      dec: "Dez",
    },
    weekdayShort: {
      mon: "Mo.",
      tue: "Di.",
      wed: "Mi.",
      thu: "Do.",
      fri: "Fr.",
      sat: "Sa.",
      sun: "So.",
    },
  },

  tableCore: {
    summaryTitle: "Zusammenfassung",
    headerInfoDemo:
      "Demo-Projekt • Jan 2026 • Lokaler Entwurf (später: DB) • Split-View bereit",
    dragToMoveColumn: "Ziehen, um Spalte zu verschieben",
    dragToResizeColumn: "Ziehen, um Größe zu ändern",
    dragToMoveRow: "Ziehen, um Zeile zu verschieben",
    chooseDate: "Datum wählen",
    chooseDateFor: "Datum wählen für",
    datePickerFor: "Datepicker für",
    showSubRows: "Unterzeilen anzeigen",
    hideSubRows: "Unterzeilen ausblenden",
  },

  app: {
    columns: {
      activity: "Aktivität",
      start: "Start",
      end: "Ende",
      duration: "Dauer",
      dependency: "Abhängigkeit",
      wbs: "WBS",
      owner: "Verantwortlich",
      status: "Status",
      percentComplete: "% erledigt",
      percentRemaining: "% verbleibend",
      comment: "Kommentar",
    },

    progressStatus: {
      notStarted: "Nicht gestartet",
      inProgress: "In Arbeit",
      delayed: "Verzögert",
      completed: "Abgeschlossen",
      cancelled: "Entfällt",
    },

    demo: {
      phase1Title: "PHASE 1 – PLANUNG",
      defineScope: "Umfang definieren",
      stakeholderAlignment: "Abstimmung mit Stakeholdern",
      riskAssessment: "Risikobewertung",
      planSignOff: "Planfreigabe",
    },

    header: {
      project: "Projekt",
      customer: "Kunde",
      projectStart: "Projektstart",
      fallback:
        "Projekt: Progress Demo • Kunde: Example AS • Plan: v0 • Jan 2026",
    },

    split: {
      dragToResize: "Ziehen, um Größe zu ändern",
    },

    aria: {
      tableHorizontalScroll: "Horizontales Scrollen der Tabelle",
      ganttHorizontalScroll: "Horizontales Scrollen von Gantt",
    },

    datePicker: {
      ariaLabel: "Datepicker",
      prevMonthAria: "Vorheriger Monat",
      nextMonthAria: "Nächster Monat",

      weekdayShort: {
        mon: "Mo",
        tue: "Di",
        wed: "Mi",
        thu: "Do",
        fri: "Fr",
        sat: "Sa",
        sun: "So",
      },

      monthFull: {
        jan: "Januar",
        feb: "Februar",
        mar: "März",
        apr: "April",
        may: "Mai",
        jun: "Juni",
        jul: "Juli",
        aug: "August",
        sep: "September",
        oct: "Oktober",
        nov: "November",
        dec: "Dezember",
      },

      clear: "Leeren",
      clearTitle: "Datum löschen",
      ok: "OK",
      okTitle: "Übernehmen",
      today: "Heute",
      todayTitle: "Heute auswählen",
    },

    durationPopover: {
      title: "Dauer anpassen",
      moveStart: "Start verschieben",
      moveEnd: "Ende verschieben",
      keepEndMoveStartTitle: "Ende behalten, Start verschieben",
      keepStartMoveEndTitle: "Start behalten, Ende verschieben",
    },

    weekendPopover: {
      title: "Das gewählte Datum liegt an einem Wochenende. Auf einen Arbeitstag verschieben?",
      prevWorkday: "Vorherigen Arbeitstag verwenden",
      nextWorkday: "Nächsten Arbeitstag verwenden",
      cancel: "Abbrechen",
    },

    footer: {
      copyright: "© 2025 Morning Coffee Labs",
      terms: "Bedingungen",
      privacy: "Datenschutz",
    },
  },

  printPreview: {
    topTitle: "Druck / PDF",
    paperLabel: "Papier",
    includeDeps: "Abhängigkeiten",
    printBtn: "Drucken / als PDF speichern",
    closeBtn: "Schließen",

    layoutModeLabel: "Drucktyp",
    modeFull: "Vollständig",
    modeTable: "Nur Tabelle",
    modeGantt: "Nur Gantt",

    customerLabel: "Kunde:",
    projectPeriodLabel: "Projektzeitraum:",
    notSet: "(nicht gesetzt)",
    projectNameNotSet: "Projektname (nicht gesetzt)",
  },

  projectLibrary: {
    title: "Meine gespeicherten Projekte",
    intro: "Projekte werden lokal in der Browserdatenbank gespeichert (IndexedDB).",
    current: "Aktuell",
    refresh: "Aktualisieren",
    close: "Schließen",
    loading: "Lädt…",
    empty: "Noch keine gespeicherten Projekte. Nutze Datei → Speichern, um eines anzulegen.",
    colTitle: "Projekt",
    colUpdated: "Aktualisiert",
    colActions: "Aktionen",
    open: "Öffnen",
    duplicate: "Duplizieren",
    delete: "Löschen",
    deleteTip: "Löscht dieses Projekt aus der lokalen Datenbank",
    activeTip: "Aktuell geladenes Projekt",
    notFound: "Projekt nicht gefunden.",
    openConflictTitle: "Dieser Tab enthält bereits ein Projekt",
    openConflictText:
      "Möchtest du das aktuelle Projekt in diesem Tab überschreiben, das Projekt in einem neuen Tab öffnen oder abbrechen?",
    cancel: "Abbrechen",
    openInNewTab: "In neuem Tab öffnen",
    overwriteCurrent: "Aktuelles überschreiben",
  },
};

export default de;
