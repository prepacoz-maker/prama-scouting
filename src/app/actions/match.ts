"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { can, type SessionUser } from "@/lib/permissions";
import {
  TEMPLATES,
  buttonsSchema,
  clipBounds,
  drawingSchema,
  eventCreateSchema,
  eventUpdateSchema,
  playlistSchema,
  reportSchema,
  sessionSchema,
  type CodeButton,
} from "@/lib/match";
import { describeError, fail, type ActionResult } from "./result";

async function requireMatchUser(): Promise<SessionUser | null> {
  const user = await requireUser();
  return can(user, "match.manage") ? user : null;
}

const DENIED = "La match analysis è riservata al team PRAMA.";

/** Consenso VIDEO valido (non revocato, non scaduto) dell'atleta. */
async function activeVideoConsent(athleteId: string) {
  const now = new Date();
  return db.consent.findFirst({
    where: { athleteId, type: "VIDEO", revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    orderBy: { grantedAt: "desc" },
  });
}

export async function createMatchSession(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireMatchUser();
  if (!user) return fail(DENIED);
  try {
    const input = sessionSchema.parse(raw);
    let consentId: string | null = null;
    if (input.athleteId) {
      const athlete = await db.athlete.findUnique({ where: { id: input.athleteId } });
      if (!athlete || athlete.anonymizedAt) return fail("Atleta non disponibile.");
      const consent = await activeVideoConsent(athlete.id);
      if (!consent) return fail("Per analizzare il video di questo atleta serve un consenso VIDEO valido, registrato nella sua scheda.");
      consentId = consent.id;
    }
    const template = TEMPLATES[input.template];
    const session = await db.matchSession.create({
      data: {
        title: input.title,
        sport: input.sport,
        date: new Date(input.date),
        competition: input.competition,
        team: input.team,
        opponent: input.opponent,
        score: input.score,
        athleteId: input.athleteId || null,
        roleTask: input.roleTask,
        objective: input.objective,
        level: input.level,
        minutes: input.minutes ?? null,
        videoSource: input.videoSource,
        videoLabel: input.videoLabel,
        videoUrl: input.videoSource === "LINK" ? input.videoUrl : null,
        videoAngle: input.videoAngle,
        buttons: template.buttons as unknown as Prisma.InputJsonValue,
        rightsConfirmedAt: new Date(),
        consentId,
        createdById: user.id,
      },
    });
    await audit(user.id, "MATCH_CREATE", "MatchSession", session.id, { template: input.template, source: input.videoSource });
    revalidatePath("/match-analysis");
    return { ok: true, data: { id: session.id } };
  } catch (error) {
    return fail(describeError(error));
  }
}

async function ownedSession(sessionId: string) {
  return db.matchSession.findUnique({ where: { id: sessionId } });
}

export async function updateButtons(sessionId: string, raw: unknown): Promise<ActionResult> {
  const user = await requireMatchUser();
  if (!user) return fail(DENIED);
  try {
    const buttons = buttonsSchema.parse(raw);
    const session = await ownedSession(sessionId);
    if (!session) return fail("Analisi non trovata.");
    await db.matchSession.update({ where: { id: sessionId }, data: { buttons: buttons as unknown as Prisma.InputJsonValue } });
    await audit(user.id, "MATCH_UPDATE", "MatchSession", sessionId, { part: "buttons", count: buttons.length });
    return { ok: true };
  } catch (error) {
    return fail(describeError(error));
  }
}

export async function setVideoMeta(sessionId: string, meta: { durationSec?: number | null; secondHalfSec?: number | null; videoLabel?: string }): Promise<ActionResult> {
  const user = await requireMatchUser();
  if (!user) return fail(DENIED);
  const data: Prisma.MatchSessionUpdateInput = {};
  if (meta.durationSec !== undefined && (meta.durationSec === null || (Number.isFinite(meta.durationSec) && meta.durationSec >= 0))) data.durationSec = meta.durationSec;
  if (meta.secondHalfSec !== undefined && (meta.secondHalfSec === null || (Number.isFinite(meta.secondHalfSec) && meta.secondHalfSec >= 0))) data.secondHalfSec = meta.secondHalfSec;
  if (meta.videoLabel !== undefined && meta.videoLabel.trim()) data.videoLabel = meta.videoLabel.trim().slice(0, 200);
  try {
    await db.matchSession.update({ where: { id: sessionId }, data });
    return { ok: true };
  } catch (error) {
    return fail(describeError(error));
  }
}

export async function createEvent(raw: unknown): Promise<ActionResult<{ id: string; startSec: number; endSec: number }>> {
  const user = await requireMatchUser();
  if (!user) return fail(DENIED);
  try {
    const input = eventCreateSchema.parse(raw);
    const session = await ownedSession(input.sessionId);
    if (!session) return fail("Analisi non trovata.");
    const button = (session.buttons as unknown as CodeButton[]).find((b) => b.code === input.code);
    if (!button) return fail("Pulsante non presente nel pannello di codifica.");
    const { startSec, endSec } = clipBounds(input.timeSec, button.pre, button.post, session.durationSec);
    const event = await db.matchEvent.create({
      data: {
        sessionId: session.id,
        code: button.code,
        label: button.label,
        category: button.category,
        outcome: button.outcome,
        timeSec: Math.round(input.timeSec * 100) / 100,
        startSec,
        endSec,
      },
    });
    return { ok: true, data: { id: event.id, startSec, endSec } };
  } catch (error) {
    return fail(describeError(error));
  }
}

export async function updateEvent(raw: unknown): Promise<ActionResult> {
  const user = await requireMatchUser();
  if (!user) return fail(DENIED);
  try {
    const { id, ...data } = eventUpdateSchema.parse(raw);
    await db.matchEvent.update({ where: { id }, data });
    return { ok: true };
  } catch (error) {
    return fail(describeError(error));
  }
}

export async function saveDrawing(raw: unknown): Promise<ActionResult> {
  const user = await requireMatchUser();
  if (!user) return fail(DENIED);
  try {
    const input = drawingSchema.parse(raw);
    await db.matchEvent.update({
      where: { id: input.id },
      data: input.shapes.length
        ? { drawing: input.shapes as unknown as Prisma.InputJsonValue, drawingSec: input.drawingSec }
        : { drawing: Prisma.DbNull, drawingSec: null },
    });
    return { ok: true };
  } catch (error) {
    return fail(describeError(error));
  }
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  const user = await requireMatchUser();
  if (!user) return fail(DENIED);
  try {
    const event = await db.matchEvent.delete({ where: { id } });
    // Rimuove l'episodio dalle playlist della stessa analisi.
    const playlists = await db.matchPlaylist.findMany({ where: { sessionId: event.sessionId, eventIds: { has: id } } });
    for (const p of playlists) {
      await db.matchPlaylist.update({ where: { id: p.id }, data: { eventIds: p.eventIds.filter((e) => e !== id) } });
    }
    return { ok: true };
  } catch (error) {
    return fail(describeError(error));
  }
}

export async function createPlaylist(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireMatchUser();
  if (!user) return fail(DENIED);
  try {
    const input = playlistSchema.parse(raw);
    const count = await db.matchEvent.count({ where: { sessionId: input.sessionId, id: { in: input.eventIds } } });
    if (count !== input.eventIds.length) return fail("Alcuni episodi non appartengono a questa analisi.");
    const playlist = await db.matchPlaylist.create({ data: input });
    return { ok: true, data: { id: playlist.id } };
  } catch (error) {
    return fail(describeError(error));
  }
}

export async function deletePlaylist(id: string): Promise<ActionResult> {
  const user = await requireMatchUser();
  if (!user) return fail(DENIED);
  try {
    await db.matchPlaylist.delete({ where: { id } });
    return { ok: true };
  } catch (error) {
    return fail(describeError(error));
  }
}

export async function saveReport(raw: unknown): Promise<ActionResult> {
  const user = await requireMatchUser();
  if (!user) return fail(DENIED);
  try {
    const { id, ...data } = reportSchema.parse(raw);
    await db.matchSession.update({ where: { id }, data });
    await audit(user.id, "MATCH_UPDATE", "MatchSession", id, { part: "report", status: data.status });
    revalidatePath(`/match-analysis/${id}`);
    revalidatePath("/match-analysis");
    return { ok: true };
  } catch (error) {
    return fail(describeError(error));
  }
}

export async function deleteMatchSession(id: string): Promise<ActionResult> {
  const user = await requireMatchUser();
  if (!user) return fail(DENIED);
  try {
    await db.matchSession.delete({ where: { id } });
    await audit(user.id, "MATCH_DELETE", "MatchSession", id);
    revalidatePath("/match-analysis");
    return { ok: true };
  } catch (error) {
    return fail(describeError(error));
  }
}
