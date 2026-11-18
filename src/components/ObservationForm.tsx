"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { saveObservation } from "@/app/actions/observations";
import { ACTION_LABELS, CATEGORIES, EVENT_LABELS, INTEREST_LABELS, MATURATION_LABELS } from "@/lib/labels";
import { AREAS, ATTRIBUTES, ATTRIBUTE_LABELS } from "@/lib/rating";
import type { AthleteOption, ObservationFormValues } from "@/lib/observation-form";
import { observationSchema } from "@/lib/validation";
import { Alert } from "./ui";

const SCALE_HINT = "1 molto sotto la categoria · 2 sotto la media · 3 in linea · 4 sopra la media · 5 distintivo · N/V non valutabile";

function RatingInput({ name, label, value, onChange }: { name: string; label: string; value: number | null; onChange: (v: number | null) => void }) {
  const options: (number | null)[] = [1, 2, 3, 4, 5, null];
  return (
    <fieldset className="py-2">
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div className="grid grid-cols-6 gap-1.5">
        {options.map((option) => {
          const checked = value === option;
          const id = `${name}-${option ?? "nv"}`;
          return (
            <label
              key={id}
              htmlFor={id}
              className={`flex min-h-[44px] cursor-pointer items-center justify-center rounded-lg border text-sm font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent-500 ${
                checked
                  ? "border-prama-800 bg-prama-800 text-white dark:border-accent-500 dark:bg-accent-500 dark:text-prama-950"
                  : "border-prama-200 bg-white text-prama-800 hover:bg-prama-50 dark:border-prama-700 dark:bg-prama-950 dark:text-prama-100"
              }`}
            >
              <input id={id} type="radio" name={name} className="sr-only" checked={checked} onChange={() => onChange(option)} />
              {option ?? "N/V"}
              <span className="sr-only">{option === null ? " non valutabile" : " su 5"}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function ObservationForm({
  athletes,
  initial,
  observationId,
  reviewNote,
}: {
  athletes: AthleteOption[];
  initial: ObservationFormValues;
  observationId?: string;
  reviewNote?: string | null;
}) {
  const router = useRouter();
  const draftKey = `prama-bozza-${observationId ?? "nuova"}`;
  const [serverError, setServerError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<"draft" | "submit" | null>(null);
  const [restored, setRestored] = useState(false);
  const [savedId, setSavedId] = useState<string | undefined>(observationId);
  const [localSavedAt, setLocalSavedAt] = useState<string | null>(null);
  const ready = useRef(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<ObservationFormValues>({
    resolver: zodResolver(observationSchema) as unknown as Resolver<ObservationFormValues>,
    defaultValues: initial,
  });

  // Ripristino della bozza salvata sul dispositivo (utile dal campo, anche senza rete).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        reset({ ...initial, ...JSON.parse(raw) });
        setRestored(true);
      }
    } catch {}
    ready.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Salvataggio automatico locale a ogni modifica.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const subscription = watch((values) => {
      if (!ready.current) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          localStorage.setItem(draftKey, JSON.stringify(values));
          setLocalSavedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
        } catch {}
      }, 700);
    });
    return () => {
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [watch, draftKey]);

  const values = watch();
  const ratedCount = ATTRIBUTES.filter((a) => typeof values[a] === "number").length;

  const discardLocal = () => {
    try {
      localStorage.removeItem(draftKey);
    } catch {}
    reset(initial);
    setRestored(false);
    setLocalSavedAt(null);
  };

  async function submit(mode: "draft" | "submit", data: ObservationFormValues) {
    setPending(mode);
    setServerError(null);
    setMessage(null);
    const result = await saveObservation(data, mode, savedId);
    setPending(null);
    if (!result.ok) {
      setServerError(result.error);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const id = result.data!.id;
    setSavedId(id);
    try {
      localStorage.removeItem(draftKey);
    } catch {}
    if (mode === "submit") {
      router.push(`/osservazioni/${id}?esito=inviata`);
      router.refresh();
    } else {
      setMessage("Bozza salvata. Puoi completarla più tardi dalla dashboard.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const onInvalid = () => {
    setServerError("Alcuni campi vanno corretti: sono evidenziati in rosso.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const field = (name: keyof ObservationFormValues) => ({
    id: name,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
    ...register(name),
  });
  const FieldError = ({ name }: { name: keyof ObservationFormValues }) =>
    errors[name] ? (
      <p id={`${name}-error`} className="error">
        {String(errors[name]?.message ?? "Valore non valido")}
      </p>
    ) : null;

  return (
    <form noValidate onSubmit={handleSubmit((d) => submit("submit", d), onInvalid)} className="space-y-5">
      {reviewNote ? (
        <Alert tone="warn">
          <strong>Integrazione richiesta dal referente:</strong> {reviewNote}
        </Alert>
      ) : null}
      {restored ? (
        <Alert tone="info">
          Abbiamo ripristinato la bozza salvata su questo dispositivo.{" "}
          <button type="button" className="font-semibold underline" onClick={discardLocal}>
            Scarta e ricomincia
          </button>
        </Alert>
      ) : null}
      {serverError ? <Alert tone="error">{serverError}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}

      <section className="panel p-4 sm:p-5">
        <h2 className="mb-3 text-base font-semibold">1. Evento</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="athleteId" className="label">
              Atleta
            </label>
            <select
              {...field("athleteId")}
              className="input"
              onChange={(e) => {
                setValue("athleteId", e.target.value, { shouldValidate: true });
                const selected = athletes.find((a) => a.id === e.target.value);
                if (selected) {
                  if (!getValues("team")) setValue("team", selected.team);
                  if (!getValues("category")) setValue("category", selected.category);
                }
              }}
            >
              <option value="">Seleziona…</option>
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
            <FieldError name="athleteId" />
            <p className="hint">
              Atleta non in elenco?{" "}
              <a href="/atleti/nuovo" className="font-semibold underline">
                Crea prima il profilo
              </a>
              .
            </p>
          </div>
          <div>
            <label htmlFor="date" className="label">
              Data dell&apos;osservazione
            </label>
            <input type="date" {...field("date")} className="input" />
            <FieldError name="date" />
          </div>
          <div>
            <label htmlFor="eventType" className="label">
              Tipo di evento
            </label>
            <select {...field("eventType")} className="input">
              {Object.entries(EVENT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="team" className="label">
              Squadra osservata
            </label>
            <input {...field("team")} className="input" autoComplete="off" />
            <FieldError name="team" />
          </div>
          <div>
            <label htmlFor="opponent" className="label">
              Avversario <span className="muted font-normal">(facoltativo)</span>
            </label>
            <input {...field("opponent")} className="input" autoComplete="off" />
          </div>
          <div>
            <label htmlFor="category" className="label">
              Categoria
            </label>
            <select {...field("category")} className="input">
              <option value="">Seleziona…</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <FieldError name="category" />
          </div>
          <div>
            <label htmlFor="minutes" className="label">
              Minuti osservati
            </label>
            <input type="number" inputMode="numeric" min={1} max={200} {...field("minutes")} className="input" />
            <FieldError name="minutes" />
          </div>
          <div>
            <label htmlFor="competition" className="label">
              Competizione <span className="muted font-normal">(facoltativo)</span>
            </label>
            <input {...field("competition")} className="input" autoComplete="off" />
          </div>
          <div>
            <label htmlFor="venue" className="label">
              Sede <span className="muted font-normal">(facoltativo)</span>
            </label>
            <input {...field("venue")} className="input" autoComplete="off" />
          </div>
          <div>
            <label htmlFor="conditions" className="label">
              Meteo e campo <span className="muted font-normal">(se rilevanti)</span>
            </label>
            <input {...field("conditions")} className="input" autoComplete="off" />
          </div>
          <div>
            <label htmlFor="maturation" className="label">
              Maturazione apparente
            </label>
            <select {...field("maturation")} className="input">
              {Object.entries(MATURATION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <p className="hint">Aiuta il referente a leggere i voti fisici rispetto alla fase di crescita.</p>
          </div>
        </div>
      </section>

      <section className="panel p-4 sm:p-5">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">2. Valutazioni</h2>
          <p className="text-sm font-medium" aria-live="polite">
            {ratedCount} di 15 valutati
          </p>
        </div>
        <p className="hint mb-2">{SCALE_HINT}. Valuta solo ciò che hai visto.</p>
        {AREAS.map((area) => (
          <div key={area.key} className="border-t border-prama-100 pt-3 first:border-0 dark:border-prama-800">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-prama-500 dark:text-prama-300">{area.label}</h3>
            <div className="grid gap-x-6 sm:grid-cols-2">
              {area.attributes.map((attr) => (
                <Controller
                  key={attr}
                  control={control}
                  name={attr}
                  render={({ field: f }) => <RatingInput name={attr} label={ATTRIBUTE_LABELS[attr]} value={f.value ?? null} onChange={f.onChange} />}
                />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="panel p-4 sm:p-5">
        <h2 className="mb-3 text-base font-semibold">3. Sintesi</h2>
        <Alert tone="warn">
          Scrivi solo fatti sportivi osservati. Nessuna informazione sanitaria, familiare o scolastica. Scrivi come se il testo potesse
          essere letto dalla famiglia dell&apos;atleta.
        </Alert>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="strengths" className="label">
              Punti di forza <span className="muted font-normal">(max 5, uno per riga)</span>
            </label>
            <textarea rows={4} {...field("strengths")} className="input" />
            <FieldError name="strengths" />
          </div>
          <div>
            <label htmlFor="improvements" className="label">
              Aree di miglioramento <span className="muted font-normal">(max 5, una per riga)</span>
            </label>
            <textarea rows={4} {...field("improvements")} className="input" />
            <FieldError name="improvements" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="notes" className="label">
              Episodi e note <span className="muted font-normal">(minuto – fatto; obbligatori se assegni 1, 4 o 5)</span>
            </label>
            <textarea rows={3} {...field("notes")} className="input" />
            <FieldError name="notes" />
          </div>
          <div>
            <label htmlFor="interest" className="label">
              Livello di interesse proposto
            </label>
            <select {...field("interest")} className="input" value={values.interest ?? ""} onChange={(e) => setValue("interest", e.target.value || null)}>
              <option value="">Seleziona…</option>
              {Object.entries(INTEREST_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="action" className="label">
              Azione consigliata
            </label>
            <select {...field("action")} className="input" value={values.action ?? ""} onChange={(e) => setValue("action", e.target.value || null)}>
              <option value="">Seleziona…</option>
              {Object.entries(ACTION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="nextCheckSuggested" className="label">
              Data consigliata per il prossimo controllo
            </label>
            <input type="date" {...field("nextCheckSuggested")} className="input" />
          </div>
          <div className="flex items-start gap-3 pt-6">
            <input id="conflictOfInterest" type="checkbox" {...register("conflictOfInterest")} className="mt-1 h-5 w-5 rounded border-prama-300" />
            <label htmlFor="conflictOfInterest" className="text-sm">
              Ho un rapporto con l&apos;atleta o con il suo club (allenatore, dirigente, parente)
            </label>
          </div>
        </div>
      </section>

      <div className="sticky bottom-[56px] z-30 -mx-4 border-t border-prama-100 bg-white/95 px-4 py-3 backdrop-blur dark:border-prama-800 dark:bg-prama-900/95 lg:bottom-0 lg:mx-0 lg:rounded-xl lg:border">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="muted text-xs" aria-live="polite">
            {localSavedAt ? `Salvata su questo dispositivo alle ${localSavedAt}` : "Le modifiche si salvano da sole su questo dispositivo"}
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" disabled={pending !== null} onClick={handleSubmit((d) => submit("draft", d), onInvalid)}>
              {pending === "draft" ? "Salvataggio…" : "Salva bozza"}
            </button>
            <button type="submit" className="btn-primary" disabled={pending !== null}>
              {pending === "submit" ? "Invio…" : "Invia al referente"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
