"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createMatchSession } from "@/app/actions/match";
import { Alert } from "@/components/ui";

interface AthleteOption {
  id: string;
  label: string;
  team: string;
  roleGroup: string;
  primaryRole: string;
  category: string;
  hasVideoConsent: boolean;
}

const LEVELS = ["Professionista", "Giovane élite", "Settore giovanile", "Semi-professionista"];

export function NewSessionForm({ athletes, templates, preselected }: { athletes: AthleteOption[]; templates: { key: string; label: string; sport: string }[]; preselected: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const initialAthlete = athletes.find((a) => a.id === preselected) ?? null;
  const [f, setF] = useState({
    title: "",
    template: initialAthlete?.roleGroup === "PORTIERE" ? "calcio_portiere" : "calcio_movimento",
    date: new Date().toISOString().slice(0, 10),
    competition: initialAthlete?.category ?? "",
    team: initialAthlete?.team ?? "",
    opponent: "",
    score: "",
    athleteId: initialAthlete?.id ?? "",
    roleTask: initialAthlete?.primaryRole ?? "",
    objective: "",
    level: "",
    minutes: "",
    videoSource: "FILE_LOCALE" as "FILE_LOCALE" | "LINK",
    videoLabel: "",
    videoUrl: "",
    videoAngle: "",
    rightsConfirmed: false,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const athlete = useMemo(() => athletes.find((a) => a.id === f.athleteId) ?? null, [athletes, f.athleteId]);

  const pickAthlete = (id: string) => {
    const a = athletes.find((x) => x.id === id);
    setF((p) => ({
      ...p,
      athleteId: id,
      team: a?.team ?? p.team,
      roleTask: p.roleTask || a?.primaryRole || "",
      competition: p.competition || a?.category || "",
      template: a?.roleGroup === "PORTIERE" ? "calcio_portiere" : a ? "calcio_movimento" : p.template,
    }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const tpl = templates.find((t) => t.key === f.template);
    start(async () => {
      const res = await createMatchSession({
        ...f,
        sport: tpl?.sport ?? "CALCIO",
        athleteId: f.athleteId || null,
        minutes: f.minutes ? Number(f.minutes) : null,
        title: f.title || `${f.team}${f.opponent ? ` vs ${f.opponent}` : ""}`,
      });
      if (!res.ok) return setError(res.error);
      router.push(`/match-analysis/${(res.data as { id: string }).id}`);
    });
  };

  const field = "grid gap-1";
  return (
    <form onSubmit={submit} className="panel grid gap-5 p-4 sm:p-6">
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-base font-semibold">Atleta e partita</legend>
        <label className={`${field} sm:col-span-2`}>
          <span className="label">Atleta analizzato (facoltativo: senza atleta l&apos;analisi riguarda la squadra)</span>
          <select className="input" value={f.athleteId} onChange={(e) => pickAthlete(e.target.value)}>
            <option value="">Nessun atleta specifico</option>
            {athletes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
                {a.hasVideoConsent ? "" : " · manca consenso video"}
              </option>
            ))}
          </select>
          {athlete && !athlete.hasVideoConsent ? (
            <span className="error">Manca un consenso VIDEO valido: registralo nella scheda dell&apos;atleta prima di aprire l&apos;analisi.</span>
          ) : null}
        </label>
        <label className={field}>
          <span className="label">Squadra *</span>
          <input className="input" required value={f.team} onChange={(e) => set("team", e.target.value)} />
        </label>
        <label className={field}>
          <span className="label">Avversario</span>
          <input className="input" value={f.opponent} onChange={(e) => set("opponent", e.target.value)} />
        </label>
        <label className={field}>
          <span className="label">Data *</span>
          <input className="input" type="date" required value={f.date} onChange={(e) => set("date", e.target.value)} />
        </label>
        <label className={field}>
          <span className="label">Competizione</span>
          <input className="input" value={f.competition} onChange={(e) => set("competition", e.target.value)} />
        </label>
        <label className={field}>
          <span className="label">Risultato</span>
          <input className="input" placeholder="es. 1-1" value={f.score} onChange={(e) => set("score", e.target.value)} />
        </label>
        <label className={field}>
          <span className="label">Minuti giocati dall&apos;atleta</span>
          <input className="input" type="number" min={0} max={200} value={f.minutes} onChange={(e) => set("minutes", e.target.value)} />
        </label>
        <label className={`${field} sm:col-span-2`}>
          <span className="label">Titolo dell&apos;analisi</span>
          <input className="input" placeholder="Se vuoto: squadra vs avversario" value={f.title} onChange={(e) => set("title", e.target.value)} />
        </label>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-base font-semibold">Obiettivo</legend>
        <label className={`${field} sm:col-span-2`}>
          <span className="label">Ruolo, posizione e compito tattico</span>
          <input className="input" value={f.roleTask} onChange={(e) => set("roleTask", e.target.value)} />
        </label>
        <label className={`${field} sm:col-span-2`}>
          <span className="label">Obiettivo dell&apos;analisi *</span>
          <input className="input" required placeholder="es. tecnica in possesso e decision-making negli ultimi 30 metri" value={f.objective} onChange={(e) => set("objective", e.target.value)} />
        </label>
        <label className={field}>
          <span className="label">Livello</span>
          <select className="input" value={f.level} onChange={(e) => set("level", e.target.value)}>
            <option value="">—</option>
            {LEVELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        <label className={field}>
          <span className="label">Pannello di codifica</span>
          <select className="input" value={f.template} onChange={(e) => set("template", e.target.value)}>
            {templates.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
          <span className="hint">Potrai rinominare, aggiungere o togliere pulsanti dentro l&apos;analisi.</span>
        </label>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-base font-semibold">Video</legend>
        <div className="flex flex-wrap gap-2 sm:col-span-2" role="radiogroup" aria-label="Origine del video">
          {(["FILE_LOCALE", "LINK"] as const).map((src) => (
            <button
              key={src}
              type="button"
              role="radio"
              aria-checked={f.videoSource === src}
              onClick={() => set("videoSource", src)}
              className={f.videoSource === src ? "btn-primary" : "btn-secondary"}
            >
              {src === "FILE_LOCALE" ? "File sul mio computer" : "Link (YouTube o file video online)"}
            </button>
          ))}
        </div>
        {f.videoSource === "FILE_LOCALE" ? (
          <label className={`${field} sm:col-span-2`}>
            <span className="label">File video *</span>
            <input
              className="input"
              type="file"
              accept="video/*"
              onChange={(e) => set("videoLabel", e.target.files?.[0]?.name ?? "")}
            />
            <span className="hint">Il file non viene caricato: salviamo solo il nome, per riconoscerlo quando riapri l&apos;analisi.</span>
          </label>
        ) : (
          <>
            <label className={`${field} sm:col-span-2`}>
              <span className="label">Link del video *</span>
              <input className="input" type="url" placeholder="https://www.youtube.com/watch?v=..." value={f.videoUrl} onChange={(e) => set("videoUrl", e.target.value)} />
            </label>
            <label className={`${field} sm:col-span-2`}>
              <span className="label">Descrizione del link *</span>
              <input className="input" placeholder="es. canale del club, partita intera" value={f.videoLabel} onChange={(e) => set("videoLabel", e.target.value)} />
            </label>
          </>
        )}
        <label className={`${field} sm:col-span-2`}>
          <span className="label">Angolo di ripresa e qualità</span>
          <input className="input" placeholder="es. tattica larga dalla tribuna, 1080p" value={f.videoAngle} onChange={(e) => set("videoAngle", e.target.value)} />
        </label>
      </fieldset>

      <label className="flex items-start gap-3 rounded-lg border border-prama-200 p-3 dark:border-prama-700">
        <input type="checkbox" className="mt-1 h-5 w-5" checked={f.rightsConfirmed} onChange={(e) => set("rightsConfirmed", e.target.checked)} />
        <span className="text-sm">
          Confermo che il video può essere usato per l&apos;analisi interna (diritti verificati con club, emittente o chi lo ha ripreso) e che i consensi sono
          stati verificati. Compagni e avversari non saranno nominati né valutati.
        </span>
      </label>

      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="flex justify-end">
        <button className="btn-primary" disabled={pending || (!!athlete && !athlete.hasVideoConsent)}>
          {pending ? "Creazione…" : "Apri l'analisi"}
        </button>
      </div>
    </form>
  );
}
