// Build per ambienti ospitati (es. Vercel).
// 1. genera il client Prisma; 2. allinea lo schema del database;
// 3. solo se SEED_ON_BUILD=1 carica i dati FITTIZI, e solo su database vuoto; 4. build Next.js.
import { execSync } from "node:child_process";

const run = (cmd, env = {}) => execSync(cmd, { stdio: "inherit", env: { ...process.env, ...env } });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL mancante: collegare un database PostgreSQL al progetto.");
  process.exit(1);
}
// Per le modifiche di schema si usa la connessione diretta, se disponibile (es. Neon).
const direct = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;

run("npx prisma generate");
run("npx prisma db push --skip-generate", { DATABASE_URL: direct });
if (process.env.SEED_ON_BUILD === "1") {
  run("npx tsx prisma/seed.ts", { DATABASE_URL: direct, SEED_ONLY_IF_EMPTY: "1" });
}
run("npx next build");
