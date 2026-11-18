"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { canManageAthlete } from "@/lib/permissions";
import { storage } from "@/lib/storage";
import { fail, type ActionResult } from "./result";

const markerSchema = z.object({
  mediaId: z.string().min(1),
  t: z.coerce.number().int().min(0).max(60 * 60 * 4),
  label: z.string().trim().min(2, "Descrivere l'azione").max(60),
});

/** Aggiunge un tag temporale (azione chiave) a un video. */
export async function addMarker(raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = markerSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join(" "));
  const media = await db.media.findUnique({ where: { id: parsed.data.mediaId }, include: { athlete: true } });
  if (!media) return fail("Media non trovato.");
  if (media.uploadedById !== user.id && !canManageAthlete(user, media.athlete)) return fail("Non hai i permessi su questo media.");
  const markers = Array.isArray(media.markers) ? (media.markers as { t: number; label: string }[]) : [];
  const next = [...markers, { t: parsed.data.t, label: parsed.data.label }].sort((a, b) => a.t - b.t).slice(0, 30);
  await db.media.update({ where: { id: media.id }, data: { markers: next } });
  revalidatePath(`/atleti/${media.athleteId}`);
  return { ok: true };
}

export async function deleteMedia(mediaId: string): Promise<ActionResult> {
  const user = await requireUser();
  const media = await db.media.findUnique({ where: { id: mediaId }, include: { athlete: true } });
  if (!media) return fail("Media non trovato.");
  if (!canManageAthlete(user, media.athlete)) return fail("Solo referenti e admin eliminano i media.");
  await storage.remove(media.storageKey);
  await db.media.delete({ where: { id: mediaId } });
  await audit(user.id, "MEDIA_DELETE", "Media", mediaId, { athlete: media.athlete.code });
  revalidatePath(`/atleti/${media.athleteId}`);
  return { ok: true };
}
