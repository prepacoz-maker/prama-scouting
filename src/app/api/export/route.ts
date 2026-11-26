import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { ATTRIBUTES, ATTRIBUTE_LABELS, GK_ATTRIBUTES } from "@/lib/rating";
import { MISMATCH_LABELS, MISMATCH_TYPE_LABELS } from "@/lib/standard";

const exportLabel = (a: (typeof ATTRIBUTES)[number]) =>
  (GK_ATTRIBUTES as readonly string[]).includes(a) ? `Portiere · ${ATTRIBUTE_LABELS[a]}` : ATTRIBUTE_LABELS[a];
import { INTEREST_LABELS, RELIABILITY_LABELS, REVIEW_LABELS, STATUS_LABELS, EVENT_LABELS } from "@/lib/labels";

export const runtime = "nodejs";

// Il prefisso con apostrofo neutralizza le formule nei fogli di calcolo (CSV injection).
const cell = (value: unknown) => {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};
const toCsv = (rows: unknown[][]) => "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

/** Export CSV riservato agli admin. Per impostazione predefinita contiene solo il codice atleta. */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user || !can(user, "export.run")) return new NextResponse("Accesso non consentito.", { status: 403 });

  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "atleti";
  const interestOnly = url.searchParams.get("lista") === "interesse";
  const withIdentity = url.searchParams.get("identita") === "1";
  let rows: unknown[][];

  if (type === "osservazioni") {
    const observations = await db.observation.findMany({
      where: { reviewStatus: { not: "BOZZA" } },
      include: { athlete: true, zone: true },
      orderBy: { date: "desc" },
    });
    rows = [
      ["Codice atleta", "Zona", "Data", "Evento", "Categoria", "Minuti", "Stato scheda", "Overall scheda", "Standard", "Mismatch", "Tipo mismatch", ...ATTRIBUTES.map(exportLabel)],
      ...observations.map((o) => [
        o.athlete.code, o.zone.code, day(o.date), EVENT_LABELS[o.eventType], o.category, o.minutes,
        REVIEW_LABELS[o.reviewStatus], o.overallSnapshot, o.standardVersion,
        o.mismatch ? MISMATCH_LABELS[o.mismatch] : "", o.mismatchType ? MISMATCH_TYPE_LABELS[o.mismatchType] : "",
        ...ATTRIBUTES.map((a) => o[a]),
      ]),
    ];
  } else {
    const athletes = await db.athlete.findMany({
      where: interestOnly ? { interest: { in: ["ALTO", "MOLTO_ALTO"] } } : {},
      include: { zone: true, identity: withIdentity },
      orderBy: { code: "asc" },
    });
    rows = [
      ["Codice atleta", ...(withIdentity ? ["Cognome", "Nome"] : []), "Zona", "Squadra", "Categoria", "Ruolo", "Anno di nascita", "Stato", "Interesse", "Overall", "Potenziale min", "Potenziale max", "Affidabilità", "N. osservazioni", "Ultima osservazione", "Prossimo controllo"],
      ...athletes.map((a) => [
        a.code, ...(withIdentity ? [a.identity?.lastName ?? "", a.identity?.firstName ?? ""] : []), a.zone.code, a.team, a.category,
        a.primaryRole, a.birthYear, STATUS_LABELS[a.status], a.interest ? INTEREST_LABELS[a.interest] : "", a.overall,
        a.potentialMin, a.potentialMax, RELIABILITY_LABELS[a.reliability], a.observationsCount, day(a.lastObservedAt), day(a.nextCheckAt),
      ]),
    ];
  }

  await audit(user.id, "EXPORT", type, null, { rows: rows.length - 1, interestOnly, withIdentity });
  const name = `prama_${type}${interestOnly ? "_interesse" : ""}_${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(toCsv(rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}
