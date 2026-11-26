import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/labels";
import { EmptyState, PageHeader, Panel, Pill } from "@/components/ui";

export const metadata = { title: "Match analysis" };

export default async function MatchAnalysisListPage() {
  await requirePermission("match.manage");
  const sessions = await db.matchSession.findMany({
    include: { athlete: { select: { code: true } }, _count: { select: { events: true } } },
    orderBy: { date: "desc" },
  });

  return (
    <>
      <PageHeader
        title="Match analysis"
        description="Analisi video riservate al team PRAMA. Il video non viene caricato: resta sul tuo computer o sul link indicato. Qui si salvano solo episodi, tempi, disegni e note."
        actions={
          <Link href="/match-analysis/nuova" className="btn-primary">
            Nuova analisi
          </Link>
        }
      />
      {sessions.length === 0 ? (
        <EmptyState
          title="Nessuna analisi"
          description="Crea la prima analisi: indichi la partita, l'atleta (con consenso video valido) e il video da usare."
          action={
            <Link href="/match-analysis/nuova" className="btn-primary">
              Nuova analisi
            </Link>
          }
        />
      ) : (
        <Panel>
          <ul className="divide-y divide-prama-100 dark:divide-prama-800">
            {sessions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link href={`/match-analysis/${s.id}`} className="font-semibold text-prama-900 hover:underline dark:text-white">
                    {s.title}
                  </Link>
                  <p className="muted text-sm">
                    {fmtDate(s.date)} · {s.team}
                    {s.opponent ? ` vs ${s.opponent}` : ""}
                    {s.score ? ` ${s.score}` : ""}
                    {s.athlete ? ` · ${s.athlete.code}` : ""} · {s.videoSource === "FILE_LOCALE" ? "file locale" : "link"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Pill>{s._count.events} episodi</Pill>
                  <Pill tone={s.status === "COMPLETATA" ? "APPROVATA" : "BOZZA"}>{s.status === "COMPLETATA" ? "Completata" : "In corso"}</Pill>
                  <Link href={`/match-analysis/${s.id}/report`} className="btn-secondary btn-sm">
                    Report
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
