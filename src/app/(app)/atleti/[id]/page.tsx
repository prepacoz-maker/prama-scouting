import Link from "next/link";
import { notFound } from "next/navigation";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadAthleteCard } from "@/lib/athlete-view";
import { can, canManageAthlete } from "@/lib/permissions";
import { ATTRIBUTE_LABELS } from "@/lib/rating";
import { FOLLOWUP_STATUS_LABELS, FOLLOWUP_TYPE_LABELS, INTEREST_LABELS, STATUS_LABELS, fmtDate } from "@/lib/labels";
import { AthleteCard } from "@/components/AthleteCard";
import { ProgressChart } from "@/components/charts";
import { CloseFollowUp, ConsentPanel, FollowUpForm, MediaPanel, PrivacyActions, StatusPanel } from "@/components/panels";
import { Timeline } from "@/components/Timeline";
import { Alert, EmptyState, PageHeader, Panel } from "@/components/ui";

export const metadata = { title: "Profilo atleta" };

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function AthletePage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const data = await loadAthleteCard(user, params.id);
  if (!data) notFound();
  const { athlete } = data;
  const manage = canManageAthlete(user, athlete);
  await audit(user.id, "ATHLETE_VIEW", "Athlete", athlete.id, { code: athlete.code });

  const [observations, followUps, media, consents, scouts, scoutProfile] = await Promise.all([
    db.observation.findMany({
      // Le schede non ancora approvate sono visibili solo a chi le ha scritte e a chi le valuta.
      where: {
        athleteId: athlete.id,
        OR: [{ reviewStatus: "APPROVATA" }, { scoutId: user.id }, ...(user.role === "SCOUT" ? [] : [{ reviewStatus: { not: "BOZZA" as const } }])],
      },
      include: { scout: { select: { name: true } } },
      orderBy: { date: "desc" },
    }),
    db.followUp.findMany({
      where: { athleteId: athlete.id },
      include: { assignedTo: { select: { name: true } }, createdBy: { select: { name: true } } },
      orderBy: { dueDate: "desc" },
    }),
    db.media.findMany({ where: { athleteId: athlete.id }, include: { uploadedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
    db.consent.findMany({ where: { athleteId: athlete.id }, orderBy: { createdAt: "desc" } }),
    manage ? db.user.findMany({ where: { active: true, role: "SCOUT", zoneId: athlete.zoneId }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    user.role === "SCOUT" ? db.scout.findUnique({ where: { userId: user.id } }) : Promise.resolve(null),
  ]);

  const progress = data.timeline.filter((t) => t.overall !== null).map((t) => ({ date: fmtDate(t.date).slice(0, 5), overall: t.overall as number }));
  const now = new Date();
  const activeMediaConsent = consents.some((c) => c.type !== "DATI" && !c.revokedAt && (!c.expiresAt || c.expiresAt > now));
  const canUpload = can(user, "media.upload") && !athlete.anonymizedAt;
  const uploadBlockedReason =
    user.role === "SCOUT" && !scoutProfile?.canUploadMedia
      ? "Il caricamento di media è riservato agli scout abilitati dal referente."
      : !activeMediaConsent
        ? "Per caricare foto o video serve prima un consenso valido dei genitori/tutori, registrato dal referente."
        : null;

  return (
    <>
      <PageHeader
        title={data.displayName}
        description={`${STATUS_LABELS[athlete.status]}${athlete.interest ? ` · interesse ${INTEREST_LABELS[athlete.interest].toLowerCase()}` : ""}${data.athlete.assignedScout ? ` · scout assegnato: ${data.athlete.assignedScout.name}` : ""}`}
        actions={
          <Link href="/atleti" className="btn-secondary">
            Torna all&apos;archivio
          </Link>
        }
      />
      {athlete.anonymizedAt ? <div className="mb-4"><Alert tone="info">Profilo anonimizzato il {fmtDate(athlete.anonymizedAt)}: restano solo i dati statistici.</Alert></div> : null}

      <AthleteCard data={data} />

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Progressione nel tempo">
          {progress.length >= 2 ? (
            <>
              <ProgressChart data={progress} />
              <p className="muted mt-2 text-xs">Overall delle singole schede approvate. Le variazioni risentono di avversario, ruolo e fase di crescita.</p>
            </>
          ) : (
            <EmptyState title="Servono almeno due schede approvate" description="La progressione compare dalla seconda osservazione." />
          )}
        </Panel>

        <Panel title="Prima e ultima valutazione">
          {data.comparison ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Confronto tra la prima e l&apos;ultima scheda approvata</caption>
                <thead>
                  <tr className="border-b border-prama-100 dark:border-prama-800">
                    <th scope="col" className="th">Attributo</th>
                    <th scope="col" className="th text-right">Prima</th>
                    <th scope="col" className="th text-right">Ultima</th>
                    <th scope="col" className="th text-right">Variazione</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-prama-100 dark:divide-prama-800">
                  <tr className="font-semibold">
                    <th scope="row" className="td text-left">Overall della scheda</th>
                    <td className="td text-right tabular-nums">{data.firstOverall ?? "—"}</td>
                    <td className="td text-right tabular-nums">{data.lastOverall ?? "—"}</td>
                    <td className="td text-right tabular-nums">
                      {data.firstOverall !== null && data.lastOverall !== null ? `${data.lastOverall - data.firstOverall > 0 ? "+" : ""}${data.lastOverall - data.firstOverall}` : "—"}
                    </td>
                  </tr>
                  {data.comparison.map((c) => {
                    const delta = c.first !== null && c.last !== null ? c.last - c.first : null;
                    return (
                      <tr key={c.attribute}>
                        <th scope="row" className="td text-left font-normal">{ATTRIBUTE_LABELS[c.attribute]}</th>
                        <td className="td text-right tabular-nums">{c.first ?? "N/V"}</td>
                        <td className="td text-right tabular-nums">{c.last ?? "N/V"}</td>
                        <td className={`td text-right font-semibold tabular-nums ${delta && delta > 0 ? "text-campo-600" : delta && delta < 0 ? "text-accent-600" : ""}`}>
                          {delta === null ? "—" : delta === 0 ? "=" : `${delta > 0 ? "+" : ""}${delta}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Confronto non disponibile" description="Compare quando le schede approvate sono almeno due." />
          )}
        </Panel>

        <Panel title="Cronologia delle osservazioni" action={<Link href={`/osservazioni/nuova?atleta=${athlete.id}`} className="text-sm font-semibold underline">Nuova</Link>}>
          {observations.length ? (
            <Timeline
              items={observations.map((o) => ({ id: o.id, date: o.date, eventType: o.eventType, reviewStatus: o.reviewStatus, overall: o.overallSnapshot, scout: o.scout.name, minutes: o.minutes, team: o.team, opponent: o.opponent }))}
            />
          ) : (
            <EmptyState title="Nessuna osservazione" description="Compila la prima scheda dal campo o da video." />
          )}
        </Panel>

        <Panel title="Follow-up">
          {followUps.length === 0 ? <p className="muted mb-3 text-sm">Nessun follow-up pianificato.</p> : null}
          <ul className="mb-4 space-y-2">
            {followUps.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-prama-100 px-3 py-2 text-sm dark:border-prama-700">
                <span>
                  <strong>{FOLLOWUP_TYPE_LABELS[f.type]}</strong> · entro il {fmtDate(f.dueDate)}
                  {f.assignedTo ? ` · ${f.assignedTo.name}` : ""}
                  {f.note ? <span className="muted block text-xs">{f.note}</span> : null}
                  {f.outcome ? <span className="muted block text-xs">Esito: {f.outcome}</span> : null}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-prama-100 px-2 py-0.5 text-xs font-semibold dark:bg-prama-700">{FOLLOWUP_STATUS_LABELS[f.status]}</span>
                  {f.status === "APERTO" && (manage || f.assignedToId === user.id) ? <CloseFollowUp followUpId={f.id} canCancel={manage} /> : null}
                </span>
              </li>
            ))}
          </ul>
          {manage && !athlete.anonymizedAt ? <FollowUpForm athleteId={athlete.id} scouts={scouts} isAdmin={user.role === "ADMIN"} /> : null}
        </Panel>

        {manage && !athlete.anonymizedAt ? (
          <Panel title="Stato e priorità">
            <StatusPanel athleteId={athlete.id} status={athlete.status} interest={athlete.interest} nextCheckAt={iso(athlete.nextCheckAt)} assignedScoutId={athlete.assignedScoutId} scouts={scouts} />
          </Panel>
        ) : null}

        <Panel title="Consensi dei genitori/tutori">
          <ConsentPanel
            athleteId={athlete.id}
            canManage={manage && !athlete.anonymizedAt}
            items={consents.map((c) => ({ id: c.id, type: c.type, grantedBy: c.grantedBy, grantedAt: c.grantedAt.toISOString(), expiresAt: c.expiresAt?.toISOString() ?? null, revokedAt: c.revokedAt?.toISOString() ?? null, documentRef: c.documentRef }))}
          />
        </Panel>

        <div id="media" className="scroll-mt-4 lg:col-span-2">
          <Panel title="Video e media">
            <MediaPanel
              athleteId={athlete.id}
              canUpload={canUpload}
              canManage={manage}
              uploadBlockedReason={uploadBlockedReason}
              items={media.map((m) => ({ id: m.id, kind: m.kind, filename: m.filename, createdAt: m.createdAt.toISOString(), tags: m.tags, markers: Array.isArray(m.markers) ? (m.markers as { t: number; label: string }[]) : [], uploadedBy: m.uploadedBy.name }))}
            />
          </Panel>
        </div>

        {user.role === "ADMIN" ? (
          <div className="lg:col-span-2">
            <Panel title="Privacy e conservazione">
              <p className="mb-3 text-sm">
                Revisione della conservazione prevista entro il <strong>{fmtDate(athlete.reviewDueAt)}</strong>. Su richiesta dell&apos;interessato o
                alla scadenza, il profilo può essere anonimizzato o cancellato.
              </p>
              {athlete.anonymizedAt ? null : <PrivacyActions athleteId={athlete.id} code={athlete.code} />}
            </Panel>
          </div>
        ) : null}
      </div>
    </>
  );
}
