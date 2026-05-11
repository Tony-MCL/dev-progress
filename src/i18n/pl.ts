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

  paywall: {
    close: "Zamknij",

    tabs: {
      trial: "Okres próbny",
      buy: "Kup licencję",
    },

    labels: {
      email: "Adres e-mail",
      password: "Hasło",
    },

    placeholders: {
      email: "nazwa@firma.com",
      password: "Co najmniej 6 znaków",
      orgName: "Firma Sp. z o.o.",
      orgNr: "9 cyfr",
      contactName: "Jan Kowalski",
      phone: "+47 ...",
      fullName: "Jan Kowalski",
      country: "Norwegia",
    },

    buyerType: {
      company: "Firma",
      private: "Osoba prywatna",
    },

    fields: {
      orgName: "Nazwa firmy",
      orgNr: "Numer organizacyjny",
      contactName: "Osoba kontaktowa",
      phone: "Telefon",
      fullName: "Imię i nazwisko",
      country: "Kraj",
    },

    trial: {
      title: "Wypróbuj pełną wersję za darmo przez 10 dni",
      body: "Wpisz e-mail i hasło, aby rozpocząć okres próbny.",
      action: "Rozpocznij okres próbny",
      started:
        "Okres próbny został rozpoczęty. Możesz teraz korzystać z funkcji pełnej wersji przez 10 dni.",
    },

    buy: {
      title: "Kup licencję pełnej wersji",
      body: "Wprowadź dane, wybierz typ licencji i przejdź do płatności.",

      licenseType: "Typ licencji",
      subscription: "Subskrypcja",
      oneTime: "Jednorazowo",

      payCadence: "Płatność:",
      month: "Miesięcznie",
      year: "Rocznie",

      duration: "Okres",
      oneMonth: "1 miesiąc",
      oneYear: "1 rok",

      summary: {
        price: "Cena",
        vat: "VAT",
        total: "Cena z VAT",
        perMonth: "NOK/mies.",
        perYear: "NOK/rok",
        currency: "Waluta",
      },

      action: "Przejdź do płatności",
    },

    validation: {
      invalidEmail: "Wpisz prawidłowy adres e-mail.",
      invalidPassword: "Hasło musi mieć co najmniej 6 znaków.",
      missingFields: "Wypełnij wszystkie wymagane pola.",
      invalidOrgNr: "Numer organizacyjny wygląda nieprawidłowo (9 cyfr).",
    },

    errors: {
      network:
        "Coś poszło nie tak. Sprawdź, czy endpointy Workera są poprawne.",
      wrongEndpoint:
        "Wygląda na to, że żądanie checkout trafia pod zły adres (nie do Workera). Sprawdź VITE_PROGRESS_WORKER_BASE_URL.",
      noCheckoutUrl:
        "Worker nie zwrócił adresu checkout-url (oczekiwano { url }).",
    },
  },

  help: {
    title: "Pomoc",
    closeAria: "Zamknij pomoc",

    intro:
      "Ten panel jest przeznaczony do codziennej pracy: gdy plan musi być poprawny od razu. Otwórz pytanie i użyj go jako szybkiej ściągi.",

    faqText: `Q: Jak tabela i Gantt są ze sobą powiązane?
A: Tabela jest źródłem prawdy — wpisujesz w niej zadania, daty i dane. Gantt pokazuje te same wiersze jako paski na osi czasu.
- Przewijanie jest zsynchronizowane: wiersze powinny być idealnie wyrównane.
- Jeśli coś wygląda na „zniknięte”, sprawdź, czy podwiersze nie są zwinięte.

Q: Jak edytować komórkę bez psucia reszty?
A: Kliknij komórkę i zacznij pisać. Enter zapisuje zmianę.
- Esc anuluje edycję (i zamyka panele).
- Używaj strzałek/tabulatora, aby poruszać się jak w arkuszu kalkulacyjnym.

Q: Jak szybko dodać wiersze?
A: Użyj Tabela → Wiersze.
- „Dodaj wiersz na końcu” tworzy nowy wiersz na dole.
- „Dodaj wiersz poniżej zaznaczenia” wstawia wiersz bezpośrednio pod aktywnym wierszem.
- „Usuń zaznaczone wiersze” usuwa zaznaczone wiersze.

Q: Hierarchia / podzadania: jak to działa?
A: Wiersze można wcinać i cofać wcięcie, aby tworzyć strukturę (zadanie główne z podzadaniami).
- Alt + strzałka w prawo = wcięcie (utwórz podzadanie).
- Alt + strzałka w lewo = cofnięcie wcięcia.
- Użyj przełącznika, aby zwijać i rozwijać podwiersze.

Q: Co oznaczają Zadanie / Start / Koniec / Czas trwania?
A: Zadanie to nazwa aktywności. Start/Koniec to daty. Czas trwania określa, jak długo trwa zadanie.
- Możesz sterować planem, wpisując Start+Koniec albo używając Czasu trwania tam, gdzie jest dostępny.
- Kalendarz (święta/urlop) może wpływać na obliczenia oparte na dniach roboczych.

Q: Jaki jest najłatwiejszy sposób wyboru dat?
A: Kliknij dwukrotnie komórkę daty, aby otworzyć selektor daty.
- Możesz też wpisywać typowe formaty, np. 2026-01-17 (i wiele innych).

Q: Czym jest „Kalendarz — święta i urlop” i dlaczego warto go używać?
A: Kalendarz pozwala rejestrować dni wolne od pracy (święta, urlopy, przestoje itp.).
- Wpływa to na obliczenia czasu trwania i dat oparte na dniach roboczych.
- Szybkie dodawanie może wstawić święta publiczne dla wybranego roku.
- Wpisy można później edytować i usuwać.

Q: Kolumny: pokaż/ukryj/przenieś/zmień szerokość — jak?
A: Tabela → Kolumny pozwala wybrać widoczne kolumny i dodać własne.
- Przeciągnij nagłówek, aby zmienić kolejność kolumn.
- Przeciągnij krawędź, aby zmienić szerokość.
- Możesz dodać własne kolumny (Tekst, Liczba, Data).

Q: Czym są informacje o projekcie i co należy wpisać?
A: Informacje o projekcie przechowują metadane: nazwę projektu, klienta, numer projektu, datę startu, notatki i osoby odpowiedzialne.
- Przydaje się to do profesjonalnego udostępniania i późniejszego raportowania/drukowania.
- Po prawej stronie widać ostatnio zapisany podgląd.

Q: Jak zapisywany jest mój plan? (Zapisz/Otwórz/Moje zapisane projekty)
A: W tej wersji projekty są przechowywane lokalnie w bazie przeglądarki (IndexedDB).
- Plik → Zapisz zapisuje bieżący plan.
- Plik → Otwórz wczytuje lokalnie zapisane projekty.
- „Moje zapisane projekty” pokazuje listę, gdzie można otworzyć, skopiować lub usunąć projekt.

Q: Co oznacza „tryb darmowy: jeden projekt naraz”?
A: W trybie darmowym aplikacja może poprosić o potwierdzenie przed nadpisaniem bieżącego planu przy tworzeniu nowego.
- Jeśli chcesz coś zachować, najpierw zapisz albo utwórz kopię.

Q: Import/Eksport — jak udostępnić dane do Excela?
A: Użyj TSV (wartości rozdzielane tabulatorami). Bardzo dobrze działa z Excelem.
- Plik → Eksport → (TSV/CSV zależnie od menu).
- Plik → Import → TSV pozwala wczytać dane z powrotem.

Q: Zależności — co oznaczają w praktyce?
A: Zależności oznaczają, że „to zadanie nie może rozpocząć się/zakończyć przed innym zadaniem”.
- Najczęściej używany typ to Finish-to-Start (FS): A musi się zakończyć, zanim B może wystartować.
- Opóźnienie (+/- dni) pozwala dodać czas oczekiwania lub nakładanie się zadań.

Q: Jak poprawnie wpisać zależność?
A: Wpisz ją w kolumnie Zależność.
- Przykład: 6FS+2 oznacza „po wierszu 6 (FS) + 2 dni opóźnienia”.
- Kilka zależności można oddzielać przecinkiem lub średnikiem (jeśli obsługuje to dana wersja).

Q: Dlaczego daty przesuwają się po dodaniu zależności?
A: Gdy zależności są aktywne, aplikacja próbuje zachować reguły i może przesuwać daty, aby plan był spójny.
- Jeśli chcesz zablokować zadanie, wpisz ręcznie zarówno Start, jak i Koniec.
- Sprawdź, czy poprzednik ma prawidłowe daty.

Q: Gantt: do czego służą Zoom / cieniowanie weekendów / linia dzisiejsza?
A: Gantt daje przegląd planu — zoom kontroluje poziom szczegółowości.
- Zoom in/out/reset zmienia skalę, aby paski i tekst były czytelne.
- Cieniowanie weekendów ułatwia zauważenie weekendów.
- Linia dzisiejsza pokazuje, gdzie „dziś” znajduje się w planie.

Q: Drukuj… (jeśli nie działa)
A: Pozycja Drukuj może być widoczna nawet wtedy, gdy moduł druku jest wyłączony w tej wersji.
- Jeśli nic się nie dzieje, użyj eksportu (TSV/CSV) jako tymczasowego udostępniania/kopii.

Q: Najważniejsze skróty klawiaturowe
A: To najbardziej przydatne skróty w codziennej pracy.
- Ctrl+S: zapisz
- Ctrl+O: otwórz
- Ctrl+N: nowy plan
- Esc: zamknij panele / anuluj
- Alt + strzałka w lewo/prawo: cofnij wcięcie / wcięcie (hierarchia)
`,

    outro:
      "Jeśli coś wygląda nieprawidłowo: 1) sprawdź zwinięte wiersze, 2) sprawdź zależności, 3) sprawdź kalendarz/święta. Większe zmiany testuj najpierw na kopii.",

    text1: "",
    text2: "",
    text3: "",
  },

  lang: {
    aria: "Wybór języka",
  },

  theme: {
    switchToDark: "Przełącz na tryb ciemny",
    switchToLight: "Przełącz na tryb jasny",
  },

  toolbar: {
    top: {
      file: "Plik",
      table: "Tabela",
      gantt: "Gantt",
      calendar: "Kalendarz",
      project: "Projekt",
    },

    file: {
      new: "Nowy",
      newPlan: "Nowy plan",
      fromTemplate: "Z szablonu…",
      open: "Otwórz",
      openEllipsis: "Otwórz…",
      openRecent: "Ostatnie",

      openProject: "Otwórz projekt",
      openFromCloud: "Otwórz z chmury",
      openFile: "Otwórz plik",

      save: "Zapisz",
      saveAs: "Zapisz jako…",

      saveProject: "Zapisz projekt",
      saveToCloud: "Zapisz w chmurze",
      saveToFile: "Zapisz do pliku",

      print: "Drukuj…",
      export: "Eksportuj",
      import: "Importuj",
    },

    table: {
      columns: "Kolumny",
      chooseVisibleColumns: "Wybierz widoczne kolumny…",
      rows: "Wiersze",
      addRowEnd: "Dodaj wiersz na końcu",
      addRowBelow: "Dodaj wiersz poniżej zaznaczenia",
      deleteSelectedRows: "Usuń zaznaczone wiersze",
    },

    gantt: {
      zoom: "Zoom",
      zoomIn: "Powiększ",
      zoomOut: "Pomniejsz",
      zoomReset: "Reset (100%)",
      view: "Widok",
      toggleWeekend: "Przełącz cieniowanie weekendów",
      toggleTodayLine: "Przełącz linię dzisiejszą",

      colorPicker: {
        label: "Kolor",
        title: "Wybierz kolor pasków Gantta",
      },
    },

    calendar: {
      manage: "Święta i urlopy…",
    },

    project: {
      manage: "Informacje o projekcie…",
    },

    confirmOverwrite: {
      title: "Zastąpić bieżący projekt?",
      textFree:
        "W trybie darmowym możesz pracować nad jednym projektem naraz. Czy chcesz nadpisać zapisany projekt?",
      textPro:
        "Ta operacja zastąpi zawartość projektu otwartego w tej karcie. Czy chcesz kontynuować?",
      cancel: "Anuluj",
      confirm: "Zastąp",
    },

    multiTab: {
      title: "Liczba otwartych kart Progress",
      openTabs: "Otwarte karty",
    },

    a11y: {
      submenuAriaPrefix: "Podmenu: ",
    },
  },

  contextMenu: {
    title: "Menu tabeli",
    ariaLabel: "Menu tabeli",
    row: "Wiersz",
    noRow: "Brak wiersza",
    column: "Kolumna",
    noColumn: "Brak kolumny",
    selection: "Zaznaczenie",
    noSelection: "Brak zaznaczenia",
    columnShort: "K",
    makeMilestone: "Ustaw jako kamień milowy",
    removeMilestone: "Usuń kamień milowy",
    indentRows: "Wcięcie wiersza / utwórz podzadanie",
    outdentRows: "Cofnij wcięcie / utwórz zadanie główne",
    cut: "Wytnij",
    copy: "Kopiuj",
    paste: "Wklej",
    insertRowAbove: "Wstaw wiersz powyżej",
    insertRowBelow: "Wstaw wiersz poniżej",
    deleteRows: "Usuń wiersz(e)",
    print: "Drukuj",
    close: "Zamknij",
  },

  calendarModal: {
    title: "Kalendarz – święta i urlopy",
    intro:
      "Dodaj daty, które nie są dniami roboczymi (święta, urlopy, przestoje itp.). Wpływa to na obliczenia czasu trwania i dat.",

    left: {
      title: "Dodaj święta / urlop",
    },

    fields: {
      from: "Od",
      to: "Do",
      nameOptional: "Nazwa (opcjonalnie)",
      namePlaceholder: "Np. Wielkanoc, urlop letni, przestój",
      name: "Nazwa",
      nameEditPlaceholder: "Opcjonalna nazwa",
    },

    quick: {
      title: "Szybkie dodawanie – święta publiczne",
      year: "Rok",
      addAll: "Dodaj wszystkie",
      addPicked: "Dodaj wybrane",
      resetPick: "Wyczyść wybór",
    },

    right: {
      title: "Zarejestrowane daty / okresy",
      countSuffix: "pozycji",
      empty: "Nie dodano jeszcze świąt.",
    },

    actions: {
      addPeriod: "Dodaj okres",
      edit: "Edytuj",
      delete: "Usuń",
      save: "Zapisz",
      cancel: "Anuluj",
      close: "Zamknij",
    },

    tip:
      "Wskazówka: Wybierz rok i dodaj święta publiczne. Każde święto zostanie dodane jako osobny wpis daty.",
  },

  holidays: {
    newYearsDay: "Nowy Rok",
    labourDay: "Święto Pracy",
    constitutionDay: "Święto Konstytucji",
    christmasDay1: "Boże Narodzenie",
    christmasDay2: "Drugi dzień Świąt Bożego Narodzenia",
    maundyThursday: "Wielki Czwartek",
    goodFriday: "Wielki Piątek",
    easterSunday: "Niedziela Wielkanocna",
    easterMonday: "Poniedziałek Wielkanocny",
    ascensionDay: "Wniebowstąpienie Pańskie",
    whitSunday: "Zesłanie Ducha Świętego",
    whitMonday: "Poniedziałek Zielonoświątkowy",
  },

  columnManagerModal: {
    title: "Kolumny",
    intro: "Wybierz widoczne kolumny albo dodaj własne kolumny.",

    list: {
      custom: "Własna",
    },

    add: {
      title: "Nowa kolumna własna",
      namePlaceholder: "Nazwa kolumny…",
      types: {
        text: "Tekst",
        number: "Liczba",
        date: "Data",
      },
    },

    actions: {
      add: "Dodaj",
      close: "Zamknij",
    },
  },

  projectModal: {
    title: "Projekt – informacje",
    intro:
      "Prawa strona pokazuje ostatnio zapisany stan. Informacje o projekcie i osoby odpowiedzialne są zapisywane osobno.",

    left: {
      projectDraftTitle: "Dane projektu (wersja robocza)",
      ownersDraftTitle: "Odpowiedzialni (wersja robocza)",
    },

    fields: {
      projectName: "Nazwa projektu",
      customer: "Klient",
      projectNo: "Nr projektu",
      start: "Start projektu",
      notesOptional: "Notatki (opcjonalnie)",
      onePerLine: "Jedno nazwisko w wierszu",
      name: "Nazwa",
      ganttColorOptional: "Kolor Gantta (opcjonalnie)",
    },

    placeholders: {
      projectName: "Np. modernizacja elektrowni",
      customer: "Np. Example Ltd.",
      projectNo: "Np. 24-1033",
      notes: "Np. założenia, zakres, notatki o kamieniach milowych...",
      ownersList: "Jan\nOscar\nNina\nHeidi",
    },

    actions: {
      reset: "Resetuj",
      saveProject: "Zapisz informacje o projekcie",
      saveOwners: "Zapisz odpowiedzialnych",
      edit: "Edytuj",
      delete: "Usuń",
      save: "Zapisz",
      cancel: "Anuluj",
      close: "Zamknij",
      default: "Domyślnie",
      useDefault: "Użyj domyślnego",
    },

    tips: {
      ownerColor:
        "Wskazówka: Kolor ustawiasz przez Edytuj po prawej stronie. Pusty kolor = domyślny kolor Gantta.",
    },

    right: {
      previewTitle: "Podgląd (ostatnio zapisany)",
      ownersTitle: "Odpowiedzialni (ostatnio zapisani)",
      ownersEmpty: "Nie dodano jeszcze osób odpowiedzialnych.",
    },

    preview: {
      labels: {
        customer: "Klient:",
        projectNo: "Nr projektu:",
        start: "Start:",
      },
      defaults: {
        projectName: "Nazwa projektu",
        notes: "Notatki…",
        dash: "—",
      },
    },

    owner: {
      colorCustom: "Kolor własny",
      colorDefault: "Kolor domyślny",
    },

    milestoneAnchor: {
      title: "Wybierz datę kamienia milowego",
      text: "Czy kamień milowy ma być umieszczony na dacie startu czy zakończenia?",
      start: "Data startu",
      end: "Data zakończenia",
      cancel: "Anuluj",
    },

    footer: {
      next:
        "Dalej: połącz kolumnę „Odpowiedzialny” w tabeli z tą listą i odzwierciedl kolory w Gantcie.",
    },
  },

  gantt: {
    milestone: "kamień milowy",
    weekPrefix: "tydzień",
    monthShort: {
      jan: "Sty",
      feb: "Lut",
      mar: "Mar",
      apr: "Kwi",
      may: "Maj",
      jun: "Cze",
      jul: "Lip",
      aug: "Sie",
      sep: "Wrz",
      oct: "Paź",
      nov: "Lis",
      dec: "Gru",
    },
    weekdayShort: {
      mon: "Pon.",
      tue: "Wt.",
      wed: "Śr.",
      thu: "Czw.",
      fri: "Pt.",
      sat: "Sob.",
      sun: "Nd.",
    },
  },

  tableCore: {
    summaryTitle: "Podsumowanie",
    headerInfoDemo:
      "Projekt demo • Sty 2026 • Lokalna wersja robocza (później: DB) • Widok podzielony gotowy",
    dragToMoveColumn: "Przeciągnij, aby przenieść kolumnę",
    dragToResizeColumn: "Przeciągnij, aby zmienić szerokość",
    dragToMoveRow: "Przeciągnij, aby przenieść wiersz",
    chooseDate: "Wybierz datę",
    chooseDateFor: "Wybierz datę dla",
    datePickerFor: "Selektor daty dla",
    showSubRows: "Pokaż podwiersze",
    hideSubRows: "Ukryj podwiersze",
  },

  app: {
    columns: {
      activity: "Zadanie",
      start: "Start",
      end: "Koniec",
      duration: "Czas trwania",
      dependency: "Zależność",
      wbs: "WBS",
      owner: "Odpowiedzialny",
      status: "Status",
      percentComplete: "% wykonane",
      percentRemaining: "% pozostało",
      comment: "Komentarz",
    },

    progressStatus: {
      notStarted: "Nie rozpoczęto",
      inProgress: "W toku",
      delayed: "Opóźnione",
      completed: "Zakończone",
      cancelled: "Anulowane",
    },

    demo: {
      phase1Title: "FAZA 1 – PLANOWANIE",
      defineScope: "Zdefiniuj zakres",
      stakeholderAlignment: "Uzgodnienia z interesariuszami",
      riskAssessment: "Ocena ryzyka",
      planSignOff: "Zatwierdzenie planu",
    },

    header: {
      project: "Projekt",
      customer: "Klient",
      projectStart: "Start projektu",
      fallback:
        "Projekt: Progress Demo • Klient: Example AS • Plan: v0 • Sty 2026",
    },

    split: {
      dragToResize: "Przeciągnij, aby zmienić rozmiar",
    },

    aria: {
      tableHorizontalScroll: "Poziome przewijanie tabeli",
      ganttHorizontalScroll: "Poziome przewijanie Gantta",
    },

    datePicker: {
      ariaLabel: "Selektor daty",
      prevMonthAria: "Poprzedni miesiąc",
      nextMonthAria: "Następny miesiąc",

      weekdayShort: {
        mon: "Pon",
        tue: "Wt",
        wed: "Śr",
        thu: "Czw",
        fri: "Pt",
        sat: "Sob",
        sun: "Nd",
      },

      monthFull: {
        jan: "Styczeń",
        feb: "Luty",
        mar: "Marzec",
        apr: "Kwiecień",
        may: "Maj",
        jun: "Czerwiec",
        jul: "Lipiec",
        aug: "Sierpień",
        sep: "Wrzesień",
        oct: "Październik",
        nov: "Listopad",
        dec: "Grudzień",
      },

      clear: "Wyczyść",
      clearTitle: "Wyczyść datę",
      ok: "OK",
      okTitle: "Zatwierdź",
      today: "Dziś",
      todayTitle: "Wybierz dzisiejszą datę",
    },

    durationPopover: {
      title: "Dostosuj czas trwania",
      moveStart: "Przesuń start",
      moveEnd: "Przesuń koniec",
      keepEndMoveStartTitle: "Zachowaj koniec, przesuń start",
      keepStartMoveEndTitle: "Zachowaj start, przesuń koniec",
    },

    weekendPopover: {
      title: "Wybrana data wypada w weekend. Przenieść ją na dzień roboczy?",
      prevWorkday: "Użyj poprzedniego dnia roboczego",
      nextWorkday: "Użyj następnego dnia roboczego",
      cancel: "Anuluj",
    },

    footer: {
      copyright: "© 2025 Morning Coffee Labs",
      terms: "Warunki",
      privacy: "Prywatność",
    },
  },

  printPreview: {
    topTitle: "Druk / PDF",
    paperLabel: "Papier",
    includeDeps: "Zależności",
    printBtn: "Drukuj / zapisz jako PDF",
    closeBtn: "Zamknij",

    layoutModeLabel: "Typ wydruku",
    modeFull: "Kompletny",
    modeTable: "Tylko tabela",
    modeGantt: "Tylko Gantt",

    customerLabel: "Klient:",
    projectPeriodLabel: "Okres projektu:",
    notSet: "(nie ustawiono)",
    projectNameNotSet: "Nazwa projektu (nie ustawiono)",
  },

  projectLibrary: {
    title: "Moje zapisane projekty",
    intro: "Projekty są przechowywane lokalnie w bazie przeglądarki (IndexedDB).",
    current: "Bieżący",
    refresh: "Odśwież",
    close: "Zamknij",
    loading: "Ładowanie…",
    empty: "Brak zapisanych projektów. Użyj Plik → Zapisz, aby utworzyć projekt.",
    colTitle: "Projekt",
    colUpdated: "Zaktualizowano",
    colActions: "Akcje",
    open: "Otwórz",
    duplicate: "Duplikuj",
    delete: "Usuń",
    deleteTip: "Usuwa ten projekt z lokalnej bazy danych",
    activeTip: "Aktualnie wczytany projekt",
    notFound: "Nie znaleziono projektu.",
    openConflictTitle: "Ta karta zawiera już projekt",
    openConflictText:
      "Czy chcesz nadpisać bieżący projekt w tej karcie, otworzyć projekt w nowej karcie, czy anulować?",
    cancel: "Anuluj",
    openInNewTab: "Otwórz w nowej karcie",
    overwriteCurrent: "Nadpisz bieżący",
  },
};

export default pl;
