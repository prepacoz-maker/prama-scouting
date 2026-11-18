# Checklist di sicurezza e privacy

Le misure tecniche sotto sono implementate o da completare come indicato. Basi giuridiche, informative, ruoli nel trattamento e termini di conservazione vanno definiti con i legali PRAMA: questo documento non è una consulenza legale.

## Implementato

- [x] Accesso con credenziali; password con hash bcrypt; sessione di 12 ore.
- [x] Ruolo, zona e stato dell'utente riletti dal database a ogni richiesta: una disattivazione ha effetto immediato.
- [x] Accesso per ruolo e zona su pagine, server actions e API, con test automatici.
- [x] Identità in tabella separata; codice atleta nelle viste condivise, nel report stampabile e negli export predefiniti.
- [x] Schede non approvate visibili solo all'autore e a chi le valuta; schede approvate non modificabili.
- [x] Media cifrati AES-256-GCM, senza URL pubblico, serviti solo a utenti autorizzati.
- [x] Upload solo con consenso valido dei genitori/tutori per quel tipo di contenuto, tipi di file ammessi e limite di dimensione.
- [x] Registro di accessi, visualizzazioni di profili e media, modifiche, upload, export; nessun nome o testo libero nel registro.
- [x] Blocco dei testi con termini sanitari o familiari riservati nei campi liberi (filtro di base, non sostituisce la formazione).
- [x] Scadenza di revisione per ogni profilo, elenco dei profili scaduti, anonimizzazione e cancellazione su richiesta.
- [x] Avvisi di divieto di condivisione; controlli di download e menu contestuale disattivati sull'anteprima (deterrente, non una protezione assoluta).
- [x] Intestazioni HTTP di sicurezza e divieto di indicizzazione.
- [x] Export CSV protetto da formule malevole.

## Da completare prima dell'uso con dati reali

- [ ] Limite ai tentativi di accesso e blocco temporaneo dell'account.
- [ ] Verifica in due passaggi per referenti e admin.
- [ ] Procedura di cambio e recupero della password (oggi la imposta l'admin).
- [ ] Cifratura del database a riposo e backup cifrati, con prova di ripristino.
- [ ] Custodia della chiave dei media in un gestore di segreti e procedura di rotazione.
- [ ] Driver di archiviazione S3 privato in regione UE, se l'hosting non ha disco persistente.
- [ ] Filigrana con nome utente e data sull'anteprima dei video.
- [ ] Promemoria automatico dei profili in scadenza di revisione.
- [ ] Test di sicurezza indipendente.

## Da definire con i legali PRAMA

- [ ] Titolare del trattamento e ruolo di scout e referenti.
- [ ] Base giuridica e informativa per i dati di minori osservati prima di ogni contatto con la famiglia.
- [ ] Testi dei consensi per foto, video e dati; modalità di raccolta e revoca.
- [ ] Termini di conservazione (valore predefinito nell'app: 12 mesi dall'ultima osservazione).
- [ ] Registro dei trattamenti, valutazione d'impatto e accordi con i fornitori.
- [ ] Impegno di riservatezza per scout e referenti.

## Regole d'uso

1. Un account per persona, mai condiviso.
2. Nessuno screenshot, download o inoltro di schede, card e video.
3. Nessuna pubblicazione su social o chat.
4. Smarrimento del telefono o accesso sospetto: avvisare subito un admin, che disattiva l'utente.
5. Fine della collaborazione: disattivazione dell'utente nello stesso giorno.
