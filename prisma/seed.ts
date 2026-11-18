// Dati di esempio FITTIZI: nessuna persona, squadra o atleta reale.
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { BADGES, DEFAULT_WEIGHTS, ATTRIBUTES } from "../src/lib/rating";
import { PERMISSIONS } from "../src/lib/permissions";
import { recomputeAll } from "../src/lib/recompute";

const db = new PrismaClient();
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const daysAhead = (n: number) => new Date(Date.now() + n * 86_400_000);

// Ordine dei voti: come ATTRIBUTES. null = non valutabile.
const ratings = (values: (number | null)[]) => Object.fromEntries(ATTRIBUTES.map((a, i) => [a, values[i]]));

async function main() {
  await db.$transaction([
    db.auditLog.deleteMany(), db.athleteBadge.deleteMany(), db.badge.deleteMany(), db.media.deleteMany(), db.consent.deleteMany(),
    db.followUp.deleteMany(), db.observation.deleteMany(), db.athleteIdentity.deleteMany(), db.athlete.deleteMany(), db.scout.deleteMany(),
    db.user.deleteMany(), db.zone.deleteMany(), db.metricWeight.deleteMany(), db.rolePermission.deleteMany(), db.setting.deleteMany(),
  ]);

  const passwordHash = await bcrypt.hash(process.env.SEED_PASSWORD ?? "Prama-demo-2026", 12);

  const [z1, z6, z8] = await Promise.all([
    db.zone.create({ data: { code: "Z01", name: "Cagliari e hinterland" } }),
    db.zone.create({ data: { code: "Z06", name: "Porto Torres e Sorso" } }),
    db.zone.create({ data: { code: "Z08", name: "Olbia e Gallura" } }),
  ]);

  const admin = await db.user.create({ data: { email: "admin@prama.test", name: "Admin Demo", role: "ADMIN", passwordHash } });
  const referente = await db.user.create({ data: { email: "referente.z01@prama.test", name: "Referente Demo Z01", role: "REFERENTE", zoneId: z1.id, passwordHash } });
  const scout1 = await db.user.create({ data: { email: "scout1@prama.test", name: "Scout Demo Uno", role: "SCOUT", zoneId: z1.id, passwordHash, scout: { create: { canUploadMedia: true, trainedAt: daysAgo(40), ndaSignedAt: daysAgo(40) } } } });
  const scout2 = await db.user.create({ data: { email: "scout2@prama.test", name: "Scout Demo Due", role: "SCOUT", zoneId: z1.id, passwordHash, scout: { create: { trainedAt: daysAgo(30), ndaSignedAt: daysAgo(30) } } } });
  const scout3 = await db.user.create({ data: { email: "scout3@prama.test", name: "Scout Demo Tre", role: "SCOUT", zoneId: z6.id, passwordHash, scout: { create: { trainedAt: daysAgo(20), ndaSignedAt: daysAgo(20) } } } });

  await db.setting.create({ data: { key: "retentionMonths", value: "12" } });
  await db.badge.createMany({ data: Object.entries(BADGES).map(([key, b]) => ({ key, label: b.label, description: b.description })) });
  await db.metricWeight.createMany({
    data: Object.entries(DEFAULT_WEIGHTS).flatMap(([roleGroup, weights]) =>
      Object.entries(weights).map(([attribute, weight]) => ({ roleGroup: roleGroup as Prisma.MetricWeightCreateManyInput["roleGroup"], attribute, weight })),
    ),
  });
  await db.rolePermission.createMany({
    data: Object.entries(PERMISSIONS).flatMap(([permission, roles]) => roles.map((role) => ({ role, permission }))),
  });

  const athlete = (data: Omit<Prisma.AthleteUncheckedCreateInput, "createdById"> & { first: string; last: string; createdById: string }) => {
    const { first, last, ...rest } = data;
    return db.athlete.create({ data: { ...rest, reviewDueAt: daysAhead(365), identity: { create: { firstName: first, lastName: last } } } });
  };

  const a1 = await athlete({ code: "A-Z01-0001", zoneId: z1.id, first: "Esempio", last: "Uno", birthYear: 2011, roleGroup: "ATTACCANTE", primaryRole: "Esterno offensivo", secondaryRoles: ["Seconda punta"], team: "ASD Demo Levante", category: "U15", foot: "DESTRO", status: "INTERESSANTE", interest: "ALTO", createdById: scout1.id, assignedScoutId: scout1.id });
  const a2 = await athlete({ code: "A-Z01-0002", zoneId: z1.id, first: "Esempio", last: "Due", birthYear: 2010, roleGroup: "CENTROCAMPISTA", primaryRole: "Centrocampista centrale", secondaryRoles: ["Mezzala"], team: "Pol. Demo Maestrale", category: "U16", foot: "SINISTRO", heightCm: 172, status: "IN_FOLLOW_UP", interest: "MEDIO", createdById: scout2.id, assignedScoutId: scout2.id });
  const a3 = await athlete({ code: "A-Z01-0003", zoneId: z1.id, first: "Esempio", last: "Tre", birthYear: 2012, roleGroup: "DIFENSORE", primaryRole: "Difensore centrale", team: "ASD Demo Levante", category: "U14", foot: "DESTRO", status: "DA_VALUTARE", createdById: scout1.id, assignedScoutId: scout1.id });
  const a4 = await athlete({ code: "A-Z06-0001", zoneId: z6.id, first: "Esempio", last: "Quattro", birthYear: 2009, roleGroup: "PORTIERE", primaryRole: "Portiere", team: "US Demo Tramontana", category: "U17", foot: "DESTRO", heightCm: 184, status: "NUOVO_CONTROLLO_RICHIESTO", interest: "MEDIO", createdById: scout3.id, assignedScoutId: scout3.id });
  const a5 = await athlete({ code: "A-Z08-0001", zoneId: z8.id, first: "Esempio", last: "Cinque", birthYear: 2011, roleGroup: "CENTROCAMPISTA", primaryRole: "Trequartista", secondaryRoles: ["Esterno offensivo"], team: "SSD Demo Grecale", category: "U15", foot: "ENTRAMBI", status: "IN_OSSERVAZIONE", interest: "MEDIO", createdById: admin.id });

  type Obs = Omit<Prisma.ObservationUncheckedCreateInput, "zoneId">;
  const approved = { reviewStatus: "APPROVATA" as const, reviewedById: referente.id };
  const observations: (Obs & { zoneId: string })[] = [
    // A1: quattro osservazioni approvate, in crescita
    { athleteId: a1.id, zoneId: z1.id, scoutId: scout1.id, date: daysAgo(120), eventType: "PARTITA", team: a1.team, opponent: "Demo Scirocco", category: "U15", competition: "Campionato regionale", venue: "Campo comunale (demo)", minutes: 70, maturation: "TARDIVA", ...ratings([3, 3, 4, 3, 4, 3, 3, 4, 3, 3, 3, 3, 3, 4, 3]), strengths: "Primo controllo orientato\nUno contro uno in spazi stretti", improvements: "Continuità senza palla\nDuelli fisici", interest: "MEDIO", action: "NUOVO_CONTROLLO", ...approved, reviewedAt: daysAgo(117) },
    { athleteId: a1.id, zoneId: z1.id, scoutId: scout2.id, date: daysAgo(85), eventType: "ALLENAMENTO", team: a1.team, category: "U15", venue: "Centro sportivo (demo)", minutes: 60, maturation: "TARDIVA", ...ratings([4, 3, 4, 3, 4, 3, 3, 4, 4, 3, 4, 3, 4, 4, 3]), strengths: "Applica subito le correzioni\nUsa entrambi i piedi", improvements: "Scelta dell'ultimo passaggio", interest: "ALTO", action: "FOLLOW_UP", ...approved, reviewedAt: daysAgo(83) },
    { athleteId: a1.id, zoneId: z1.id, scoutId: scout1.id, date: daysAgo(40), eventType: "PARTITA", team: a1.team, opponent: "Demo Ponente", category: "U15", competition: "Campionato regionale", minutes: 80, maturation: "TARDIVA", ...ratings([4, 4, 4, 4, 5, 4, 3, 4, 4, 4, 4, 4, 4, 4, 4]), strengths: "Tempi di smarcamento\nDribbling efficace nei 16 metri\nReazione dopo la palla persa", improvements: "Resistenza nel finale", interest: "ALTO", action: "FOLLOW_UP", ...approved, reviewedAt: daysAgo(38) },
    { athleteId: a1.id, zoneId: z1.id, scoutId: scout1.id, date: daysAgo(9), eventType: "TORNEO", team: a1.team, opponent: "Demo Libeccio", category: "U15", competition: "Torneo giovanile (demo)", minutes: 50, maturation: "IN_LINEA", ...ratings([4, 4, 5, 4, 5, 4, 4, 4, 4, 4, 5, 4, 5, 4, 4]), strengths: "Decisioni rapide sotto pressione\nControllo in velocità", improvements: "Gioco aereo", interest: "ALTO", action: "FOLLOW_UP", nextCheckSuggested: daysAhead(21), ...approved, reviewedAt: daysAgo(7) },
    // A2: due approvate, una in attesa
    { athleteId: a2.id, zoneId: z1.id, scoutId: scout2.id, date: daysAgo(60), eventType: "PARTITA", team: a2.team, opponent: "Demo Scirocco", category: "U16", minutes: 75, maturation: "IN_LINEA", ...ratings([4, 4, 4, 2, 3, 3, 4, 3, 4, 4, 4, 5, 4, 5, 3]), strengths: "Ordine nel gioco corto\nComunicazione con i compagni", improvements: "Conclusione da fuori\nCambio di passo", interest: "MEDIO", action: "FOLLOW_UP", ...approved, reviewedAt: daysAgo(57) },
    { athleteId: a2.id, zoneId: z1.id, scoutId: scout1.id, date: daysAgo(25), eventType: "VIDEO", team: a2.team, opponent: "Demo Ponente", category: "U16", minutes: 45, maturation: "IN_LINEA", ...ratings([4, 5, 4, null, 3, 3, 4, 3, 5, 4, 4, 5, 4, 5, 4]), strengths: "Visione sul lato debole\nDisponibilità al lavoro difensivo", improvements: "Velocità sul breve", interest: "MEDIO", action: "FOLLOW_UP", ...approved, reviewedAt: daysAgo(23) },
    { athleteId: a2.id, zoneId: z1.id, scoutId: scout2.id, date: daysAgo(3), eventType: "PARTITA", team: a2.team, opponent: "Demo Libeccio", category: "U16", minutes: 80, maturation: "IN_LINEA", ...ratings([4, 5, 4, 3, 3, 3, 4, 4, 5, 4, 5, 5, 4, 5, 4]), strengths: "Gestione dei tempi di gioco\nLeadership nei momenti difficili", improvements: "Finalizzazione", interest: "ALTO", action: "COLLOQUIO", reviewStatus: "DA_VALUTARE" },
    // A3: prima scheda, da valutare
    { athleteId: a3.id, zoneId: z1.id, scoutId: scout1.id, date: daysAgo(2), eventType: "PARTITA", team: a3.team, opponent: "Demo Maestrale", category: "U14", minutes: 60, maturation: "PRECOCE", ...ratings([3, 3, 3, null, 2, 4, 4, 3, 3, 4, 3, 4, 4, 4, 3]), strengths: "Posizionamento sulla linea\nImpegno costante", improvements: "Uscita palla al piede sotto pressione", notes: "Fisicamente avanti rispetto ai compagni: da rivedere contro avversari di pari sviluppo.", interest: "MEDIO", action: "NUOVO_CONTROLLO", reviewStatus: "DA_VALUTARE" },
    // A4: una approvata
    { athleteId: a4.id, zoneId: z6.id, scoutId: scout3.id, date: daysAgo(30), eventType: "PARTITA", team: a4.team, opponent: "Demo Grecale", category: "U17", minutes: 90, maturation: "IN_LINEA", ...ratings([3, 3, 4, null, null, 3, 3, 4, 4, 4, 4, 4, 4, 4, 3]), strengths: "Letture sulle uscite alte\nGuida della linea difensiva", improvements: "Gioco con i piedi\nReazione dopo l'errore", interest: "MEDIO", action: "NUOVO_CONTROLLO", reviewStatus: "APPROVATA", reviewedById: admin.id, reviewedAt: daysAgo(28) },
    // A5: una approvata (osservazione dell'admin in una zona senza scout)
    { athleteId: a5.id, zoneId: z8.id, scoutId: admin.id, date: daysAgo(15), eventType: "AMICHEVOLE", team: a5.team, opponent: "Demo Tramontana", category: "U15", minutes: 55, maturation: "NON_VALUTABILE", ...ratings([4, 4, 4, 3, 4, 3, 3, 4, 4, 3, 4, 3, 3, 3, 3]), strengths: "Rifinitura tra le linee\nControllo orientato", improvements: "Partecipazione alla fase difensiva", interest: "MEDIO", action: "NUOVO_CONTROLLO", reviewStatus: "APPROVATA", reviewedById: admin.id, reviewedAt: daysAgo(14) },
  ];
  for (const o of observations) await db.observation.create({ data: o });

  await db.followUp.create({ data: { athleteId: a1.id, type: "MONITORAGGIO", dueDate: daysAhead(21), note: "Rivedere in gara contro avversario di alta classifica.", assignedToId: scout1.id, createdById: referente.id } });
  await db.followUp.create({ data: { athleteId: a4.id, type: "NUOVO_CONTROLLO", dueDate: daysAgo(4), note: "Seconda osservazione in gara ufficiale.", assignedToId: scout3.id, createdById: admin.id } });
  await db.athlete.update({ where: { id: a1.id }, data: { nextCheckAt: daysAhead(21) } });
  await db.athlete.update({ where: { id: a4.id }, data: { nextCheckAt: daysAgo(4) } });

  await db.consent.create({ data: { athleteId: a1.id, type: "VIDEO", grantedBy: "Genitore/tutore", grantedAt: daysAgo(35), documentRef: "DEMO-2026-001", recordedById: referente.id } });

  await recomputeAll();
  console.log("Seed completato: 3 zone, 5 utenti, 5 atleti fittizi, 10 osservazioni, 2 follow-up.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
