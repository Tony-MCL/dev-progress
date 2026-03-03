!!App Shell – Core Readme
AppShell (Morning Coffee Labs)

AppShell er et felles, gjenbrukbart applikasjonsskall for MCL‑apper. Det eier layout, scroll‑kontrakter og grunnleggende UI‑struktur, slik at hver enkelt app kan fokusere på domenelogikk (Progress, Documents, osv.) uten å løse de samme problemene på nytt.

Dette dokumentet er ment som én sannhet for hvordan AppShell brukes og videreutvikles i prosjekter.

🎯 Mål og prinsipper

AppShell skal:

Gi forutsigbar layout (header / toolbar / footer)

Eie vertikal scroll og høydekontrakter

Støtte både single‑view og split‑view

Være stabil over tid (ingen app‑spesifikk logikk)

AppShell skal ikke:

Inneholde domenelogikk (Progress, Gantt, dokumenter osv.)

Ha kunnskap om semantikk i tabeller

Løse problemer som hører hjemme i adapter‑/domain‑lag

Tommelfingerregel: Hvis noe er app‑spesifikt, hører det ikke hjemme i AppShell.

🧱 Overordnet struktur
AppShell
├─ Header        (fast)
├─ Toolbar       (fast / valgfri)
├─ Main
│  └─ Viewport   (eier høyde + scroll‑kontrakt)
│     └─ Section/Card (innhold)
├─ HelpPanel     (overlay)
└─ Footer        (fast)

Header, Toolbar og Footer står stille

All vertikal scrolling skjer inne i viewport / scrollhost

Innhold legges alltid i app-section (kort)

📜 Scroll‑modellen (kritisk)

AppShell støtter to eksplisitte scroll‑modi:

1️⃣ Single‑view (standard)

Én hovedkomponent (f.eks. TableCore)

Komponenten scroller selv vertikalt

AppShell gir kun høyde‑kontrakt

Brukes når:

Appen kun har én hovedflate

Ingen behov for synkronisering med andre views

2️⃣ Split‑view (klar, men ikke påslått som standard)

To eller flere views side‑om‑side (f.eks. Table + Gantt)

Felles vertikal scroll eid av AppShell

Hvert panel har egen horisontal scroll

Brukes når:

Flere views må være vertikalt synkronisert

Rad‑høyder / rekkefølge må samsvare

Viktig: AppShell er nå split‑view‑ready, men aktivering skjer per app.

📐 CSS‑kontrakter (må respekteres)

Noen CSS‑regler er arkitektoniske, ikke kosmetiske:

html, body { overflow: hidden; }

min-height: 0 på alle flex‑barn i høydekjeder

Scroll skjer kun der det er eksplisitt definert

Eksempel:

app-main → ingen scroll

app-viewport-scroll → eier scroll i shared‑modus

tc-wrap → eier scroll i single‑view

Å bryte disse vil gi:

manglende scrollbar

“ghost scroll”

hvite skjermer i StrictMode

🧩 TableCore i AppShell

TableCore er et rent, generisk grid og forholder seg til AppShell via kontrakter:

Tar høyde fra forelder

Scroller kun når den får lov

Ingen antakelser om layout utenfor seg selv

AppShell bestemmer:

om TableCore scroller selv

eller deltar i felles vertikal scroll

Dette gjør at samme TableCore kan brukes i:

Formelsamling

Progress

Fremtidige admin‑/dataverktøy

🧠 Adapter‑lag (viktig for Progress)

Når AppShell + TableCore brukes i mer avanserte apper:

➡️ legg et adapter/domain‑lag imellom (f.eks. ProgressCore)

Adapter‑laget skal:

oversette domene → rader/kolonner

eie derived data (Gantt, summer, hierarki)

samle kommandoer (addRow, move, indent)

Dette holder:

AppShell ren

TableCore stabil

domenelogikk samlet

🧪 Arbeidsform i AppShell‑prosjekter

Når du jobber videre på AppShell:

Start alltid fra grønn build

Én endringstype per iterasjon

Lever hele filer, ikke snippets

Ingen DOM‑query for kritisk flyt

Tenk alltid: kan dette begrense fremtidig bruk?

Små forbedringer (UX, hit‑areas, spacing) er ønsket – men kun når de ikke bryter kontrakter.

✅ Status per i dag

AppShell: stabil og fremtidsklar

Scroll‑modell: avklart og robust

TableCore‑integrasjon: moden

Split‑view: klar til bruk per app

Neste naturlige steg: ➡️ starte Progress på toppen av dette fundamentet.

© 2025 – Morning Coffee Labs
