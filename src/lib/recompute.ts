import { db } from "./db";
import {
  ATTRIBUTES,
  DEFAULT_WEIGHTS,
  OBSERVATIONS_WINDOW,
  averageRatings,
  computeBadges,
  computeOverall,
  computePotential,
  computeReliability,
  type Attribute,
  type Ratings,
  type RoleGroup,
  type Weights,
} from "./rating";

export async function getWeights(roleGroup: RoleGroup): Promise<Weights> {
  const rows = await db.metricWeight.findMany({ where: { roleGroup } });
  const weights = { ...DEFAULT_WEIGHTS[roleGroup] };
  for (const row of rows) {
    if ((ATTRIBUTES as readonly string[]).includes(row.attribute)) weights[row.attribute as Attribute] = row.weight;
  }
  return weights;
}

export const pickRatings = (o: Record<string, unknown>): Ratings =>
  Object.fromEntries(ATTRIBUTES.map((a) => [a, (o[a] as number | null) ?? null])) as Ratings;

/** Mesi dopo l'ultima osservazione entro cui rivedere la conservazione del profilo. */
export async function retentionMonths(): Promise<number> {
  const row = await db.setting.findUnique({ where: { key: "retentionMonths" } });
  return Number(row?.value ?? 12) || 12;
}

/**
 * Ricalcola i valori della Player Card a partire dalle sole osservazioni approvate.
 * Chiamata dopo ogni approvazione e dopo ogni modifica dei pesi.
 */
export async function recomputeAthlete(athleteId: string) {
  const athlete = await db.athlete.findUnique({ where: { id: athleteId } });
  if (!athlete) return;

  const approved = await db.observation.findMany({
    where: { athleteId, reviewStatus: "APPROVATA" },
    orderBy: { date: "asc" },
  });
  const weights = await getWeights(athlete.roleGroup);

  // Overall di ogni singola osservazione: serve per storico, progressione e confronto.
  const snapshots: (number | null)[] = [];
  for (const o of approved) {
    const snapshot = computeOverall(pickRatings(o), weights);
    snapshots.push(snapshot);
    if (snapshot !== o.overallSnapshot) {
      await db.observation.update({ where: { id: o.id }, data: { overallSnapshot: snapshot } });
    }
  }

  const recent = approved.slice(-OBSERVATIONS_WINDOW);
  const averages = averageRatings(recent.map(pickRatings));
  const overall = computeOverall(averages, weights);
  const last = approved.at(-1) ?? null;
  const reliability = computeReliability(approved.length, last?.date ?? null);
  const valid = snapshots.filter((s): s is number => s !== null);
  const firstOverall = valid[0] ?? null;
  const lastOverall = valid.at(-1) ?? null;
  const potential = computePotential({
    overall,
    ratings: averages,
    approvedCount: approved.length,
    firstOverall,
    lastOverall,
    reliability,
  });

  const months = await retentionMonths();
  const reviewDueAt = last ? new Date(new Date(last.date).setMonth(last.date.getMonth() + months)) : athlete.reviewDueAt;

  await db.athlete.update({
    where: { id: athleteId },
    data: {
      overall,
      potentialMin: potential?.min ?? null,
      potentialMax: potential?.max ?? null,
      reliability,
      observationsCount: approved.length,
      lastObservedAt: last?.date ?? null,
      reviewDueAt,
    },
  });

  const keys = computeBadges({ averages, approvedCount: approved.length, firstOverall, lastOverall });
  const badges = await db.badge.findMany({ where: { key: { in: keys } } });
  await db.$transaction([
    db.athleteBadge.deleteMany({ where: { athleteId } }),
    db.athleteBadge.createMany({ data: badges.map((b) => ({ athleteId, badgeId: b.id })) }),
  ]);
}

export async function recomputeAll() {
  const athletes = await db.athlete.findMany({ select: { id: true } });
  for (const a of athletes) await recomputeAthlete(a.id);
}
