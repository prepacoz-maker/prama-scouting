"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createUser, createZone, saveRetention, saveWeights, setScoutUpload, setUserActive, toggleZone } from "@/app/actions/admin";
import type { ActionResult } from "@/app/actions/result";
import { ROLE_GROUP_LABELS, ROLE_LABELS } from "@/lib/labels";
import { ATTRIBUTES, ATTRIBUTE_LABELS, type Attribute } from "@/lib/rating";
import { Alert } from "./ui";

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState<{ error?: string; ok?: string }>({});
  const run = (action: () => Promise<ActionResult>, ok: string, after?: () => void) =>
    start(async () => {
      setState({});
      const result = await action();
      if (!result.ok) return setState({ error: result.error });
      setState({ ok });
      after?.();
      router.refresh();
    });
  const feedback = state.error ? <Alert tone="error">{state.error}</Alert> : state.ok ? <Alert tone="success">{state.ok}</Alert> : null;
  return { run, pending, feedback };
}

export function ZoneForm() {
  const { run, pending, feedback } = useAction();
  const [form, setForm] = useState({ code: "", name: "" });
  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => createZone(form), "Zona creata.", () => setForm({ code: "", name: "" }));
      }}
    >
      {feedback}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="zone-code" className="label">
            Codice
          </label>
          <input id="zone-code" className="input w-24" placeholder="Z04" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
        </div>
        <div className="min-w-[10rem] flex-1">
          <label htmlFor="zone-name" className="label">
            Nome
          </label>
          <input id="zone-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <button type="submit" className="btn-primary" disabled={pending}>
          Aggiungi zona
        </button>
      </div>
    </form>
  );
}

export function Toggle({ kind, id, value, label }: { kind: "zone" | "user" | "upload"; id: string; value: boolean; label: string }) {
  const { run, pending, feedback } = useAction();
  const action = () => (kind === "zone" ? toggleZone(id, !value) : kind === "user" ? setUserActive(id, !value) : setScoutUpload(id, !value));
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" role="switch" aria-checked={value} aria-label={label} disabled={pending} onClick={() => run(action, "Aggiornato.")} className={`relative h-7 w-12 rounded-full transition-colors ${value ? "bg-campo-500" : "bg-prama-200 dark:bg-prama-700"}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${value ? "left-[22px]" : "left-0.5"}`} />
      </button>
      {feedback && "props" in feedback && feedback.props.tone === "error" ? feedback : null}
    </span>
  );
}

export function UserForm({ zones }: { zones: { id: string; label: string }[] }) {
  const { run, pending, feedback } = useAction();
  const blank = { name: "", email: "", role: "SCOUT", zoneId: zones[0]?.id ?? "", password: "", canUploadMedia: false };
  const [form, setForm] = useState(blank);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [key]: e.target.value });
  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => createUser(form), "Utente creato. Comunicare la password in modo riservato.", () => setForm(blank));
      }}
    >
      {feedback}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label htmlFor="u-name" className="label">
            Nome e cognome
          </label>
          <input id="u-name" className="input" value={form.name} onChange={set("name")} autoComplete="off" />
        </div>
        <div>
          <label htmlFor="u-email" className="label">
            Email
          </label>
          <input id="u-email" type="email" className="input" value={form.email} onChange={set("email")} autoComplete="off" />
        </div>
        <div>
          <label htmlFor="u-role" className="label">
            Ruolo
          </label>
          <select id="u-role" className="input" value={form.role} onChange={set("role")}>
            {Object.entries(ROLE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="u-zone" className="label">
            Zona
          </label>
          <select id="u-zone" className="input" value={form.zoneId} onChange={set("zoneId")} disabled={form.role === "ADMIN"}>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="u-pass" className="label">
            Password iniziale
          </label>
          <input id="u-pass" type="text" className="input" value={form.password} onChange={set("password")} autoComplete="new-password" />
          <p className="hint">Almeno 10 caratteri.</p>
        </div>
        {form.role === "SCOUT" ? (
          <div className="flex items-center gap-3 pt-6">
            <input id="u-upload" type="checkbox" className="h-5 w-5" checked={form.canUploadMedia} onChange={(e) => setForm({ ...form, canUploadMedia: e.target.checked })} />
            <label htmlFor="u-upload" className="text-sm">
              Abilitato al caricamento di media
            </label>
          </div>
        ) : null}
      </div>
      <button type="submit" className="btn-primary" disabled={pending}>
        Crea utente
      </button>
    </form>
  );
}

export function WeightsEditor({ weights }: { weights: Record<string, Record<Attribute, number>> }) {
  const { run, pending, feedback } = useAction();
  const groups = Object.keys(ROLE_GROUP_LABELS);
  const [group, setGroup] = useState(groups[0]);
  const [values, setValues] = useState(weights);
  const current = values[group];
  const total = ATTRIBUTES.reduce((s, a) => s + (Number(current[a]) || 0), 0);
  return (
    <div className="space-y-3">
      {feedback}
      <div role="tablist" aria-label="Reparto" className="flex flex-wrap gap-1">
        {groups.map((g) => (
          <button key={g} type="button" role="tab" aria-selected={g === group} className={g === group ? "btn-primary btn-sm" : "btn-secondary btn-sm"} onClick={() => setGroup(g)}>
            {ROLE_GROUP_LABELS[g]}
          </button>
        ))}
      </div>
      <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {ATTRIBUTES.map((a) => (
          <div key={a} className="flex items-center justify-between gap-3">
            <label htmlFor={`w-${a}`} className="text-sm">
              {ATTRIBUTE_LABELS[a]}
              <span className="muted ml-1 text-xs">{total ? `${Math.round(((Number(current[a]) || 0) / total) * 100)}%` : ""}</span>
            </label>
            <input
              id={`w-${a}`}
              type="number"
              step="0.1"
              min={0}
              max={3}
              className="input w-24"
              value={current[a]}
              onChange={(e) => setValues({ ...values, [group]: { ...current, [a]: e.target.value as unknown as number } })}
            />
          </div>
        ))}
      </div>
      <p className="hint">
        Peso da 0 a 3: più è alto, più l&apos;attributo conta nell&apos;overall del reparto. La percentuale indica il contributo effettivo. Al
        salvataggio tutte le Player Card vengono ricalcolate.
      </p>
      <button type="button" className="btn-primary" disabled={pending} onClick={() => run(() => saveWeights({ roleGroup: group, weights: current }), `Pesi salvati per ${ROLE_GROUP_LABELS[group].toLowerCase()}: Player Card ricalcolate.`)}>
        {pending ? "Ricalcolo…" : "Salva pesi"}
      </button>
    </div>
  );
}

export function RetentionForm({ months }: { months: number }) {
  const { run, pending, feedback } = useAction();
  const [value, setValue] = useState(String(months));
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveRetention(Number(value)), "Termine aggiornato: vale per le prossime approvazioni.");
      }}
    >
      {feedback}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="retention" className="label">
            Mesi dall&apos;ultima osservazione prima della revisione
          </label>
          <input id="retention" type="number" min={3} max={60} className="input w-28" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <button type="submit" className="btn-primary" disabled={pending}>
          Salva
        </button>
      </div>
    </form>
  );
}
