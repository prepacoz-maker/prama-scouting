import Link from "next/link";
import { ATTRIBUTE_LABELS, AREAS } from "@/lib/rating";
import type { AthleteCardData } from "@/lib/athlete-view";
import { EVENT_LABELS, FOOT_LABELS, RELIABILITY_LABELS, fmtDate } from "@/lib/labels";
import { AttributeBar, BadgeChip, StatusTag } from "./ui";
import { RadarChart } from "./charts";

function Avatar({ label, photoId, size = "lg" }: { label: string; photoId?: string | null; size?: "lg" | "sm" }) {
  const dim = size === "lg" ? "h-20 w-20 text-xl" : "h-12 w-12 text-sm";
  if (photoId) {
    // eslint-disable-next-line @next/next/no-img-element -- immagine protetta servita da route autenticata
    return <img src={`/api/media/${photoId}`} alt="" className={`${dim} rounded-lg border-2 border-white/30 object-cover`} />;
  }
  const initials = label.startsWith("A-") ? label.slice(-4) : label.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div aria-hidden="true" className={`${dim} flex items-center justify-center rounded-lg border-2 border-white/25 bg-white/10 font-display font-bold tracking-wider text-white`}>
      {initials}
    </div>
  );
}

function Score({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg bg-white/10 px-3 py-2 text-center ring-1 ring-inset ring-white/15">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">{label}</p>
      <p className="font-display text-3xl font-bold leading-tight tabular-nums text-white">{value}</p>
      {note ? <p className="text-[11px] text-white/70">{note}</p> : null}
    </div>
  );
}

/** Player Card PRAMA: sintesi leggibile del profilo, calcolata dalle sole schede approvate. */
export function AthleteCard({ data, showActions = true }: { data: AthleteCardData; showActions?: boolean }) {
  const { athlete: a } = data;
  const potential = a.potentialMin !== null && a.potentialMax !== null ? `${a.potentialMin}–${a.potentialMax}` : "—";
  const meta = [
    a.birthYear ? `Nato/a nel ${a.birthYear}` : null,
    `Piede: ${FOOT_LABELS[a.foot]}`,
    a.heightCm ? `${a.heightCm} cm` : null,
    a.weightKg ? `${a.weightKg} kg` : null,
  ].filter(Boolean);

  return (
    <article className="panel overflow-hidden" aria-label={`Player Card di ${data.displayName}`}>
      {/* Intestazione */}
      <div className="relative bg-prama-800 px-4 pb-4 pt-4 text-white sm:px-6">
        <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 bg-accent-500" />
        <div className="flex flex-wrap items-start gap-4">
          <Avatar label={data.displayName} photoId={data.photoId} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-display text-2xl font-bold">{data.displayName}</h2>
              <StatusTag status={a.status} compact />
            </div>
            {data.hasIdentity ? <p className="text-sm text-white/70">Codice {a.code}</p> : null}
            <p className="mt-1 text-sm text-white/90">
              <span className="font-semibold">{a.primaryRole}</span>
              {a.secondaryRoles.length ? <span className="text-white/70"> · anche {a.secondaryRoles.join(", ")}</span> : null}
            </p>
            <p className="text-sm text-white/80">
              {a.team} · {a.category} · Zona {a.zone.code} {a.zone.name}
            </p>
            <p className="mt-1 text-xs text-white/70">{meta.join(" · ")}</p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:min-w-[15rem]">
            <Score label="Overall PRAMA" value={a.overall !== null ? String(a.overall) : "—"} note="scala 40–99" />
            <Score label="Potenziale" value={potential} note="stima prudente" />
          </div>
        </div>
      </div>

      {/* Affidabilità: sempre visibile */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-prama-100 bg-prama-50 px-4 py-2.5 text-sm dark:border-prama-800 dark:bg-prama-800/60 sm:px-6">
        <span>
          Affidabilità: <strong>{RELIABILITY_LABELS[a.reliability]}</strong>
        </span>
        <span>
          Osservazioni approvate: <strong>{a.observationsCount}</strong>
        </span>
        <span>
          Ultima osservazione: <strong>{fmtDate(a.lastObservedAt)}</strong>
        </span>
        {data.needsCheck ? (
          <span className="rounded-md bg-accent-400/25 px-2 py-0.5 font-semibold text-prama-900 dark:text-accent-400">
            Serve un nuovo controllo{a.nextCheckAt ? ` · previsto il ${fmtDate(a.nextCheckAt)}` : ""}
          </span>
        ) : null}
      </div>

      {a.observationsCount === 0 ? (
        <p className="px-4 py-8 text-center text-sm sm:px-6">
          Nessuna scheda approvata: la Player Card si compila dopo la prima valutazione del referente.
        </p>
      ) : (
        <div className="grid gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-prama-500 dark:text-prama-300">Competenze</h3>
            <RadarChart data={data.areas} />
            {data.areas.some((x) => x.first !== null) ? (
              <p className="muted text-center text-xs">Linea tratteggiata: prima osservazione</p>
            ) : null}

            <h3 className="mt-4 text-sm font-semibold uppercase tracking-wide text-prama-500 dark:text-prama-300">Punti di forza</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {data.badges.length ? (
                data.badges.map((b) => <BadgeChip key={b.key} label={b.label} description={b.description} />)
              ) : (
                <p className="muted text-sm">I badge si assegnano da due osservazioni approvate in poi.</p>
              )}
            </div>

            <h3 className="mt-4 text-sm font-semibold uppercase tracking-wide text-prama-500 dark:text-prama-300">Aree di sviluppo</h3>
            <ul className="mt-2 flex flex-wrap gap-2">
              {data.development.length ? (
                data.development.map((d) => (
                  <li key={d} className="rounded-md border border-prama-200 px-2 py-1 text-xs font-medium dark:border-prama-700">
                    {ATTRIBUTE_LABELS[d]}
                  </li>
                ))
              ) : (
                <li className="muted text-sm">Nessuna area sotto la media della categoria.</li>
              )}
            </ul>
          </div>

          <div className="space-y-4">
            {AREAS.map((area) => (
              <div key={area.key}>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-prama-500 dark:text-prama-300">{area.label}</h3>
                <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
                  {area.attributes.map((attr) => (
                    <AttributeBar
                      key={attr}
                      label={ATTRIBUTE_LABELS[attr]}
                      value={data.averages[attr]}
                      previous={data.comparison?.find((c) => c.attribute === attr)?.first ?? null}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mini-timeline e azioni */}
      <div className="border-t border-prama-100 px-4 py-4 dark:border-prama-800 sm:px-6">
        {data.timeline.length ? (
          <ol className="flex gap-2 overflow-x-auto pb-1" aria-label="Cronologia delle osservazioni">
            {data.timeline.map((t) => (
              <li key={t.id} className="shrink-0 rounded-lg border border-prama-100 px-3 py-1.5 text-xs dark:border-prama-700">
                <span className="font-semibold">{fmtDate(t.date)}</span>
                <span className="muted"> · {EVENT_LABELS[t.eventType]}</span>
                {t.overall !== null ? <span className="ml-2 rounded bg-prama-100 px-1.5 py-0.5 font-bold tabular-nums dark:bg-prama-700">{t.overall}</span> : null}
              </li>
            ))}
          </ol>
        ) : null}
        {showActions ? (
          <div className="no-print mt-3 flex flex-wrap gap-2">
            {data.lastObservationId ? (
              <Link href={`/osservazioni/${data.lastObservationId}`} className="btn-secondary btn-sm">
                Ultima scheda
              </Link>
            ) : null}
            {data.latestVideoId ? (
              <a href="#media" className="btn-secondary btn-sm">
                Video
              </a>
            ) : null}
            <Link href={`/atleti/${a.id}/card`} className="btn-secondary btn-sm">
              Report stampabile
            </Link>
            <Link href={`/osservazioni/nuova?atleta=${a.id}`} className="btn-primary btn-sm">
              Nuova osservazione
            </Link>
          </div>
        ) : null}
        <p className="muted mt-3 text-xs">
          Valori riferiti alla categoria osservata e calcolati sulle ultime {5} schede approvate. Il potenziale è una stima prudente
          a uso interno: non è una previsione né una promessa di carriera. Documento riservato PRAMA: vietata la condivisione esterna.
        </p>
      </div>
    </article>
  );
}

/** Card compatta per la vista a griglia dell'archivio. */
export function AthleteCardCompact({
  athlete,
  displayName,
}: {
  athlete: {
    id: string; code: string; primaryRole: string; team: string; category: string; status: string; overall: number | null;
    potentialMin: number | null; potentialMax: number | null; reliability: string; observationsCount: number;
    lastObservedAt: Date | null; birthYear: number | null; zone: { code: string };
  };
  displayName: string;
}) {
  return (
    <Link href={`/atleti/${athlete.id}`} className="panel block overflow-hidden transition-shadow hover:shadow-lg">
      <div className="relative flex items-center gap-3 bg-prama-800 px-4 py-3 text-white">
        <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-accent-500" />
        <Avatar label={displayName} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-bold">{displayName}</p>
          <p className="truncate text-xs text-white/75">
            {athlete.primaryRole} · {athlete.team}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl font-bold leading-none tabular-nums">{athlete.overall ?? "—"}</p>
          <p className="text-[10px] uppercase tracking-wider text-white/70">Overall</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs">
        <StatusTag status={athlete.status} compact />
        <span className="muted">
          Zona {athlete.zone.code} · {athlete.category}
          {athlete.birthYear ? ` · ${athlete.birthYear}` : ""}
        </span>
        <span className="muted w-full">
          Potenziale {athlete.potentialMin !== null ? `${athlete.potentialMin}–${athlete.potentialMax}` : "non stimabile"} · Affidabilità{" "}
          {RELIABILITY_LABELS[athlete.reliability].toLowerCase()} · {athlete.observationsCount} oss. · ultima {fmtDate(athlete.lastObservedAt)}
        </span>
      </div>
    </Link>
  );
}
