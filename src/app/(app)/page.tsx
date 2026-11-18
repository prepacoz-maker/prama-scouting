import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { athleteScopeWhere, observationScopeWhere } from "@/lib/permissions";
import { EVENT_LABELS, FOLLOWUP_TYPE_LABELS, REVIEW_LABELS, ROLE_GROUP_LABELS, fmtDate } from "@/lib/labels";
import { DistributionChart } from "@/components/charts";
import { EmptyState, PageHeader, Panel, Pill, StatTile } from "@/components/ui";

export const metadata = { title: "Dashboard" };

const PERIODS: Record<string, { label: string; days: number }> = {
  "30": { label: "Ultimi 30 giorni", days: 30 },
  "90": { label: "Ultimi 90 giorni", days: 90 },
  "365": { label: "Ultimi 12 mesi", days: 365 },
};

const countBy = <T,>(items: T[], key: (item: T) => string) => {
  const map = new Map<string, number>();
  for (const item of items) map.set(key(item), (map.get(key(item)) ?? 0) + 1);
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => a.name.localeCompare(b.name));
};

export default async function DashboardPage({ searchParams }: { searchParams: { periodo?: string } }) {
  const user = await requireUser();
  const scope = athleteScopeWhere(user);
  const obsScope = observationScopeWhere(user);
  const period = PERIODS[searchParams.periodo ?? "90"] ?? PERIODS["90"];
  const since = new Date(Date.now() - period.days * 86_400_000);
  const soon = new Date(Date.now() + 30 * 86_400_000);
  const isScout = user.role === "SCOUT";

  const [toReview, newChecks, videoRequests, unseenMedia, followUp, highInterest, pending, upcoming, athletes, periodObs] = await Promise.all([
    db.observation.count({ where: { ...obsScope, reviewStatus: "DA_VALUTARE" } }),
    db.athlete.count({ where: { ...scope, status: "NUOVO_CONTROLLO_RICHIESTO" } }),
    db.athlete.count({ where: { ...scope, status: "VIDEO_RICHIESTO" } }),
    db.media.count({ where: { kind: "VIDEO", viewed: false, athlete: scope } }),
    db.athlete.count({ where: { ...scope, status: "IN_FOLLOW_UP" } }),
    db.athlete.count({ where: { ...scope, interest: { in: ["ALTO", "MOLTO_ALTO"] } } }),
    db.observation.findMany({
      where: { ...obsScope, reviewStatus: isScout ? { in: ["BOZZA", "INTEGRAZIONE_RICHIESTA"] } : "DA_VALUTARE" },
      include: { athlete: { select: { code: true } }, scout: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    db.followUp.findMany({
      where: { status: "APERTO", dueDate: { lte: soon }, athlete: scope, ...(isScout ? { assignedToId: user.id } : {}) },
      include: { athlete: { select: { id: true, code: true, team: true } }, assignedTo: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    db.athlete.findMany({ where: { ...scope, status: { notIn: ["ARCHIVIATO", "DUPLICATO"] } }, select: { category: true, roleGroup: true, zone: { select: { code: true } } } }),
    db.observation.findMany({ where: { ...obsScope, reviewStatus: { not: "BOZZA" }, date: { gte: since } }, select: { date: true } }),
  ]);

  const byMonth = countBy(periodObs, (o) => o.date.toISOString().slice(0, 7)).map((d) => ({ ...d, name: `${d.name.slice(5)}/${d.name.slice(2, 4)}` }));
  const today = new Date();

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={isScout ? "Le tue schede e i controlli che ti sono stati assegnati." : "Che cosa c'è da valutare, rivedere e pianificare."}
        actions={
          <Link href="/osservazioni/nuova" className="btn-primary">
            Nuova osservazione
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label={isScout ? "Tue schede in valutazione" : "Schede da valutare"} value={toReview} tone={toReview ? "alert" : "default"} />
        <StatTile label="Nuovi controlli richiesti" value={newChecks} href="/atleti?stato=NUOVO_CONTROLLO_RICHIESTO" tone={newChecks ? "alert" : "default"} />
        <StatTile label="Video da visionare" value={unseenMedia + videoRequests} href="/atleti?stato=VIDEO_RICHIESTO" />
        <StatTile label="Atleti in follow-up" value={followUp} href="/atleti?stato=IN_FOLLOW_UP" />
        <StatTile label="Interesse alto o molto alto" value={highInterest} href="/atleti?interesse=ALTO_PLUS" tone="good" />
        <StatTile label="Atleti attivi" value={athletes.length} href="/atleti" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title={isScout ? "Schede da completare" : "Schede da valutare"}>
          {pending.length === 0 ? (
            <EmptyState title="Niente in sospeso" description={isScout ? "Non hai bozze né integrazioni richieste." : "Tutte le schede ricevute sono state valutate."} />
          ) : (
            <ul className="divide-y divide-prama-100 dark:divide-prama-800">
              {pending.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div>
                    <Link href={`/osservazioni/${o.id}`} className="font-semibold underline-offset-2 hover:underline">
                      {o.athlete.code} · {EVENT_LABELS[o.eventType]} del {fmtDate(o.date)}
                    </Link>
                    <p className="muted text-xs">Scout {o.scout.name}</p>
                  </div>
                  <Pill tone={o.reviewStatus}>{REVIEW_LABELS[o.reviewStatus]}</Pill>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Prossime osservazioni" action={<Link href="/follow-up" className="text-sm font-semibold underline">Tutti i follow-up</Link>}>
          {upcoming.length === 0 ? (
            <EmptyState title="Nessuna scadenza nei prossimi 30 giorni" />
          ) : (
            <ul className="divide-y divide-prama-100 dark:divide-prama-800">
              {upcoming.map((f) => {
                const late = f.dueDate < today;
                return (
                  <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div>
                      <Link href={`/atleti/${f.athlete.id}`} className="font-semibold underline-offset-2 hover:underline">
                        {f.athlete.code} · {FOLLOWUP_TYPE_LABELS[f.type]}
                      </Link>
                      <p className="muted text-xs">
                        {f.athlete.team}
                        {f.assignedTo ? ` · assegnato a ${f.assignedTo.name}` : ""}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${late ? "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-100" : "bg-prama-100 text-prama-800 dark:bg-prama-700 dark:text-prama-50"}`}>
                      {late ? "Scaduto il " : ""}
                      {fmtDate(f.dueDate)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Distribuzione</h2>
        <form className="no-print flex items-center gap-2">
          <label htmlFor="periodo" className="text-sm">
            Periodo delle schede
          </label>
          <select id="periodo" name="periodo" defaultValue={searchParams.periodo ?? "90"} className="input w-auto">
            {Object.entries(PERIODS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-secondary">
            Applica
          </button>
        </form>
      </div>
      <div className="mt-3 grid gap-5 md:grid-cols-2">
        <Panel title={`Schede per mese · ${period.label.toLowerCase()}`}>
          {byMonth.length ? <DistributionChart data={byMonth} label="Schede" /> : <EmptyState title="Nessuna scheda nel periodo" />}
        </Panel>
        {user.role === "ADMIN" ? (
          <Panel title="Atleti per zona">
            <DistributionChart data={countBy(athletes, (a) => a.zone.code)} label="Atleti" />
          </Panel>
        ) : null}
        <Panel title="Atleti per categoria">
          <DistributionChart data={countBy(athletes, (a) => a.category)} label="Atleti" />
        </Panel>
        <Panel title="Atleti per reparto">
          <DistributionChart data={countBy(athletes, (a) => ROLE_GROUP_LABELS[a.roleGroup])} label="Atleti" />
        </Panel>
      </div>
    </>
  );
}
