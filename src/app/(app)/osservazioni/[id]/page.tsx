import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canEditObservation, canReviewObservation, canViewAthlete } from "@/lib/permissions";
import { ATTRIBUTE_LABELS, areasFor, isGoalkeeper } from "@/lib/rating";
import { MISMATCH_LABELS, MISMATCH_TYPE_LABELS } from "@/lib/standard";
import { ACTION_LABELS, EVENT_LABELS, INTEREST_LABELS, MATURATION_LABELS, REVIEW_LABELS, fmtDate, fmtDateTime } from "@/lib/labels";
import { DeleteDraftButton, ReviewPanel } from "@/components/panels";
import { Alert, AttributeBar, PageHeader, Panel, Pill } from "@/components/ui";

export const metadata = { title: "Scheda di osservazione" };

const lines = (text: string) => text.split("\n").map((l) => l.replace(/^[•\-\s]+/, "").trim()).filter(Boolean);

export default async function ObservationPage({ params, searchParams }: { params: { id: string }; searchParams: { esito?: string } }) {
  const user = await requireUser();
  const obs = await db.observation.findUnique({
    where: { id: params.id },
    include: { athlete: { include: { zone: true } }, scout: { select: { name: true } }, reviewedBy: { select: { name: true } } },
  });
  if (!obs || !canViewAthlete(user, obs.athlete)) notFound();
  // Una scheda non approvata è visibile solo a chi l'ha scritta e a chi la valuta.
  const isAuthor = obs.scoutId === user.id;
  if (obs.reviewStatus !== "APPROVATA" && !isAuthor && (user.role === "SCOUT" || obs.reviewStatus === "BOZZA")) notFound();

  const editable = canEditObservation(user, obs);
  const reviewable = canReviewObservation(user, obs);
  const facts: [string, string][] = [
    ["Data", fmtDate(obs.date)],
    ["Evento", EVENT_LABELS[obs.eventType]],
    ["Squadra", `${obs.team}${obs.opponent ? ` – ${obs.opponent}` : ""}`],
    ["Categoria", obs.category],
    ["Competizione", obs.competition ?? "—"],
    ["Sede", obs.venue ?? "—"],
    ["Minuti osservati", `${obs.minutes}′`],
    ["Meteo e campo", obs.conditions ?? "—"],
    ["Maturazione apparente", MATURATION_LABELS[obs.maturation]],
    ["Scout", obs.scout.name],
    ["Zona", `${obs.athlete.zone.code} ${obs.athlete.zone.name}`],
    ["Scheda", isGoalkeeper(obs.athlete.roleGroup) ? `Portiere (standard ${obs.standardVersion})` : `Movimento (standard ${obs.standardVersion})`],
  ];
  if (!isGoalkeeper(obs.athlete.roleGroup))
    facts.push([
      "Mismatch",
      obs.mismatch ? `${MISMATCH_LABELS[obs.mismatch]}${obs.mismatchType ? ` · ${MISMATCH_TYPE_LABELS[obs.mismatchType]}` : ""}` : "—",
    ]);

  return (
    <>
      <PageHeader
        title={`Scheda · ${obs.athlete.code}`}
        description={`${EVENT_LABELS[obs.eventType]} del ${fmtDate(obs.date)}`}
        actions={
          <>
            <Link href={`/atleti/${obs.athleteId}`} className="btn-secondary">
              Profilo atleta
            </Link>
            {editable ? (
              <Link href={`/osservazioni/${obs.id}/modifica`} className="btn-primary">
                {obs.reviewStatus === "BOZZA" ? "Completa la bozza" : "Integra la scheda"}
              </Link>
            ) : null}
          </>
        }
      />

      <div className="space-y-4">
        {searchParams.esito === "inviata" ? <Alert tone="success">Scheda inviata al referente di zona. Riceverai l&apos;esito della valutazione.</Alert> : null}
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={obs.reviewStatus}>{REVIEW_LABELS[obs.reviewStatus]}</Pill>
          {obs.overallSnapshot !== null ? <Pill>Overall della scheda {obs.overallSnapshot}</Pill> : null}
          {obs.conflictOfInterest ? <Pill tone="INTEGRAZIONE_RICHIESTA">Conflitto di interesse dichiarato</Pill> : null}
          {obs.reviewedBy && obs.reviewedAt ? <span className="muted text-sm">Valutata da {obs.reviewedBy.name} il {fmtDateTime(obs.reviewedAt)}</span> : null}
        </div>
        {obs.reviewNote ? (
          <Alert tone={obs.reviewStatus === "INTEGRAZIONE_RICHIESTA" ? "warn" : "info"}>
            <strong>Nota del referente:</strong> {obs.reviewNote}
          </Alert>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <Panel title="Evento">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              {facts.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="muted">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="Valutazioni">
            <div className="space-y-4">
              {areasFor(obs.athlete.roleGroup).map((area) => (
                <div key={area.key}>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-prama-500 dark:text-prama-300">{area.label}</h3>
                  <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
                    {area.attributes.map((attr) => (
                      <AttributeBar key={attr} label={ATTRIBUTE_LABELS[attr]} value={obs[attr]} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Panel title="Punti di forza">
            {lines(obs.strengths).length ? <ul className="list-disc space-y-1 pl-5 text-sm">{lines(obs.strengths).map((l, i) => <li key={i}>{l}</li>)}</ul> : <p className="muted text-sm">Non indicati.</p>}
          </Panel>
          <Panel title="Aree di miglioramento">
            {lines(obs.improvements).length ? <ul className="list-disc space-y-1 pl-5 text-sm">{lines(obs.improvements).map((l, i) => <li key={i}>{l}</li>)}</ul> : <p className="muted text-sm">Non indicate.</p>}
          </Panel>
        </div>

        <Panel title="Sintesi dello scout">
          {obs.notes ? <p className="mb-3 whitespace-pre-line text-sm">{obs.notes}</p> : null}
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="muted">Interesse proposto</dt>
              <dd className="font-semibold">{obs.interest ? INTEREST_LABELS[obs.interest] : "—"}</dd>
            </div>
            <div>
              <dt className="muted">Azione consigliata</dt>
              <dd className="font-semibold">{obs.action ? ACTION_LABELS[obs.action] : "—"}</dd>
            </div>
            <div>
              <dt className="muted">Prossimo controllo consigliato</dt>
              <dd className="font-semibold">{fmtDate(obs.nextCheckSuggested)}</dd>
            </div>
          </dl>
        </Panel>

        {reviewable ? (
          <Panel title="Valutazione del referente">
            <ReviewPanel observationId={obs.id} />
          </Panel>
        ) : null}
        {obs.reviewStatus === "BOZZA" && isAuthor ? <DeleteDraftButton observationId={obs.id} /> : null}
      </div>
    </>
  );
}
