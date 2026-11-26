import { db } from "./db";
import type { CodeButton, Shape } from "./match";

/** Carica un'analisi con episodi e playlist, nel formato usato dall'interfaccia. */
export async function loadMatchSession(id: string) {
  const session = await db.matchSession.findUnique({
    where: { id },
    include: {
      athlete: { include: { identity: true } },
      createdBy: { select: { name: true } },
      events: { orderBy: { startSec: "asc" } },
      playlists: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!session) return null;
  const events = session.events.map((e) => ({
    id: e.id,
    code: e.code,
    label: e.label,
    category: e.category,
    outcome: e.outcome,
    timeSec: e.timeSec,
    startSec: e.startSec,
    endSec: e.endSec,
    rating: e.rating,
    confidence: e.confidence,
    phase: e.phase,
    fact: e.fact,
    inference: e.inference,
    recommendation: e.recommendation,
    debrief: e.debrief,
    drawing: (e.drawing as unknown as Shape[] | null) ?? null,
    drawingSec: e.drawingSec,
  }));
  return { session, buttons: session.buttons as unknown as CodeButton[], events, playlists: session.playlists.map((p) => ({ id: p.id, name: p.name, eventIds: p.eventIds })) };
}
