import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { athleteScopeWhere, canManageAthlete } from "@/lib/permissions";
import { FOLLOWUP_STATUS_LABELS, FOLLOWUP_TYPE_LABELS, fmtDate } from "@/lib/labels";
import { CloseFollowUp } from "@/components/panels";
import { EmptyState, PageHeader, Panel, StatusTag } from "@/components/ui";

export const metadata = { title: "Follow-up" };

export default async function FollowUpPage({ searchParams }: { searchParams: { mostra?: string } }) {
  const user = await requireUser();
  const showClosed = searchParams.mostra === "storico";
  const followUps = await db.followUp.findMany({
    where: {
      athlete: athleteScopeWhere(user),
      status: showClosed ? { not: "APERTO" } : "APERTO",
      ...(user.role === "SCOUT" ? { assignedToId: user.id } : {}),
    },
    include: { athlete: { include: { zone: true } }, assignedTo: { select: { name: true } }, createdBy: { select: { name: true } } },
    orderBy: { dueDate: showClosed ? "desc" : "asc" },
    take: 200,
  });
  const today = new Date();
  const late = followUps.filter((f) => f.status === "APERTO" && f.dueDate < today);
  const upcoming = followUps.filter((f) => !late.includes(f));

  const List = ({ items }: { items: typeof followUps }) => (
    <ul className="divide-y divide-prama-100 dark:divide-prama-800">
      {items.map((f) => (
        <li key={f.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/atleti/${f.athleteId}`} className="font-semibold underline-offset-2 hover:underline">
                {f.athlete.code}
              </Link>
              <StatusTag status={f.athlete.status} compact />
              <span className="text-sm font-medium">{FOLLOWUP_TYPE_LABELS[f.type]}</span>
            </div>
            <p className="muted text-sm">
              {f.athlete.team} · Zona {f.athlete.zone.code}
              {f.assignedTo ? ` · assegnato a ${f.assignedTo.name}` : " · non assegnato"} · richiesto da {f.createdBy.name}
            </p>
            {f.note ? <p className="mt-1 text-sm">{f.note}</p> : null}
            {f.outcome ? <p className="mt-1 text-sm">Esito: {f.outcome}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold tabular-nums">{fmtDate(f.dueDate)}</span>
            {f.status === "APERTO" ? (
              <>
                <Link href={`/osservazioni/nuova?atleta=${f.athleteId}`} className="btn-secondary btn-sm">
                  Compila scheda
                </Link>
                <CloseFollowUp followUpId={f.id} canCancel={canManageAthlete(user, f.athlete)} />
              </>
            ) : (
              <span className="rounded-full bg-prama-100 px-2 py-0.5 text-xs font-semibold dark:bg-prama-700">{FOLLOWUP_STATUS_LABELS[f.status]}</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <PageHeader
        title="Follow-up"
        description={user.role === "SCOUT" ? "I controlli che ti sono stati assegnati." : "Controlli pianificati, scadenze e storico. I nuovi follow-up si creano dal profilo dell'atleta."}
        actions={
          <Link href={showClosed ? "/follow-up" : "/follow-up?mostra=storico"} className="btn-secondary">
            {showClosed ? "Mostra aperti" : "Mostra storico"}
          </Link>
        }
      />
      {followUps.length === 0 ? (
        <EmptyState title={showClosed ? "Nessun follow-up chiuso" : "Nessun follow-up aperto"} description="Quando il referente pianifica un controllo, compare qui con la sua scadenza." />
      ) : (
        <div className="space-y-5">
          {late.length ? (
            <Panel title={`Scaduti (${late.length})`} className="border-l-4 border-l-red-500">
              <List items={late} />
            </Panel>
          ) : null}
          {upcoming.length ? (
            <Panel title={showClosed ? "Storico" : `In programma (${upcoming.length})`}>
              <List items={upcoming} />
            </Panel>
          ) : null}
        </div>
      )}
    </>
  );
}
