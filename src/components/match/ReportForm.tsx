"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveReport } from "@/app/actions/match";
import { Alert } from "@/components/ui";

export interface ReportFields {
  summary: string;
  strengths: string;
  improvements: string;
  mainRecommendation: string;
  patterns: string;
  plan: string;
  questions: string;
  limits: string;
  athleteFeedback: string;
  status: "IN_CORSO" | "COMPLETATA";
}

const FIELDS: { key: Exclude<keyof ReportFields, "status">; label: string; hint?: string }[] = [
  { key: "summary", label: "1. Executive summary", hint: "Massimo 150 parole: cosa è emerso in 2-3 frasi." },
  { key: "strengths", label: "Punti di forza", hint: "Uno per riga." },
  { key: "improvements", label: "Margini di miglioramento prioritari", hint: "Uno per riga." },
  { key: "mainRecommendation", label: "Raccomandazione principale" },
  { key: "patterns", label: "5. Pattern ricorrenti", hint: "Almeno 3, positivi o negativi, con i timestamp di esempio." },
  { key: "plan", label: "6. Piano di miglioramento (4 settimane)", hint: "Obiettivo prioritario, focus per settimana, KPI da monitorare alla prossima analisi." },
  { key: "questions", label: "8. Domande per l'atleta", hint: "Una per riga." },
  { key: "limits", label: "Rischi o limiti dell'analisi", hint: "Angolo, qualità, tagli del video, cosa non è verificabile." },
  { key: "athleteFeedback", label: "Feedback sintetico per l'atleta" },
];

export function ReportForm({ id, initial }: { id: string; initial: ReportFields }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const save = (status = f.status) =>
    start(async () => {
      const res = await saveReport({ id, ...f, status });
      if (!res.ok) return setMsg({ tone: "error", text: res.error });
      setF((p) => ({ ...p, status }));
      setMsg({ tone: "success", text: status === "COMPLETATA" ? "Report salvato e analisi segnata come completata." : "Report salvato." });
      router.refresh();
    });
  return (
    <details className="panel no-print mb-5 p-4" open={!initial.summary}>
      <summary className="cursor-pointer text-base font-semibold">Compila le sezioni del report</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {FIELDS.map((fl) => (
          <label key={fl.key} className={`grid gap-1 ${["summary", "patterns", "plan"].includes(fl.key) ? "sm:col-span-2" : ""}`}>
            <span className="label">{fl.label}</span>
            <textarea className="input min-h-[80px] text-sm" value={f[fl.key]} onChange={(e) => setF({ ...f, [fl.key]: e.target.value })} />
            {fl.hint ? <span className="hint">{fl.hint}</span> : null}
          </label>
        ))}
      </div>
      {msg ? <div className="mt-3"><Alert tone={msg.tone}>{msg.text}</Alert></div> : null}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-secondary" disabled={pending} onClick={() => save()}>
          Salva
        </button>
        {f.status !== "COMPLETATA" ? (
          <button type="button" className="btn-primary" disabled={pending} onClick={() => save("COMPLETATA")}>
            Salva e segna completata
          </button>
        ) : (
          <button type="button" className="btn-secondary" disabled={pending} onClick={() => save("IN_CORSO")}>
            Riapri l&apos;analisi
          </button>
        )}
      </div>
    </details>
  );
}
