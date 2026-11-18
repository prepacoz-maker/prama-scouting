"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { can, canManageAthlete } from "@/lib/permissions";
import { followUpSchema } from "@/lib/validation";
import { describeError, fail, type ActionResult } from "./result";

const STATUS_BY_TYPE = {
  NUOVO_CONTROLLO: "NUOVO_CONTROLLO_RICHIESTO",
  VIDEO: "VIDEO_RICHIESTO",
  MONITORAGGIO: "IN_FOLLOW_UP",
  COLLOQUIO: null,
} as const;

export async function createFollowUp(raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (!can(user, "followup.manage")) return fail("Solo referenti e admin pianificano i follow-up.");
  try {
    const input = followUpSchema.parse(raw);
    const athlete = await db.athlete.findUnique({ where: { id: input.athleteId } });
    if (!athlete || !canManageAthlete(user, athlete)) return fail("Non hai i permessi su questo profilo.");
    // Il colloquio con club, famiglia o atleta è gestito dal team PRAMA.
    if (input.type === "COLLOQUIO" && user.role !== "ADMIN") {
      return fail("Il colloquio è pianificato dal team PRAMA: segnalare il profilo a un admin.");
    }
    const dueDate = new Date(input.dueDate);
    const followUp = await db.followUp.create({
      data: {
        athleteId: athlete.id,
        type: input.type,
        dueDate,
        note: input.note,
        assignedToId: input.assignedToId || null,
        createdById: user.id,
      },
    });
    const nextStatus = STATUS_BY_TYPE[input.type];
    const keepStatus = ["INTERESSANTE", "MOLTO_INTERESSANTE"].includes(athlete.status);
    await db.athlete.update({
      where: { id: athlete.id },
      data: {
        nextCheckAt: !athlete.nextCheckAt || dueDate < athlete.nextCheckAt ? dueDate : athlete.nextCheckAt,
        status: nextStatus && !keepStatus ? nextStatus : athlete.status,
        assignedScoutId: input.assignedToId || athlete.assignedScoutId,
      },
    });
    await audit(user.id, "FOLLOWUP_CREATE", "FollowUp", followUp.id, { athlete: athlete.code, type: input.type });
    revalidatePath("/follow-up");
    revalidatePath(`/atleti/${athlete.id}`);
    return { ok: true };
  } catch (error) {
    return fail(describeError(error));
  }
}

export async function closeFollowUp(
  followUpId: string,
  status: "COMPLETATO" | "ANNULLATO",
  outcome: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const followUp = await db.followUp.findUnique({ where: { id: followUpId }, include: { athlete: true } });
  if (!followUp) return fail("Follow-up non trovato.");
  const isAssignee = followUp.assignedToId === user.id && status === "COMPLETATO";
  if (!isAssignee && !canManageAthlete(user, followUp.athlete)) return fail("Non hai i permessi su questo follow-up.");
  await db.followUp.update({
    where: { id: followUpId },
    data: { status, outcome: outcome.trim().slice(0, 500) || null, completedAt: new Date() },
  });
  const nextOpen = await db.followUp.findFirst({
    where: { athleteId: followUp.athleteId, status: "APERTO" },
    orderBy: { dueDate: "asc" },
  });
  await db.athlete.update({ where: { id: followUp.athleteId }, data: { nextCheckAt: nextOpen?.dueDate ?? null } });
  await audit(user.id, "FOLLOWUP_UPDATE", "FollowUp", followUpId, { status });
  revalidatePath("/follow-up");
  revalidatePath(`/atleti/${followUp.athleteId}`);
  return { ok: true };
}
