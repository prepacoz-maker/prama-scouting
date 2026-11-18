# Deploy

L'app tratta dati di minori: scegliere fornitori con **dati nell'Unione Europea** e accordo sul trattamento dei dati. La scelta va validata dai legali PRAMA.

## Opzione consigliata: server con disco persistente

Adatta alla versione attuale, che salva i media cifrati su disco. Esempi: un VPS europeo oppure un servizio container con volume persistente.

1. PostgreSQL gestito in regione UE, con connessione TLS e backup automatici.
2. Variabili d'ambiente come da README (`NEXTAUTH_URL` con il dominio definitivo, in HTTPS).
3. `MEDIA_DIR` su un volume persistente, fuori dalla cartella pubblica, incluso nei backup.
4. Build e avvio:
   ```bash
   npm ci
   npx prisma migrate deploy   # oppure `npx prisma db push` al primo avvio
   npm run build
   npm start
   ```
5. Proxy HTTPS davanti all'app, con limite di dimensione delle richieste coerente con `MEDIA_MAX_MB`.
6. Creare il primo admin e **non** eseguire il seed in produzione.

## Opzione Vercel

Vercel non ha disco persistente e limita la dimensione delle richieste: prima del deploy va aggiunto un driver di archiviazione S3 compatibile (bucket privato in regione UE, URL firmati a scadenza breve, upload diretto dal browser). L'interfaccia `StorageDriver` in `src/lib/storage.ts` è il punto di estensione. Database: PostgreSQL serverless in regione UE.

## Prima dell'uso con dati reali

- Passare da `prisma db push` alle migrazioni (`prisma migrate dev` in sviluppo, `migrate deploy` in produzione).
- Completare la [checklist di sicurezza e privacy](SICUREZZA-PRIVACY.md).
- Verificare ripristino dei backup e conservazione sicura di `MEDIA_ENCRYPTION_KEY`.
