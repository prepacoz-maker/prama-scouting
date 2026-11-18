"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { can, canManageAthlete } from "@/lib/permissions";
import { athleteSchema, consentSchema } from "@/lib/validation";
import { retentionMonths } from "@/lib/recompute";
import { storage } from "@/lib/storage";
import { describeError, fail, type ActionResult } from "./result";

async function nextAthleteCode(zoneCode: string): Promise<string> {
  const prefix = `A-${zoneCode}-`;
  const last = await db.athlete.findFirst({ where: { code: { startsWith: prefix } }, orderBy: { code: "desc" } });
  const next = last ? Number(last.code.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export async function createAthlete(raw: unknown): Promise<ActionResult<{ id: string; code: string }>> {
  const user = await requireUser();
  if (!can(user, "athlete.create")) return fail("Non hai i permessi per creare un profilo.");
  try {
    const input = athleteSchema.parse(raw);
    if (user.role !== "ADMIN" && input.zoneId !== user.zoneId) {
      return fail("Puoi creare profili solo nella tua zona.");
    }
    const zone = await db.zone.findUnique({ where: { id: input.zoneId } });
    if (!zone || !zone.active) return fail("Zona non valida.");

    const months = await retentionMonths();
    const reviewDueAt = new Date();
    reviewDueAt.setMonth(reviewDueAt.getMonth() + months);
    const hasIdentity = input.firstName.length > 0 && input.lastName.length > 0;

    // Il progressivo può collidere in caso di creazioni simultanee: si riprova.
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = await nextAthleteCode(zone.code);
      try {
        const athlete = await db.athlete.create({
          data: {
            code,
            zoneId: zone.id,
            birthYear: input.birthYear ?? null,
            roleGroup: input.roleGroup,
            primaryRole: input.primaryRole,
            secondaryRoles: input.secondaryRoles
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            team: input.team,
            category: input.category,
            foot: input.foot,
            heightCm: input.heightCm ?? null,
            weightKg: input.weightKg ?? null,
            createdById: user.id,
            assignedScoutId: user.role === "SCOUT" ? user.id : null,
            reviewDueAt,
            identity: hasIdentity ? { create: { firstName: input.firstName, lastName: input.lastName } } : undefined,
          },
        });
        await audit(user.id, "ATHLETE_CREATE", "Athlete", athlete.id, { code });
        revalidatePath("/atleti");
        return { ok: true, data: { id: athlete.id, code } };
      } catch (error) {
        if ((error as { code?: string }).code !== "P2002") throw error;
      }
    }
    return fail("Codice atleta non generato. Riprovare.");
  } catch (error) {
    return fail(describeError(error));
  }
}

const statusSchema = z.object({
  athleteId: z.string().min(1),
  status: z.enum([
    "DA_VALUTARE",
    "IN_OSSERVAZIONE",
    "NUOVO_CONTROLLO_RICHIESTO",
    "VIDEO_RICHIESTO",
    "IN_FOLLOW_UP",
    "INTERESSANTE",
    "MOLTO_INTERESSANTE",
    "NON_PRIORITARIO",
    "ARCHIVIATO",
    "DUPLICATO",
  ]),
  interest: z.enum(["BASSO", "MEDIO", "ALTO", "MOLTO_ALTO"]).nullable().optional(),
  nextCheckAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal("")),
  assignedScoutId: z.string().nullable().optional(),
});

export async function updateAthleteStatus(raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  try {
    const input = statusSchema.parse(raw);
    const athlete = await db.athlete.findUnique({ where: { id: input.athleteId } });
    if (!athlete || !canManageAthlete(user, athlete)) return fail("Non hai i permessi su questo profilo.");
    // "Molto interessante" richiede la conferma del responsabile PRAMA.
    if (input.status === "MOLTO_INTERESSANTE" && user.role !== "ADMIN") {
      return fail("Lo stato «Molto interessante» va confermato da un admin PRAMA. Impostare «Interessante» e segnalare il profilo.");
    }
    await db.athlete.update({
      where: { id: athlete.id },
      data: {
        status: input.status,
        interest: input.interest ?? null,
        nextCheckAt: input.nextCheckAt ? new Date(input.nextCheckAt) : null,
        assignedScoutId: input.assignedScoutId || null,
      },
    });
    await audit(user.id, "ATHLETE_STATUS", "Athlete", athlete.id, { from: athlete.status, to: input.status });
    revalidatePath(`/atleti/${athlete.id}`);
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return fail(describeError(error));
  }
}

/** Anonimizzazione: elimina identità, media, consensi e testi liberi; restano solo i dati statistici. */
export async function anonymizeAthlete(athleteId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!can(user, "athlete.anonymize")) return fail("Operazione riservata agli admin PRAMA.");
  try {
    const athlete = await db.athlete.findUnique({ where: { id: athleteId }, include: { media: true } });
    if (!athlete) return fail("Profilo non trovato.");
    for (const m of athlete.media) await storage.remove(m.storageKey);
    await db.$transaction([
      db.athleteIdentity.deleteMany({ where: { athleteId } }),
      db.media.deleteMany({ where: { athleteId } }),
      db.consent.deleteMany({ where: { athleteId } }),
      db.followUp.deleteMany({ where: { athleteId } }),
      db.observation.updateMany({
        where: { athleteId },
        data: { strengths: "", improvements: "", notes: "", team: "—", opponent: null, venue: null, competition: null, conditions: null, reviewNote: null },
      }),
      db.athlete.update({
        where: { id: athleteId },
        data: { team: "—", heightCm: null, weightKg: null, birthYear: null, secondaryRoles: [], status: "ARCHIVIATO", nextCheckAt: null, assignedScoutId: null, anonymizedAt: new Date() },
      }),
    ]);
    await audit(user.id, "ATHLETE_ANONYMIZE", "Athlete", athleteId, { code: athlete.code });
    revalidatePath(`/atleti/${athleteId}`);
    return { ok: true };
  } catch (error) {
    return fail(describeError(error));
  }
}

/** Cancellazione completa del profilo e di tutto ciò che vi è collegato. */
export async function deleteAthlete(athleteId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!can(user, "athlete.anonymize")) return fail("Operazione riservata agli admin PRAMA.");
  try {
    const athlete = await db.athlete.findUnique({ where: { id: athleteId }, include: { media: true } });
    if (!athlete) return fail("Profilo non trovato.");
    for (const m of athlete.media) await storage.remove(m.storageKey);
    await db.athlete.delete({ where: { id: athleteId } });
    await audit(user.id, "ATHLETE_ANONYMIZE", "Athlete", athleteId, { code: athlete.code, deleted: true });
    revalidatePath("/atleti");
    return { ok: true };
  } catch (error) {
    return fail(describeError(error));
  }
}

export async function recordConsent(raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (!can(user, "consent.manage")) return fail("Non hai i permessi per registrare un consenso.");
  try {
    const input = consentSchema.parse(raw);
    const athlete = await db.athlete.findUnique({ where: { id: input.athleteId } });
    if (!athlete || !canManageAthlete(user, athlete)) return fail("Non hai i permessi su questo profilo.");
    const consent = await db.consent.create({
      data: {
        athleteId: athlete.id,
        type: input.type,
        grantedBy: input.grantedBy,
        grantedAt: new Date(input.grantedAt),
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        documentRef: input.documentRef || null,
        recordedById: user.id,
      },
    });
    await audit(user.id, "CONSENT_RECORD", "Consent", consent.id, { athlete: athlete.code, type: input.type });
    revalidatePath(`/atleti/${athlete.id}`);
    return { ok: true };
  } catch (error) {
    return fail(describeError(error));
  }
}

export async function revokeConsent(consentId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!can(user, "consent.manage")) return fail("Non hai i permessi per revocare un consenso.");
  const consent = await db.consent.findUnique({ where: { id: consentId }, include: { athlete: true } });
  if (!consent || !canManageAthlete(user, consent.athlete)) return fail("Consenso non trovato.");
  await db.consent.update({ where: { id: consentId }, data: { revokedAt: new Date() } });
  await audit(user.id, "CONSENT_REVOKE", "Consent", consentId, { athlete: consent.athlete.code, type: consent.type });
  revalidatePath(`/atleti/${consent.athleteId}`);
  return { ok: true };
}
