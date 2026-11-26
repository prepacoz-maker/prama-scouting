import Link from "next/link";
import { notFound } from "next/navigation";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { fmtDate } from "@/lib/labels";
import { CONFIDENCE_LABELS, OUTCOME_LABELS, RATING_LABELS, computeStats, fmtClock, halfOf } from "@/lib/match";
import { loadMatchSession } from "@/lib/match-data";
import { PrintButton } from "@/components/PrintButton";
import { PageHeader } from "@/components/ui";
import { ReportForm } from "@/components/match/ReportForm";

export const metadata = { title: "Report match analysis" };

const NV = "NON VERIFICABILE DAL MATERIALE FORNITO";

function Text({ value, empty = "Da compilare." }: { value: string; empty?: string }) {
  return value.trim() ? <p className="whitespace-pre-line">{value}</p> : <p className="muted italic">{empty}</p>;
}
function Lines({ value }: { value: string }) {
  const rows = value.split("\n").map((r) => r.replace(/^\s*(\d+[.)]|[-•*])\s*/, "").trim()).filter(Boolean);
  return rows.length ? (
    <ol className="list-decimal pl-5">
      {rows.map((r, i) => (
        <li key={i}>{r}</li>
      ))}
    </ol>
  ) : (
    <p className="muted italic">Da compilare.</p>
  );
}

export default async function MatchReportPage({ params }: { params: { id: string } }) {
  const user = await requirePermission("match.manage");
  const data = await loadMatchSession(params.id);
  if (!data) notFound();
  const { session, events } = data;
  await audit(user.id, "MATCH_VIEW", "MatchSession", session.id, { view: "report" });
  const stats = computeStats(events, session.secondHalfSec);
  const sequences = events.filter((e) => e.rating || e.fact || e.inference || e.recommendation);
  const debrief = events.filter((e) => e.debrief).slice(0, 10);
  const hasHalves = session.secondHalfSec !== null;

  const rows: [string, string][] = [
    ["Atleta / squadra", session.athlete ? `${session.athlete.code} · ${session.team}` : session.team],
    ["Ruolo, posizione, compito tattico", session.roleTask || NV],
    ["Competizione, avversario, risultato", [session.competition, session.opponent && `vs ${session.opponent}`, session.score].filter(Boolean).join(" · ") || NV],
    ["Minutaggio dell'atleta", session.minutes !== null ? `${session.minutes}'` : NV],
    ["Obiettivo dell'analisi", session.objective],
    ["Livello", session.level || "—"],
    ["Materiale analizzato", `${session.videoSource === "FILE_LOCALE" ? "File video" : "Link video"}${session.durationSec ? `, durata ${fmtClock(session.durationSec)}` : ""}${session.videoAngle ? `, ${session.videoAngle}` : ""}`],
    ["Consenso verificato", `${session.consentId ? "Sì, consenso video registrato" : "Dichiarazione dell'analista"} · ${fmtDate(session.rightsConfirmedAt)}`],
    ["Analista", session.createdBy.name],
  ];

  return (
    <>
      <PageHeader
        title="Report match analysis"
        description="Bozza generata dagli episodi codificati e dal template PRAMA v1. Rileggi e completa prima della consegna."
        actions={
          <>
            <Link href={`/match-analysis/${session.id}`} className="btn-secondary">
              Torna all&apos;analisi
            </Link>
            <PrintButton />
          </>
        }
      />
      <ReportForm
        id={session.id}
        initial={{
          summary: session.summary,
          strengths: session.strengths,
          improvements: session.improvements,
          mainRecommendation: session.mainRecommendation,
          patterns: session.patterns,
          plan: session.plan,
          questions: session.questions,
          limits: session.limits,
          athleteFeedback: session.athleteFeedback,
          status: session.status,
        }}
      />

      <article className="panel prose-report grid gap-5 p-5 text-sm leading-relaxed print:border-0 print:shadow-none sm:p-8">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-prama-500">PRAMA Talent Management · Documento riservato</p>
          <h2 className="mt-1 text-xl font-bold">
            Match Analysis · {session.athlete ? session.athlete.code : session.team} · {session.competition ? `${session.competition} ` : ""}vs {session.opponent || "—"} · {fmtDate(session.date)}
          </h2>
        </header>
        <table className="w-full border-collapse text-sm">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k} className="border-t border-prama-100 dark:border-prama-800">
                <th className="w-1/3 py-1.5 pr-3 text-left font-semibold">{k}</th>
                <td className="py-1.5">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs">
          <strong>Legenda:</strong> [FATTO] ciò che è visibile nel video · [INFERENZA] interpretazione tattica ragionata · [RACCOMANDAZIONE] proposta operativa · {NV} per ogni dato non osservabile.
        </p>

        <section>
          <h3 className="text-base font-bold">1. Executive summary</h3>
          <Text value={session.summary} />
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="font-semibold">Punti di forza</p>
              <Lines value={session.strengths} />
            </div>
            <div>
              <p className="font-semibold">Margini di miglioramento prioritari</p>
              <Lines value={session.improvements} />
            </div>
          </div>
          <p className="mt-2 font-semibold">Raccomandazione principale</p>
          <Text value={session.mainRecommendation} />
        </section>

        <section>
          <h3 className="text-base font-bold">2. Profilo</h3>
          <p>Ruolo e compiti osservati: {session.roleTask || NV}</p>
          <p className="muted text-xs">La griglia standard PRAMA (1-5 + N/V) si compila nella scheda di osservazione dell&apos;atleta con fonte «video»: i voti 1, 4 e 5 devono citare un episodio con timestamp.</p>
        </section>

        <section>
          <h3 className="text-base font-bold">3. KPI osservati</h3>
          <p className="muted text-xs">Solo dati ricavati dagli episodi codificati. Percentuali solo dove riuscito e sbagliato sono entrambi codificati.</p>
          {stats.total ? (
            <table className="mt-2 w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-prama-500">
                  <th className="py-1">Indicatore</th>
                  <th className="py-1 text-right">Valore</th>
                  {hasHalves ? <th className="py-1 text-right">1° / 2° tempo</th> : null}
                </tr>
              </thead>
              <tbody>
                {stats.byCode.map((s) => (
                  <tr key={s.code} className="border-t border-prama-100 dark:border-prama-800">
                    <td className="py-1">{s.label}</td>
                    <td className="py-1 text-right tabular-nums">{s.total}</td>
                    {hasHalves ? (
                      <td className="py-1 text-right tabular-nums">
                        {s.first} / {s.second}
                      </td>
                    ) : null}
                  </tr>
                ))}
                {stats.pairs.map((p) => (
                  <tr key={p.label} className="border-t border-prama-100 font-semibold dark:border-prama-800">
                    <td className="py-1">{p.label}: riuscita</td>
                    <td className="py-1 text-right tabular-nums">
                      {p.ok}/{p.ok + p.ko} ({p.pct}%)
                    </td>
                    {hasHalves ? <td /> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted italic">Nessun episodio codificato.</p>
          )}
        </section>

        <section>
          <h3 className="text-base font-bold">4. Analisi per sequenze</h3>
          {sequences.length ? (
            <div className="grid gap-3">
              {sequences.map((e, i) => (
                <div key={e.id} className="break-inside-avoid border-l-4 border-prama-200 pl-3 dark:border-prama-700">
                  <p className="font-semibold">
                    Sequenza {i + 1} · {fmtClock(e.startSec)}–{fmtClock(e.endSec)}
                    {hasHalves ? ` (${halfOf(e.timeSec, session.secondHalfSec)}° tempo)` : ""} · {e.label}
                    {e.outcome ? ` · ${OUTCOME_LABELS[e.outcome].toLowerCase()}` : ""}
                  </p>
                  {e.phase ? <p>Fase di gioco: {e.phase}</p> : null}
                  <p>
                    <strong>[FATTO]</strong> {e.fact || NV}
                  </p>
                  {e.inference ? (
                    <p>
                      <strong>[INFERENZA]</strong> {e.inference}
                    </p>
                  ) : null}
                  {e.recommendation ? (
                    <p>
                      <strong>[RACCOMANDAZIONE]</strong> {e.recommendation}
                    </p>
                  ) : null}
                  <p>
                    Giudizio: <strong>{e.rating ? RATING_LABELS[e.rating].toUpperCase() : "—"}</strong> · Confidenza: {e.confidence ? CONFIDENCE_LABELS[e.confidence].toUpperCase() : "—"}
                    {e.debrief ? " · clip per il debrief" : ""}
                    {e.drawing?.length ? " · con disegno" : ""}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted italic">Nessuna sequenza commentata: aggiungi giudizio, fatto o inferenza agli episodi.</p>
          )}
        </section>

        <section>
          <h3 className="text-base font-bold">5. Pattern ricorrenti</h3>
          <Text value={session.patterns} />
        </section>
        <section>
          <h3 className="text-base font-bold">6. Piano di miglioramento (4 settimane)</h3>
          <Text value={session.plan} />
        </section>
        <section>
          <h3 className="text-base font-bold">7. Clip list per il debrief</h3>
          {debrief.length ? (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-prama-500">
                  <th className="py-1">#</th>
                  <th className="py-1">Timestamp</th>
                  <th className="py-1">Episodio</th>
                  <th className="py-1">Messaggio chiave</th>
                </tr>
              </thead>
              <tbody>
                {debrief.map((e, i) => (
                  <tr key={e.id} className="border-t border-prama-100 dark:border-prama-800">
                    <td className="py-1">{i + 1}</td>
                    <td className="py-1 font-mono">
                      {fmtClock(e.startSec)}–{fmtClock(e.endSec)}
                    </td>
                    <td className="py-1">{e.label}</td>
                    <td className="py-1">{e.recommendation || e.inference || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted italic">Nessuna clip segnata per il debrief.</p>
          )}
        </section>
        <section>
          <h3 className="text-base font-bold">8. Domande per l&apos;atleta</h3>
          <Lines value={session.questions} />
        </section>
        <section>
          <h3 className="text-base font-bold">Output finale</h3>
          <p className="font-semibold">Rischi o limiti dell&apos;analisi</p>
          <Text value={session.limits} />
          <p className="mt-2 font-semibold">Feedback sintetico per l&apos;atleta</p>
          <Text value={session.athleteFeedback} />
        </section>
        <p className="border-t border-prama-100 pt-3 text-xs italic dark:border-prama-800">
          Analisi basata esclusivamente sul materiale video fornito. Non costituisce valutazione medica né previsione di carriera. Documento riservato: non diffondere senza autorizzazione di PRAMA Talent Management.
        </p>
      </article>
    </>
  );
}
