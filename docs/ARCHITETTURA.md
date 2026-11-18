# Architettura, modello dati e calcoli

## Principi

1. **Tutto sul server.** Pagine e dati sono resi da Server Components; le modifiche passano da server actions. Il browser riceve solo ciò che l'utente può vedere.
2. **Permessi in un solo punto.** `src/lib/permissions.ts` contiene funzioni pure (`can`, `canViewAthlete`, `canSeeIdentity`, `canEditObservation`, ...) e i filtri Prisma per zona. Ogni pagina, action e route le usa.
3. **Calcoli trasparenti.** `src/lib/rating.ts` non accede al database: ogni numero della Player Card è riproducibile e coperto da test.
4. **Identità separata dalle valutazioni.** Nome e cognome stanno in `AthleteIdentity`; tutto il resto usa il codice atleta.

## Ruoli

| | Scout | Referente di zona | Admin PRAMA |
|---|---|---|---|
| Atleti visibili | Propria zona e assegnati | Propria zona | Tutti |
| Nome e cognome | Solo profili creati o assegnati | Propria zona | Tutti |
| Schede | Crea e modifica le proprie finché non inviate | Valuta quelle della zona | Tutto |
| Schede approvate | Non modificabili | Non modificabili | Non modificabili |
| Stato, follow-up, consensi | No | Sì (zona) | Sì |
| Media | Solo se abilitato e con consenso valido | Sì, con consenso valido | Sì, con consenso valido |
| Export, impostazioni, log, anonimizzazione | No | No | Sì |

Regole aggiuntive: lo stato «Molto interessante» e i follow-up di tipo «Colloquio» sono riservati agli admin; nessuno approva una scheda scritta da sé (tranne l'admin).

## Modello dati (Prisma)

| Modello | Contenuto |
|---|---|
| `User`, `Scout` | Utenti, ruolo, zona; abilitazioni dello scout (media, formazione, riservatezza) |
| `Zone` | Zone PRAMA (codice `Z01`, ...) |
| `RolePermission` | Permessi per ruolo, popolati dal seed. In v0.1 la fonte autorevole è `permissions.ts` |
| `Athlete` | Dati sportivi, stato, interesse, valori calcolati della card, scadenza di revisione |
| `AthleteIdentity` | Nome e cognome, in tabella separata |
| `Observation` | Scheda: evento, 15 attributi (1-5, `null` = non valutabile), sintesi, stato di valutazione |
| `Media` | File cifrati, tag, azioni chiave con minutaggio |
| `Consent` | Consensi di genitori/tutori per foto, video, dati |
| `FollowUp` | Controlli pianificati, scadenze, esiti |
| `Badge`, `AthleteBadge` | Badge e loro assegnazione automatica |
| `MetricWeight` | Pesi degli attributi per reparto |
| `Setting` | Parametri (mesi di conservazione) |
| `AuditLog` | Accessi, modifiche, upload, visualizzazioni, export |

## Stati

- **Scheda:** Bozza → Da valutare → Approvata, oppure Integrazione richiesta → Da valutare.
- **Atleta:** Da valutare, In osservazione, Nuovo controllo richiesto, Video richiesto, In follow-up, Interessante, Molto interessante, Non idoneo al momento, Archiviato, Duplicato.
- **Etichetta sulla card:** Alta priorità (Molto interessante) · Interessante · Da seguire (follow-up, nuovo controllo, video) · In osservazione.

L'etichetta «Non idoneo al momento» si cambia in una riga in `src/lib/labels.ts`.

## Overall PRAMA

1. Per ogni attributo si calcola la media delle **ultime 5 schede approvate** (i «non valutabili» sono ignorati).
2. Si calcola la media ponderata con i pesi del reparto (portiere, difensore, centrocampista, attaccante), configurabili dall'admin. Gli attributi senza voto sono esclusi e i pesi rinormalizzati.
3. La media 1-5 è riportata sulla scala 40-99: `40 + (media − 1) / 4 × 59`. Un atleta «in linea con la categoria» (3) vale 70.
4. Servono almeno 8 attributi valutati su 15; altrimenti l'overall non viene mostrato.

L'overall è **relativo alla categoria osservata**: non confronta atleti di categorie diverse.

## Potenziale PRAMA

Stima prudente, espressa come **intervallo** e mostrata solo da due schede approvate in poi.

- parte dall'overall;
- aggiunge fino a 6 punti in base agli attributi che sostengono l'apprendimento (decision-making, intelligenza tattica, mentalità, reazione agli errori, coordinazione);
- aggiunge fino a 3 punti se l'overall è cresciuto tra la prima e l'ultima scheda;
- margine totale massimo 8 punti; l'estremo superiore non supera overall + 10 né 95;
- ampiezza ±2 con affidabilità alta, ±3 negli altri casi.

Non è una previsione di carriera e non va comunicato ad atleti o famiglie.

## Affidabilità e nuovo controllo

- **Affidabilità:** bassa con 1 scheda approvata, media con 2-3, alta da 4; scende di un livello se l'ultima osservazione ha più di 180 giorni.
- **Serve un nuovo controllo** se l'affidabilità è bassa, se l'ultima osservazione ha più di 90 giorni o se la scadenza pianificata è passata.

## Badge

Assegnati in automatico da due schede approvate, con soglie esplicite in `computeBadges`: Visione di gioco, Esplosività, Affidabilità, Leadership, Tecnica pulita, Miglioramento rapido.

## Scelte tecniche rispetto alla richiesta

| Richiesta | Scelta | Motivo |
|---|---|---|
| NextAuth o Auth.js | NextAuth v4 con credenziali | Stabile con App Router; Auth.js v5 era ancora in beta |
| Vercel Blob, Cloudinary o S3 | File cifrati su disco, serviti da route autenticata | Nessun URL pubblico per video di minori. Per hosting senza disco va aggiunto un driver S3 (vedi DEPLOY) |
| Export PDF | Pagina «Report stampabile» + stampa del browser | Nessuna libreria aggiuntiva, resa identica alla card |
| PWA | Manifest, icona, layout mobile, bozza salvata sul dispositivo | Il funzionamento offline completo è nel piano futuro |
