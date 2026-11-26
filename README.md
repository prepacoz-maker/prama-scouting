# PRAMA Scouting

Archivio digitale di scouting di PRAMA Talent Management: profili atleta, schede di osservazione, Player Card, follow-up, media protetti e registro delle attività. Applicazione riservata, in italiano, pensata per l'uso da smartphone sul campo.

> Versione 0.1 (prototipo funzionante). I dati del seed sono **fittizi**. Prima dell'uso con dati reali vanno completati i punti della [checklist di sicurezza e privacy](docs/SICUREZZA-PRIVACY.md).

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Prisma + PostgreSQL · NextAuth (credenziali, sessione JWT) · Zod · React Hook Form · Recharts · Vitest.

## Avvio locale

Requisiti: Node.js 20 o superiore, PostgreSQL 14 o superiore.

```bash
npm install
cp .env.example .env          # poi compilare i valori (vedi sotto)
npx prisma db push            # crea le tabelle
npm run db:seed               # carica i dati di esempio fittizi
npm run dev                   # http://localhost:3000
```

Utenti del seed (password: valore di `SEED_PASSWORD`, predefinita `Prama-demo-2026`):

| Ruolo | Email |
|---|---|
| Admin PRAMA | `admin@prama.test` |
| Referente di zona Z01 | `referente.z01@prama.test` |
| Scout Z01 (abilitato ai media) | `scout1@prama.test` |
| Scout Z01 | `scout2@prama.test` |
| Scout Z06 | `scout3@prama.test` |

## Variabili d'ambiente

| Variabile | Descrizione |
|---|---|
| `DATABASE_URL` | Connessione PostgreSQL |
| `NEXTAUTH_SECRET` | Segreto delle sessioni: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | URL pubblico dell'app |
| `MEDIA_DIR` | Cartella dei media cifrati (fuori dalla cartella pubblica) |
| `MEDIA_ENCRYPTION_KEY` | Chiave AES-256, 32 byte in base64: `openssl rand -base64 32`. Se si perde, i media non sono più leggibili |
| `MEDIA_MAX_MB` | Dimensione massima di un file (predefinita 200) |
| `SEED_PASSWORD` | Password degli utenti di esempio (solo sviluppo) |

## Comandi

| Comando | Che cosa fa |
|---|---|
| `npm run dev` | Sviluppo |
| `npm run build` / `npm start` | Build e avvio in produzione |
| `npm test` | Test (calcolo overall e potenziale, permessi, validazione) |
| `npm run typecheck` / `npm run lint` | Controlli statici |
| `npm run db:push` / `npm run db:seed` | Schema e dati di esempio |

## Struttura delle cartelle

```
prisma/
  schema.prisma          modello dati
  seed.ts                dati di esempio fittizi
src/
  app/
    login/               accesso
    (app)/               area riservata (layout con navigazione)
      page.tsx           dashboard
      atleti/            archivio, nuovo profilo, profilo, Player Card stampabile
      osservazioni/      nuova scheda, dettaglio e valutazione, modifica
      follow-up/         scadenze e storico
      impostazioni/      zone, utenti, pesi, privacy, export, log (admin)
    actions/             server actions (atleti, osservazioni, follow-up, media, admin)
    api/                 auth, upload e streaming dei media, export CSV
  components/            AthleteCard, AttributeBar, RadarChart, ObservationForm, DataTable, ...
  lib/
    rating.ts            overall, potenziale, affidabilità, badge (funzioni pure)
    permissions.ts       regole di accesso per ruolo e zona (funzioni pure)
    validation.ts        schemi Zod, usati su client e server
    recompute.ts         aggiornamento della Player Card dopo ogni approvazione
    athlete-view.ts      dati della card, già filtrati per permessi
    storage.ts           media cifrati AES-256-GCM
    audit.ts             registro delle attività
tests/                   Vitest
docs/                    architettura, deploy, guida rapida, sicurezza e privacy
```

## Documentazione

- [Architettura, modello dati e calcoli](docs/ARCHITETTURA.md)
- [Deploy](docs/DEPLOY.md)
- [Guida rapida per scout e referenti](docs/GUIDA-RAPIDA.md)
- [Checklist di sicurezza e privacy](docs/SICUREZZA-PRIVACY.md)

## Match analysis (v1, solo admin)

Area **Match analysis** (menu laterale, solo ruolo Admin): analisi video delle partite con pannello di codifica a pulsanti (calcio: giocatore di movimento e portiere), tasti rapidi, timeline, giudizio della sequenza (ECCELLENTE / BUONO / DA MIGLIORARE / CRITICO + confidenza), disegni sul fermo immagine, playlist, statistiche dai tag, report dal template PRAMA ed export CSV.

- **Il video non viene caricato.** Si apre un file dal proprio computer (riprodotto nel browser) oppure un link (YouTube o file video online). Nel database si salvano solo episodi, tempi, disegni e note.
- Per aprire un'analisi su un atleta serve un **consenso VIDEO valido**; per ogni analisi l'analista conferma diritti sul video e consensi.
- Gli scout non hanno accesso. Ogni apertura, modifica ed export è nel registro attività.
- Scorciatoie: Spazio o K play/pausa, J/L ±5 s, virgola/punto ±1 fotogramma, lettere e cifre per i pulsanti.
- Logica pura e test: `src/lib/match.ts`, `tests/match.test.ts`.
