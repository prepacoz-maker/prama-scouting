import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { getUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { eventsToCsv } from "@/lib/match";
import { loadMatchSession } from "@/lib/match-data";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user || !can(user, "match.manage")) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  const data = await loadMatchSession(params.id);
  if (!data) return NextResponse.json({ error: "Analisi non trovata" }, { status: 404 });
  await audit(user.id, "MATCH_EXPORT", "MatchSession", data.session.id, { format: "csv", events: data.events.length });
  const csv = eventsToCsv(data.events, data.session.secondHalfSec);
  const name = `match-analysis-${data.session.date.toISOString().slice(0, 10)}-${data.session.id.slice(-6)}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
