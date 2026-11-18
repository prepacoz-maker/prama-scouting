// Carica tutto ciò che serve alla Player Card, già filtrato in base ai permessi dell'utente.
import { db } from "./db";
import { canSeeIdentity, canViewAthlete, type SessionUser } from "./permissions";
import {
  ATTRIBUTES,
  BADGES,
  OBSERVATIONS_WINDOW,
  areaScores,
  averageRatings,
  developmentAreas,
  needsNewCheck,
  type Attribute,
  type BadgeKey,
} from "./rating";
import { getWeights, pickRatings } from "./recompute";

export async function loadAthleteCard(user: SessionUser, athleteId: string, options: { forceAnonymous?: boolean } = {}) {
  const athlete = await db.athlete.findUnique({
    where: { id: athleteId },
    include: { zone: true, badges: { include: { badge: true } }, assignedScout: { select: { id: true, name: true } } },
  });
  if (!athlete || !canViewAthlete(user, athlete)) return null;

  const showIdentity = !options.forceAnonymous && canSeeIdentity(user, athlete);
  const identity = showIdentity ? await db.athleteIdentity.findUnique({ where: { athleteId } }) : null;

  const approved = await db.observation.findMany({
    where: { athleteId, reviewStatus: "APPROVATA" },
    orderBy: { date: "asc" },
    include: { scout: { select: { name: true } } },
  });
  const recent = approved.slice(-OBSERVATIONS_WINDOW);
  const averages = averageRatings(recent.map(pickRatings));
  const first = approved[0] ?? null;
  const last = approved.at(-1) ?? null;
  const firstRatings = first && approved.length > 1 ? pickRatings(first) : null;
  const lastRatings = last ? pickRatings(last) : null;

  const firstAreas = firstRatings ? areaScores(firstRatings) : null;
  const areas = areaScores(averages).map((a, i) => ({ ...a, first: firstAreas ? firstAreas[i].value : null }));

  // La foto compare solo se esiste un consenso valido per le foto.
  const now = new Date();
  const photoConsent = await db.consent.findFirst({
    where: { athleteId, type: "FOTO", revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
  });
  const photo = photoConsent
    ? await db.media.findFirst({ where: { athleteId, kind: "FOTO" }, orderBy: { createdAt: "desc" }, select: { id: true } })
    : null;
  const latestVideo = await db.media.findFirst({ where: { athleteId, kind: "VIDEO" }, orderBy: { createdAt: "desc" }, select: { id: true } });

  return {
    athlete,
    displayName: identity ? `${identity.firstName} ${identity.lastName}` : athlete.code,
    hasIdentity: !!identity,
    weights: await getWeights(athlete.roleGroup),
    averages,
    areas,
    comparison:
      firstRatings && lastRatings
        ? ATTRIBUTES.map((a: Attribute) => ({ attribute: a, first: firstRatings[a] ?? null, last: lastRatings[a] ?? null }))
        : null,
    firstOverall: first?.overallSnapshot ?? null,
    lastOverall: last?.overallSnapshot ?? null,
    badges: athlete.badges
      .map((b) => ({ key: b.badge.key as BadgeKey, label: b.badge.label, description: b.badge.description }))
      .filter((b) => b.key in BADGES),
    development: developmentAreas(averages),
    needsCheck: needsNewCheck(athlete.reliability, athlete.lastObservedAt, athlete.nextCheckAt),
    timeline: approved.map((o) => ({
      id: o.id,
      date: o.date,
      eventType: o.eventType,
      overall: o.overallSnapshot,
      scout: o.scout.name,
      minutes: o.minutes,
    })),
    lastObservationId: last?.id ?? null,
    photoId: photo?.id ?? null,
    latestVideoId: latestVideo?.id ?? null,
  };
}

export type AthleteCardData = NonNullable<Awaited<ReturnType<typeof loadAthleteCard>>>;
