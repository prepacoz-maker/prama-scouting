"use client";

import { useState } from "react";
import type { CodeButton, Outcome } from "@/lib/match";
import { Alert } from "@/components/ui";

const CATEGORIES = ["Possesso", "Non possesso", "Movimento", "Portiere", "Palla inattiva", "Altro"];

const toCode = (label: string) =>
  label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40) || "EVENTO";

export function ButtonsEditor({ buttons, onSave, onCancel }: { buttons: CodeButton[]; onSave: (b: CodeButton[]) => Promise<string | null>; onCancel: () => void }) {
  const [list, setList] = useState<CodeButton[]>(buttons);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (i: number, patch: Partial<CodeButton>) => setList((l) => l.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const move = (i: number, d: number) =>
    setList((l) => {
      const j = i + d;
      if (j < 0 || j >= l.length) return l;
      const n = [...l];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  const add = () => {
    const used = new Set(list.map((b) => b.code));
    let code = "NUOVO";
    for (let n = 2; used.has(code); n++) code = `NUOVO_${n}`;
    setList((l) => [...l, { code, label: "Nuovo evento", category: "Altro", hotkey: "", outcome: null, pre: 5, post: 3 }]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="buttons-title">
      <div className="panel w-full max-w-4xl p-4">
        <h2 id="buttons-title" className="text-lg font-semibold">
          Personalizza il pannello di codifica
        </h2>
        <p className="muted mb-3 text-sm">Valido solo per questa analisi. «Prima» e «dopo» sono i secondi di clip attorno alla pressione del pulsante. Tasti riservati: Spazio, K, J, L, virgola, punto, M.</p>
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-prama-500">
                <th className="p-1">Nome</th>
                <th className="p-1">Categoria</th>
                <th className="p-1">Esito</th>
                <th className="p-1">Tasto</th>
                <th className="p-1">Prima</th>
                <th className="p-1">Dopo</th>
                <th className="p-1" />
              </tr>
            </thead>
            <tbody>
              {list.map((b, i) => (
                <tr key={i} className="border-t border-prama-100 dark:border-prama-800">
                  <td className="p-1">
                    <input
                      className="input !min-h-[36px] !py-1 text-sm"
                      aria-label="Nome"
                      value={b.label}
                      onChange={(e) => set(i, { label: e.target.value, ...(b.code.startsWith("NUOVO") ? { code: toCode(e.target.value) } : {}) })}
                    />
                  </td>
                  <td className="p-1">
                    <select className="input !min-h-[36px] !py-1 text-sm" aria-label="Categoria" value={b.category} onChange={(e) => set(i, { category: e.target.value })}>
                      {[...new Set([...CATEGORIES, b.category])].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-1">
                    <select className="input !min-h-[36px] !py-1 text-sm" aria-label="Esito" value={b.outcome ?? ""} onChange={(e) => set(i, { outcome: (e.target.value || null) as Outcome | null })}>
                      <option value="">—</option>
                      <option value="POSITIVO">Positivo</option>
                      <option value="NEGATIVO">Negativo</option>
                      <option value="NEUTRO">Neutro</option>
                    </select>
                  </td>
                  <td className="p-1">
                    <input className="input !min-h-[36px] !w-14 !py-1 text-center text-sm uppercase" aria-label="Tasto rapido" maxLength={1} value={b.hotkey} onChange={(e) => set(i, { hotkey: e.target.value.toLowerCase() })} />
                  </td>
                  <td className="p-1">
                    <input className="input !min-h-[36px] !w-16 !py-1 text-sm" aria-label="Secondi prima" type="number" min={0} max={60} value={b.pre} onChange={(e) => set(i, { pre: Number(e.target.value) })} />
                  </td>
                  <td className="p-1">
                    <input className="input !min-h-[36px] !w-16 !py-1 text-sm" aria-label="Secondi dopo" type="number" min={0} max={60} value={b.post} onChange={(e) => set(i, { post: Number(e.target.value) })} />
                  </td>
                  <td className="whitespace-nowrap p-1">
                    <button type="button" className="btn-secondary btn-sm !px-2" aria-label="Sposta su" onClick={() => move(i, -1)}>
                      ↑
                    </button>
                    <button type="button" className="btn-secondary btn-sm !px-2" aria-label="Sposta giù" onClick={() => move(i, 1)}>
                      ↓
                    </button>
                    <button type="button" className="btn-danger btn-sm !px-2" aria-label="Rimuovi" onClick={() => setList((l) => l.filter((_, j) => j !== i))}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {error ? <div className="mt-3"><Alert tone="error">{error}</Alert></div> : null}
        <div className="mt-3 flex flex-wrap justify-between gap-2">
          <button type="button" className="btn-secondary" onClick={add}>
            Aggiungi pulsante
          </button>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={onCancel}>
              Annulla
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                setError(await onSave(list));
                setSaving(false);
              }}
            >
              Salva pannello
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
