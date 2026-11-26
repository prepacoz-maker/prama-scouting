"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { can, canEditObservation, canReviewObservation, canViewAthlete } from "@/lib/permissions";
import { observationSchema, submissionIssues } from "@/lib/validation";
import { ATTRIBUTES, STANDARD_VERSION, attributesFor } from "@/lib/rating";
import { recomputeAthlete } from "@/lib/recompute";
import { describeError, fail, type ActionResult } from "./result";

/** Crea o aggiorna una scheda. mode "draft" salva la bozza; "submit" la invia al referente. */
export async function saveObservation(
  raw: unknown,
  mode: "draft" | "submit",
  observationId?: string | null,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  if (!can(user, "observation.create")) return fail("Non hai i permessi per compilare una scheda.");
  try {
    const input = observationSchema.parse(raw);
    const athlete = await db.athlete.findUnique({ where: { id: input.athleteId } });
    if (!athlete || !canViewAthlete(user, athlete)) return fail("Atleta non trovato o fuori dalla tua zona.");
    if (athlete.anonymizedAt) return fail("Il profilo è stato anonimizzato: non accetta nuove schede.");

    if (mode === "submit") {
      const issues = submissionIssues(input, athlete.roleGroup);
      if (issues.length) return fail(issues.join(" "));
    }

    // Si salvano solo gli attributi della scheda del reparto (movimento o portiere).
    const template = attributesFor(athlete.roleGroup) as readonly string[];
    const ratings = Object.fromEntries(ATTRIBUTES.map((a) => [a, template.includes(a) ? (input[a] ?? null) : null]));
    const data = {
      athleteId: athlete.id,
      zoneId: athlete.zoneId,
      date: new Date(input.date),
      eventType: input.eventType,
      team: input.team,
      opponent: input.opponent || null,
      category: input.category,
      competition: input.competition || null,
      venue: input.venue || null,
      minutes: input.minutes,
      conditions: input.conditions || null,
      maturation: input.maturation,
      ...ratings,
      strengths: input.strengths,
      improvements: input.improvements,
      notes: input.notes,
      interest: input.interest ?? null,
      action: input.action ?? null,
      nextCheckSuggested: input.nextCheckSuggested ? new Date(input.nextCheckSuggested) : null,
      conflictOfInterest: input.conflictOfInterest,
      mismatch: input.mismatch ?? null,
      mismatchType: input.mismatch && input.mismatch !== "NON_OSSERVATO" ? (input.mismatchType ?? null) : null,
      standardVersion: STANDARD_VERSION,
      reviewStatus: mode === "submit" ? ("DA_VALUTARE" as const) : undefined,
    };

    let id = observationId ?? null;
    if (id) {
      const existing = await db.observation.findUnique({ where: { id } });
      if (!existing) return fail("Scheda non trovata.");
      if (!canEditObservation(user, existing)) {
        return fail("Questa scheda non è più modificabile: è stata inviata o approvata.");
      }
      await db.observation.update({ where: { id }, data });
      await audit(user.id, mode === "submit" ? "OBSERVATION_SUBMIT" : "OBSERVATION_UPDATE", "Observation", id);
    } else {
      const created = await db.observation.create({ data: { ...data, scoutId: user.id } });
      id = created.id;
      await audit(user.id, mode === "submit" ? "OBSERVATION_SUBMIT" : "OBSERVATION_CREATE", "Observation", id);
    }
    revalidatePath(`/atleti/${athlete.id}`);
    revalidatePath("/");
    return { ok: true, data: { id } };
  } catch (error) {
    return fail(describeError(error));
  }
}

const reviewSchema = z.object({
  observationId: z.string().min(1),
  decision: z.enum(["approve", "integrate"]),
  note: z.string().trim().max(500).optional().default(""),
});

/** Il referente approva la scheda (la Player Card si aggiorna) oppure chiede un'integrazione. */
export async function reviewObservation(raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  try {
    const input = reviewSchema.parse(raw);
    const obs = await db.observation.findUnique({ where: { id: input.observationId }, include: { athlete: true } });
    if (!obs) return fail("Scheda non trovata.");
    if (!canReviewObservation(user, obs)) return fail("Non puoi valutare questa scheda.");
    if (obs.scoutId === user.id && user.role !== "ADMIN") {
      return fail("Non puoi approvare una scheda compilata da te: deve valutarla un altro referente o un admin.");
    }
    if (input.decision === "integrate" && !input.note) {
      return fail("Scrivere che cosa va integrato, così lo scout sa che cosa completare.");
    }

    await db.observation.update({
      where: { id: obs.id },
      data: {
        reviewStatus: input.decision === "approve" ? "APPROVATA" : "INTEGRAZIONE_RICHIESTA",
        reviewedById: user.id,
        reviewedAt: new Date(),
        reviewNote: input.note || null,
      },
    });
    if (input.decision === "approve") {
      await recomputeAthlete(obs.athleteId);
      if (obs.athlete.status === "DA_VALUTARE") {
        await db.athlete.update({ where: { id: obs.athleteId }, data: { status: "IN_OSSERVAZIONE" } });
      }
    }
    await audit(user.id, "OBSERVATION_REVIEW", "Observation", obs.id, { decision: input.decision });
    revalidatePath(`/atleti/${obs.athleteId}`);
    revalidatePath(`/osservazioni/${obs.id}`);
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return fail(describeError(error));
  }
}

export async function deleteDraft(observationId: string): Promise<ActionResult> {
  const user = await requireUser();
  const obs = await db.observation.findUnique({ where: { id: observationId } });
  if (!obs || obs.reviewStatus !== "BOZZA" || (obs.scoutId !== user.id && user.role !== "ADMIN")) {
    return fail("Si possono eliminare solo le proprie bozze.");
  }
  await db.observation.delete({ where: { id: observationId } });
  await audit(user.id, "OBSERVATION_UPDATE", "Observation", observationId, { deletedDraft: true });
  revalidatePath("/");
  return { ok: true };
}
