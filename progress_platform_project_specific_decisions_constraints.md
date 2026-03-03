# Progress Platform – Project-Specific Decisions & Constraints

Dette dokumentet er et **prosjekt‑spesifikt tillegg** til hoved‑instruksen (Project Instructions).  
Det inneholder **kun beslutninger, avklaringer og føringer** som er gjort eksplisitt i denne tråden, og som er nødvendige for at løsningen bygges riktig.

Dokumentet skal ligge **sammen med repo‑filene**, og brukes som referanse under videre utvikling.

---

## 1. Overordnet status (låst)

- Progress‑appen er renset og bygger grønt.
- Alle tidligere koblinger til Firestore, Worker og Stripe er fjernet eller stubbet.
- Stripe‑kontoen eksisterer og beholdes, men **ryddes slik at kun Progress er produkt**.
- Cloudflare Worker og Firestore bygges **helt på nytt**.
- Dette prosjektet handler **kun** om å bygge ny kjerne (auth / db / lisens / betaling / admin), ikke om UI‑polering eller nye app‑features.

---

## 2. Produkter og domener

### 2.1 Produkter

- Det finnes **kun ett produkt** i denne løsningen:
  - `progress`
- Alle referanser til tidligere eller fremtidige apper er eksplisitt fjernet.

### 2.2 Domener / nettsider

- **Morning Coffee Labs**
  - Brand‑side
  - Skal kun lenke videre til Progress

- **Progress / ManageSystem**
  - Egen nettside
  - Produktpresentasjon
  - Kjøp av lisens
  - Aktivering
  - Admin‑grensesnitt

- Design, layout og komponent‑struktur kan gjenbrukes mellom sidene for enhetlig uttrykk, men kodebasene er separate.

---

## 3. Gratisbruk, trial og betaling (låst brukeropplevelse)

### 3.1 Free‑modus

- Free‑brukere:
  - Skal **ikke** registrere seg
  - Skal **ikke** logge inn
  - Kan bruke appen lokalt
- Ingen backend‑tilkobling i free‑modus

### 3.2 Trial (10 dager)

- Trial startes **direkte i appen**
- Bruker må registrere:
  - e‑post
  - passord
- Trial gis **én gang per e‑post**
- Trial gir full Pro‑tilgang i 10 dager

#### Etter trial‑utløp

- Pro‑tilgang deaktiveres
- Alle prosjekter arkiveres
- Arkiverte prosjekter beholdes i **90 dager**

#### Reaktivering

- Dersom bruker kjøper Pro‑lisens med **samme e‑post** innen 90 dager:
  - Prosjektene gjenopprettes automatisk
- Etter 90 dager slettes arkiverte prosjekter permanent

### 3.3 Betalt lisens

- Kjøp skjer **kun via nettsiden**
- Betaling via Stripe
- Appen håndterer aldri Stripe direkte

---

## 4. Organisasjoner (org) – praktisk modell

### 4.1 Grunnregel

- **Alle brukere som er trial eller Pro tilhører alltid en org**
- Org opprettes automatisk ved:
  - trial‑registrering
  - kjøp

### 4.2 Org‑nummer

- Org.nr er **valgfritt**
- Dersom org.nr finnes:
  - ett org.nr = én org hos oss
- Dersom org.nr ikke finnes:
  - brukeren får en "intern / personlig org"

Dette gjelder også privatpersoner og enkeltpersonforetak.

### 4.3 Avdelinger og hierarki

- Avdelinger og hierarki er **ikke en del av v1**
- Datastrukturen skal tillate senere utvidelse

---

## 5. Roller og eierskap

### 5.1 Roller (v1)

- `admin`
- `member`

### 5.2 Admin (produkt‑eier)

Admin (Tony) skal kunne:

- Se:
  - antall aktive trials
  - antall betalte lisenser
  - kundeinformasjon (trial + paid)
- Opprette:
  - organisasjoner
  - manuelle lisenser (uten Stripe)
- Feilsøke via admin/dev‑panel

---

## 6. Dev‑panel (internt verktøy – låst krav)

Det skal eksistere et **internt dev‑panel** (kun for eier / utvikling), som viser:

- Innloggingsstatus
- Bruker‑ID og e‑post
- Org‑ID (og evt. org.nr)
- Planstatus:
  - free / trial / pro
- Utløpsdato
- Sist verifisert tidspunkt

Dev‑panelet brukes aktivt under utvikling for å hindre skjulte feil i auth / lisens / org‑kobling.

---

## 7. Backend – sannhet og ansvar

### 7.1 Sannhetskilde

- Firestore er **source of truth** for:
  - lisensstatus
  - org‑tilknytning

### 7.2 Cloudflare Worker

- Worker er **eneste** komponent som:
  - snakker med Stripe
  - oppdaterer lisensstatus i Firestore

### 7.3 Appen

- Appen:
  - leser status
  - cacher status
  - styrer UI
- Appen tar **ingen beslutninger** om betaling eller lisens

---

## 8. Admin uten Stripe (manuell lisens)

- Admin skal kunne:
  - opprette org
  - opprette lisens manuelt
  - tildele lisens til org
- Fakturering skjer utenfor systemet
- Lisens registreres i Firestore med `source = manual`

---

## 9. Arbeidsmetode – ekstra presisering

- Bygging skjer **lagvis**:
  1. Auth + org bootstrap
  2. Trial
  3. Verify
  4. Stripe kjøp
  5. DB‑lagring

- Kun ett lag jobbes med om gangen
- Ingen UI‑utvidelser før kjernen fungerer

---

## 10. Viktig intensjon (for fremtidige avgjørelser)

Systemet skal:

- Føles enkelt og rettferdig for små aktører og enkeltpersonforetak
- Samtidig være teknisk i stand til å støtte:
  - teamledere
  - avdelinger
  - bedriftsledelse
  - fremtidig kapasitets‑ og belastningsanalyse

Dette dokumentet skal brukes som **rettesnor** dersom valg må tas underveis.

---

**Dette dokumentet er prosjekt‑spesifikt og gjelder kun Progress Platform.**

