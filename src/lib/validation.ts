import { z } from "zod";
import { ATTRIBUTES } from "./rating";

const rating = z
  .union([z.number().int().min(1, "Il voto va da 1 a 5").max(5, "Il voto va da 1 a 5"), z.null()])
  .optional();

const ratingsShape = Object.fromEntries(ATTRIBUTES.map((a) => [a, rating])) as Record<
  (typeof ATTRIBUTES)[number],
  typeof rating
>;

const optionalText = (max: number) => z.string().trim().max(max, `Massimo ${max} caratteri`).optional().default("");
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida");

// Parole che indicano dati sanitari o riservati: non devono entrare nelle note.
const SENSITIVE = /\b(infortun\w*|diagnos\w*|malatti\w*|farmac\w*|terapi\w*|disturb\w*|psicolog\w*|divorz\w*|separat[ie]\b|reddito)\b/i;
const noSensitive = (value: string) => !SENSITIVE.test(value);
const sensitiveMessage =
  "Il testo sembra contenere informazioni sanitarie o familiari riservate. Scrivere solo fatti sportivi osservati.";

export const athleteSchema = z.object({
  firstName: z.string().trim().max(60).optional().default(""),
  lastName: z.string().trim().max(60).optional().default(""),
  zoneId: z.string().min(1, "Selezionare la zona"),
  birthYear: z.coerce
    .number()
    .int()
    .min(1985, "Anno non valido")
    .max(new Date().getFullYear() - 8, "Anno non valido")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  roleGroup: z.enum(["PORTIERE", "DIFENSORE", "CENTROCAMPISTA", "ATTACCANTE"], {
    errorMap: () => ({ message: "Selezionare il reparto" }),
  }),
  primaryRole: z.string().trim().min(2, "Indicare il ruolo principale").max(40),
  secondaryRoles: z.string().trim().max(80).optional().default(""),
  team: z.string().trim().min(2, "Indicare la squadra").max(80),
  category: z.string().min(1, "Selezionare la categoria"),
  foot: z.enum(["DESTRO", "SINISTRO", "ENTRAMBI", "NON_RILEVATO"]).default("NON_RILEVATO"),
  heightCm: z.coerce.number().int().min(100).max(220).optional().or(z.literal("").transform(() => undefined)),
  weightKg: z.coerce.number().int().min(25).max(130).optional().or(z.literal("").transform(() => undefined)),
});
export type AthleteInput = z.infer<typeof athleteSchema>;

export const observationSchema = z
  .object({
    athleteId: z.string().min(1, "Selezionare l'atleta"),
    date: dateString,
    eventType: z.enum(["PARTITA", "ALLENAMENTO", "TORNEO", "AMICHEVOLE", "VIDEO"]),
    team: z.string().trim().min(2, "Indicare la squadra osservata").max(80),
    opponent: optionalText(80),
    category: z.string().min(1, "Selezionare la categoria"),
    competition: optionalText(80),
    venue: optionalText(80),
    minutes: z.coerce.number().int().min(1, "Indicare i minuti osservati").max(200, "Valore troppo alto"),
    conditions: optionalText(120),
    maturation: z.enum(["PRECOCE", "IN_LINEA", "TARDIVA", "NON_VALUTABILE"]).default("NON_VALUTABILE"),
    ...ratingsShape,
    strengths: optionalText(600).refine(noSensitive, sensitiveMessage),
    improvements: optionalText(600).refine(noSensitive, sensitiveMessage),
    notes: optionalText(1500).refine(noSensitive, sensitiveMessage),
    interest: z.enum(["BASSO", "MEDIO", "ALTO", "MOLTO_ALTO"]).optional().nullable(),
    action: z.enum(["ARCHIVIAZIONE", "NUOVO_CONTROLLO", "RICHIESTA_VIDEO", "COLLOQUIO", "FOLLOW_UP"]).optional().nullable(),
    nextCheckSuggested: dateString.optional().or(z.literal("")).nullable(),
    conflictOfInterest: z.boolean().default(false),
  })
  .refine((v) => new Date(v.date).getTime() <= Date.now() + 86_400_000, {
    path: ["date"],
    message: "La data dell'osservazione non può essere nel futuro",
  });
export type ObservationInput = z.infer<typeof observationSchema>;

/** Requisiti aggiuntivi per l'invio al referente (non richiesti per la bozza). */
export function submissionIssues(input: ObservationInput): string[] {
  const issues: string[] = [];
  const rated = ATTRIBUTES.filter((a) => typeof input[a] === "number").length;
  if (rated < 8) issues.push(`Valutare almeno 8 attributi su 15 (ora: ${rated}). Usare N/V solo per ciò che non si è visto.`);
  if (!input.strengths?.trim()) issues.push("Indicare almeno un punto di forza.");
  if (!input.improvements?.trim()) issues.push("Indicare almeno un'area di miglioramento.");
  if (!input.interest) issues.push("Indicare il livello di interesse proposto.");
  if (!input.action) issues.push("Indicare l'azione consigliata.");
  return issues;
}

export const followUpSchema = z.object({
  athleteId: z.string().min(1),
  type: z.enum(["NUOVO_CONTROLLO", "VIDEO", "COLLOQUIO", "MONITORAGGIO"]),
  dueDate: dateString,
  assignedToId: z.string().optional().nullable(),
  note: optionalText(500).refine(noSensitive, sensitiveMessage),
});

export const userSchema = z.object({
  name: z.string().trim().min(2, "Indicare il nome").max(80),
  email: z.string().trim().toLowerCase().email("Email non valida"),
  role: z.enum(["SCOUT", "REFERENTE", "ADMIN"]),
  zoneId: z.string().optional().nullable(),
  password: z.string().min(10, "La password deve avere almeno 10 caratteri"),
  canUploadMedia: z.boolean().default(false),
});

export const zoneSchema = z.object({
  code: z.string().trim().regex(/^Z\d{2}$/, "Formato: Z01"),
  name: z.string().trim().min(2).max(60),
});

export const consentSchema = z.object({
  athleteId: z.string().min(1),
  type: z.enum(["FOTO", "VIDEO", "DATI"]),
  grantedBy: z.string().trim().min(2, "Indicare chi ha dato il consenso (es. genitore/tutore)").max(60),
  grantedAt: dateString,
  expiresAt: dateString.optional().or(z.literal("")).nullable(),
  documentRef: optionalText(120),
});
