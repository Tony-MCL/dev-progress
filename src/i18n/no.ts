// src/i18n/no.ts
const no = {
  header: {
    help: "Hjelp",
  },

  // ============================
  // ADD: PaywallModal
  // ============================
  paywall: {
    close: "Lukk",

    tabs: {
      trial: "Trial",
      buy: "Kjøp lisens",
    },

    labels: {
      email: "E-postadresse",
      password: "Passord",
    },

    placeholders: {
      email: "navn@firma.no",
      password: "Minst 6 tegn",
      orgName: "Firma AS",
      orgNr: "9 siffer",
      contactName: "Ola Nordmann",
      phone: "+47 ...",
      fullName: "Ola Nordmann",
      country: "Norge",
    },

    buyerType: {
      company: "Bedrift",
      private: "Privat",
    },

    fields: {
      orgName: "Firmanavn",
      orgNr: "Org.nr",
      contactName: "Kontaktperson",
      phone: "Telefon",
      fullName: "Navn",
      country: "Land",
    },

    trial: {
      title: "Prøv Fullversjon gratis i 10 dager",
      body: "Skriv inn e-post og passord for å starte prøveperioden.",
      action: "Start prøveperiode",
      started:
        "Prøveperiode er startet. Du kan nå bruke Fullversjon-funksjoner i 10 dager.",
    },

    buy: {
      title: "Kjøp lisens for Fullversjon",
      body: "Fyll inn informasjon én gang, velg lisenstype og gå til betaling.",

      licenseType: "Lisenstype",
      subscription: "Abonnement",
      oneTime: "Enkeltkjøp",

      payCadence: "Med betaling:",
      month: "Månedlig",
      year: "Årlig",

      duration: "Varighet",
      oneMonth: "1 måned",
      oneYear: "1 år",

      summary: {
        price: "Pris",
        vat: "Mva",
        total: "Pris inkl. mva",
        perMonth: "kr/mnd",
        perYear: "kr/år",
        currency: "Valuta",
      },

      action: "Gå til betaling",
    },

    validation: {
      invalidEmail: "Skriv inn en gyldig e-postadresse.",
      invalidPassword: "Passord må være minst 6 tegn.",
      missingFields: "Fyll inn alle påkrevde felt.",
      invalidOrgNr: "Org.nr ser ikke riktig ut (9 siffer).",
    },

    errors: {
      network:
        "Noe gikk galt. Sjekk at Worker-endepunktene er riktige.",
      wrongEndpoint:
        "Det ser ut som checkout-kallet går til feil adresse (ikke Worker). Sjekk VITE_PROGRESS_WORKER_BASE_URL.",
      noCheckoutUrl:
        "Worker returnerte ingen checkout-url (forventet { url }).",
    },
  },
  // ============================
  // END ADD
  // ============================

  help: {
    title: "Hjelp",
    closeAria: "Lukk hjelp",

    intro:
      "Dette panelet er laget for daglig bruk. Tenk: «jeg må få planen riktig nå». Åpne spørsmålene og bruk det som en liten oppslagsbok.",

    faqText: `Q: Hvordan henger tabellen og Gantt sammen?
A: Tabellen er «kilden til sannhet» der du skriver inn aktivitet, datoer og data. Gantt viser nøyaktig de samme radene som tidsblokker.
- Scrolling er synkron: rader skal alltid ligge på linje.
- Hvis noe ser «borte» ut: sjekk om under-rader er kollapset.

Q: Hvordan redigerer jeg en celle uten å rote til resten?
A: Klikk i cellen og begynn å skrive. Enter lagrer endringen.
- Esc avbryter redigering (og lukker paneler).
- Bruk piltaster/tab for å navigere som i et regneark.

Q: Hvordan legger jeg til rader raskt?
A: Gå til Tabell → Rader.
- «Legg til rad nederst» lager ny rad på slutten.
- «Legg til rad under markert» setter inn rett under den raden du står på.
- «Slett markerte rader» fjerner de du har valgt.

Q: Hierarki/underaktiviteter: hvordan fungerer det?
A: Rader kan rykkes inn/ut for å lage struktur (hovedaktivitet med underaktiviteter).
- Alt + Pil høyre = rykk inn (gjør den til underaktivitet).
- Alt + Pil venstre = rykk ut.
- Bruk pil/vis-skjul for å kollapse under-rader.

Q: Hva betyr kolonnene Aktivitet / Start / Slutt / Varighet?
A: Aktivitet er navnet på oppgaven. Start/Slutt er datoer. Varighet er hvor lenge oppgaven varer.
- Du kan vanligvis styre planen ved å fylle inn Start+Slutt, eller bruke Varighet der det er aktivert.
- Kalender (fridager/ferie) påvirker beregninger som bruker arbeidsdager.

Q: Hvordan velger jeg dato enklest?
A: Dobbelklikk i en datocelle for datovelger.
- Du kan også skrive dato som f.eks. 17.01.2026 eller 2026-01-17 (vanlige formater tolkes).

Q: Hva er «Kalender – fridager og ferie», og hvorfor bry seg?
A: Kalenderen lar deg registrere dager som ikke er arbeidsdager (ferie, stans, fridager).
- Dette påvirker beregning av arbeidsdager i varighet/lag (der det brukes).
- Hurtigvalg lar deg legge inn norske helligdager for valgt år.
- Du kan redigere og slette registrerte perioder senere.

Q: Hvordan fungerer Kolonner (skjul/vis/flytt/størrelse)?
A: Tabell → Kolonner åpner kolonnevalg og egendefinerte kolonner.
- Dra kolonneheader for å flytte kolonner.
- Dra i kanten for å endre bredde.
- Du kan legge til egendefinerte kolonner (Tekst, Tall, Dato).

Q: Hva er Prosjektinfo – og hva bør jeg fylle inn?
A: Prosjektinfo er metadata: prosjektnavn, kunde, prosjektnr., startdato, notater og ansvarlige.
- Nyttig for utskrift/rapport senere og for å gjøre planen tydelig for andre.
- Høyre side viser sist lagret forhåndsvisning.

Q: Hvordan lagres planen? (Lagre/Åpne/Mine lagrede prosjekter)
A: I denne versjonen lagres prosjekter lokalt i nettleserens database (IndexedDB).
- Fil → Lagre: lagrer gjeldende plan.
- Fil → Åpne: åpner igjen lokalt lagrede prosjekter.
- «Mine lagrede prosjekter» viser en liste der du kan åpne/duplisere/slette.

Q: Hva betyr «gratis-modus: ett prosjekt av gangen»?
A: I gratis-modus kan appen be om bekreftelse før den overskriver gjeldende plan når du lager en ny.
- Hvis du vil beholde noe, lagre eller dupliser først.

Q: Import/eksport – hvordan deler jeg planen med Excel eller andre?
A: Bruk TSV (tab-separert), det fungerer svært godt med Excel.
- Fil → Eksporter → (TSV/CSV avhengig av menyen din).
- Fil → Importer → TSV: limer/leser tabell-data tilbake.

Q: Avhengigheter: hva er de i praksis?
A: Avhengigheter sier «denne oppgaven kan ikke starte/avslutte før en annen».
- Standard er ofte Finish-to-Start (FS): A må være ferdig før B kan starte.
- Du kan bruke lag (+/- dager) for å legge inn ventetid eller overlapp.

Q: Hvordan skriver jeg en avhengighet riktig?
A: Skriv i kolonnen Avhengighet.
- Eksempel: 6FS+2 betyr «etter rad 6 (FS) + 2 dager lag».
- Flere avhengigheter kan skilles med komma eller semikolon (hvis støttet i din build).

Q: Hvorfor flytter datoer seg når jeg legger inn avhengigheter?
A: Når avhengigheter er aktive, prøver appen å håndheve reglene og kan justere datoer for å få planen konsistent.
- Hvis du vil låse en oppgave, fyll inn både Start og Slutt eksplisitt.
- Sjekk at forgjenger-oppgaven har gyldige datoer.

Q: Gantt: hva brukes Zoom/helgeskygge/i-dag-linje til?
A: Gantt er oversikten – zoom avgjør detaljnivå.
- Zoom inn/ut/reset: bytter skala slik at tekst og blokker blir lesbare.
- Helgeskygge: markerer helger visuelt.
- I dag-linje: viser hvor «i dag» ligger i planen.

Q: Skriv ut… (hvis den ikke fungerer)
A: Utskrift-knappen kan være synlig selv om print-modulen er deaktivert i denne versjonen.
- Hvis ingenting skjer: bruk eksport (TSV/CSV) som deling/backup midlertidig.

Q: De viktigste hurtigtastene
A: Dette er de mest nyttige i daglig bruk.
- Ctrl+S: lagre
- Ctrl+O: åpne
- Ctrl+N: ny plan
- Esc: lukk paneler / avbryt
- Alt + Pil venstre/høyre: rykk ut/inn (hierarki)
`,

    outro:
      "Tips når noe ser rart ut: 1) sjekk om rader er kollapset, 2) sjekk avhengigheter, 3) sjekk kalender/fridager. Test gjerne i en kopi før du gjør store endringer.",

    // legacy (ikke i bruk nå)
    text1: "",
    text2: "",
    text3: "",
  },

  lang: {
    aria: "Språkvalg",
  },

  theme: {
    switchToDark: "Bytt til mørk modus",
    switchToLight: "Bytt til lys modus",
  },

  toolbar: {
    top: {
      file: "Fil",
      table: "Tabell",
      gantt: "Gantt",
      calendar: "Kalender",
      project: "Prosjekt",
    },

    file: {
      new: "Ny",
      newPlan: "Ny plan",
      fromTemplate: "Fra mal…",
      open: "Åpne",
      openEllipsis: "Åpne…",
      openRecent: "Åpne nylig",

      openProjectFree: "Åpne prosjekt",
      openProjectPro: "Åpne fra sky",
      openFile: "Åpne fra fil",

      save: "Lagre",
      saveAs: "Lagre som…",

      saveFree: "Lagre prosjekt",
      savePro: "Lagre til sky",
      saveToFile: "Lagre til fil",

      print: "Skriv ut…",
      export: "Eksporter",
      import: "Importer",
    },

    table: {
      columns: "Kolonner",
      chooseVisibleColumns: "Velg synlige kolonner…",
      rows: "Rader",
      addRowEnd: "Legg til rad nederst",
      addRowBelow: "Legg til rad under markert",
      deleteSelectedRows: "Slett markerte rader",
    },

    gantt: {
      zoom: "Zoom",
      zoomIn: "Zoom inn",
      zoomOut: "Zoom ut",
      zoomReset: "Reset (100%)",
      view: "Visning",
      toggleWeekend: "Vis/skjul helgeskygge",
      toggleTodayLine: "Vis/skjul i dag-linje",
    
      colorPicker: {
        label: "Fargevalg",
        title: "Velg farge for Gantt-barer",
      },
    },

    calendar: {
      manage: "Fridager og ferie…",
    },

    project: {
      manage: "Prosjektinfo…",
    },

    confirmOverwrite: {
      title: "Erstatte gjeldende prosjekt?",
      textFree:
        "I gratis-modus kan du jobbe i ett prosjekt av gangen. Vil du overskrive ditt lagrede prosjekt?",
      textPro:
        "Denne handlingen vil erstatte innholdet i prosjektet som er åpent i denne fanen. Vil du fortsette?",
      cancel: "Avbryt",
      confirm: "Overskriv",
    },

    a11y: {
      submenuAriaPrefix: "Undermeny: ",
    },
  },

  calendarModal: {
    title: "Kalender – fridager og ferie",
    intro:
      "Legg inn datoer som ikke er arbeidsdager (fridager, ferie, stans osv.). Dette påvirker varighet og dato-beregning.",

    left: {
      title: "Legg til fridager / ferie",
    },

    fields: {
      from: "Fra",
      to: "Til",
      nameOptional: "Navn (valgfritt)",
      namePlaceholder: "F.eks. Påske, Sommerferie, Stans",
      name: "Navn",
      nameEditPlaceholder: "Valgfritt navn",
    },

    quick: {
      title: "Hurtigvalg – nasjonale helligdager",
      year: "År",
      addAll: "Legg til alle",
      addPicked: "Legg til valgte",
      resetPick: "Nullstill valg",
    },

    right: {
      title: "Registrerte datoer / perioder",
      countSuffix: "stk",
      empty: "Ingen fridager registrert ennå.",
    },

    actions: {
      addPeriod: "Legg til periode",
      edit: "Rediger",
      delete: "Slett",
      save: "Lagre",
      cancel: "Avbryt",
      close: "Lukk",
    },

    tip:
      "Tips: For helligdager kan du velge år og legge dem til. Hver helligdag legges inn som en egen dato.",
  },

  holidays: {
    newYearsDay: "1. nyttårsdag",
    labourDay: "Arbeidernes dag",
    constitutionDay: "Grunnlovsdag",
    christmasDay1: "1. juledag",
    christmasDay2: "2. juledag",
    maundyThursday: "Skjærtorsdag",
    goodFriday: "Langfredag",
    easterSunday: "1. påskedag",
    easterMonday: "2. påskedag",
    ascensionDay: "Kristi Himmelfartsdag",
    whitSunday: "1. pinsedag",
    whitMonday: "2. pinsedag",
  },

  columnManagerModal: {
    title: "Kolonner",
    intro: "Velg hvilke kolonner som er synlige, eller legg til egne kolonner.",

    list: {
      custom: "Egendefinert",
    },

    add: {
      title: "Ny egendefinert kolonne",
      namePlaceholder: "Kolonnenavn…",
      types: {
        text: "Tekst",
        number: "Tall",
        date: "Dato",
      },
    },

    actions: {
      add: "Legg til",
      close: "Lukk",
    },
  },

  projectModal: {
    title: "Prosjekt – informasjon",
    intro:
      "Høyre side viser sist lagret. Prosjektinfo og ansvarlige lagres hver for seg.",

    left: {
      projectDraftTitle: "Prosjektdata (utkast)",
      ownersDraftTitle: "Ansvarlige (utkast)",
    },

    fields: {
      projectName: "Prosjektnavn",
      customer: "Kunde",
      projectNo: "Prosjektnr.",
      start: "Prosjektstart",
      notesOptional: "Notater (valgfritt)",
      onePerLine: "Ett navn per linje",
      name: "Navn",
      ganttColorOptional: "Gantt-farge (valgfritt)",
    },

    placeholders: {
      projectName: "F.eks. Rehabilitering av kraftverk",
      customer: "F.eks. Example AS",
      projectNo: "F.eks. 24-1033",
      notes: "F.eks. leveranseforutsetninger, scope, milepælnotater...",
      ownersList: "John\nOscar\nNina\nHeidi",
    },

    actions: {
      reset: "Nullstill",
      saveProject: "Lagre prosjektinfo",
      saveOwners: "Lagre ansvarlige",
      edit: "Rediger",
      delete: "Slett",
      save: "Lagre",
      cancel: "Avbryt",
      close: "Lukk",
      default: "Default",
      useDefault: "Bruk default",
    },

    tips: {
      ownerColor:
        "Tips: Farge settes i Rediger på høyre side. Tom farge = default gantt-farge.",
    },

    right: {
      previewTitle: "Forhåndsvisning (sist lagret)",
      ownersTitle: "Ansvarlige (sist lagret)",
      ownersEmpty: "Ingen ansvarlige lagt inn ennå.",
    },

    preview: {
      labels: {
        customer: "Kunde:",
        projectNo: "Prosjektnr.:",
        start: "Start:",
      },
      defaults: {
        projectName: "Prosjektnavn",
        notes: "Notater…",
        dash: "—",
      },
    },

    owner: {
      colorCustom: "Egendefinert farge",
      colorDefault: "Default farge",
    },

    footer: {
      next:
        "Neste steg: koble “Ansvarlig” i tabellen til denne listen + speile fargen i Gantt.",
    },
  },

  gantt: {
    weekPrefix: "uke",
    monthShort: {
      jan: "Jan",
      feb: "Feb",
      mar: "Mar",
      apr: "Apr",
      may: "Mai",
      jun: "Jun",
      jul: "Jul",
      aug: "Aug",
      sep: "Sep",
      oct: "Okt",
      nov: "Nov",
      dec: "Des",
    },
    weekdayShort: {
        mon: "man.",
        tue: "tir.",
        wed: "ons.",
        thu: "tor.",
        fri: "fre.",
        sat: "lør.",
        sun: "søn.",
      },
  },

  tableCore: {
    summaryTitle: "Sammendrag",
    headerInfoDemo:
      "Demo Project • Jan 2026 • Local draft (later: DB) • Split-view ready",
    dragToMoveColumn: "Dra for å flytte kolonne",
    dragToResizeColumn: "Dra for å endre bredde",
    dragToMoveRow: "Dra for å flytte rad",
    chooseDate: "Velg dato",
    chooseDateFor: "Velg dato for",
    datePickerFor: "Datovelger for",
    showSubRows: "Vis under-rader",
    hideSubRows: "Skjul under-rader",
  },

  app: {
    columns: {
      activity: "Aktivitet",
      start: "Start",
      end: "Slutt",
      duration: "Varighet",
      dependency: "Avhengighet",
      wbs: "WBS",
      owner: "Ansvar",
      comment: "Kommentar",
    },

    demo: {
      phase1Title: "FASE 1 – PLANLEGGING",
      defineScope: "Definer scope",
      stakeholderAlignment: "Stakeholder alignment",
      riskAssessment: "Risikovurdering",
      planSignOff: "Plan sign-off",
    },

    header: {
      project: "Prosjekt",
      customer: "Kunde",
      projectStart: "Prosjektstart",
      fallback: "Prosjekt: Progress Demo • Kunde: Example AS • Plan: v0 • Jan 2026",
    },

    split: {
      dragToResize: "Dra for å endre bredde",
    },

    aria: {
      tableHorizontalScroll: "Tabell horisontal scroll",
      ganttHorizontalScroll: "Gantt horisontal scroll",
    },

    datePicker: {
      ariaLabel: "Datovelger",
      prevMonthAria: "Forrige måned",
      nextMonthAria: "Neste måned",
    
      weekdayShort: {
        mon: "ma.",
        tue: "ti.",
        wed: "on.",
        thu: "to.",
        fri: "fr.",
        sat: "lø.",
        sun: "sø.",
      },
    
      monthFull: {
        jan: "januar",
        feb: "februar",
        mar: "mars",
        apr: "april",
        may: "mai",
        jun: "juni",
        jul: "juli",
        aug: "august",
        sep: "september",
        oct: "oktober",
        nov: "november",
        dec: "desember",
      },
    
      clear: "Fjern",
      clearTitle: "Fjern dato",
      ok: "OK",
      okTitle: "Commit",
      today: "I dag",
      todayTitle: "Velg i dag",
    },

    durationPopover: {
      title: "Endre varighet",
      moveStart: "Flytt start",
      moveEnd: "Flytt slutt",
      keepEndMoveStartTitle: "Behold slutt, flytt start",
      keepStartMoveEndTitle: "Behold start, flytt slutt",
    },

    weekendPopover: {
      title: "Datoen du valgte faller på helg. Vil du flytte til en virkedag?",
      prevWorkday: "Bruk siste virkedag",
      nextWorkday: "Bruk neste virkedag",
      cancel: "Avbryt",
    },

    footer: {
      copyright: "© 2025 Morning Coffee Labs",
      terms: "Terms",
      privacy: "Privacy",
    },
  },

  printPreview: {
    topTitle: "Print / PDF",
    paperLabel: "Papir",
    includeDeps: "Avhengigheter",
    printBtn: "Print / Lagre som PDF",
    closeBtn: "Lukk",
  
    customerLabel: "Kunde:",
    projectPeriodLabel: "Prosjektperiode:",
    notSet: "(ikke satt)",
    projectNameNotSet: "Prosjektnavn (ikke satt)",
  },

  projectLibrary: {
    title: "Mine lagrede prosjekter",
    intro: "Prosjekter lagres lokalt i nettleser-databasen (IndexedDB).",
    current: "Gjeldende",
    refresh: "Oppdater",
    close: "Lukk",
    loading: "Laster…",
    empty: "Ingen lagrede prosjekter ennå. Bruk Fil → Lagre for å lage ett.",
    colTitle: "Prosjekt",
    colUpdated: "Oppdatert",
    colActions: "Handlinger",
    open: "Åpne",
    duplicate: "Dupliser",
    delete: "Slett",
    deleteTip: "Sletter dette prosjektet fra lokal database",
    activeTip: "Prosjektet som er lastet nå",
    notFound: "Fant ikke prosjektet.",
    openConflictTitle: "Denne fanen inneholder allerede et prosjekt",
    openConflictText: "Vil du overskrive gjeldende prosjekt i denne fanen, åpne prosjektet i en ny fane, eller avbryte?",
    cancel: "Avbryt",
    openInNewTab: "Åpne i ny fane",
    overwriteCurrent: "Overskriv eksisterende",
  },
};

export default no;
