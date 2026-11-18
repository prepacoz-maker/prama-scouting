import Link from "next/link";
import type { ReactNode } from "react";
import { STATUS_LABELS, cardLabel } from "@/lib/labels";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-prama-900 dark:text-white">{title}</h1>
        {description ? <p className="muted mt-1 max-w-2xl text-sm">{description}</p> : null}
      </div>
      {actions ? <div className="no-print flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function Panel({ title, action, children, className = "" }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel p-4 sm:p-5 ${className}`}>
      {title ? (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-prama-900 dark:text-white">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-prama-200 px-4 py-10 text-center dark:border-prama-700">
      <p className="font-semibold text-prama-800 dark:text-prama-50">{title}</p>
      {description ? <p className="muted mx-auto mt-1 max-w-md text-sm">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

const STATUS_TONES: Record<string, string> = {
  MOLTO_INTERESSANTE: "bg-accent-500 text-prama-950",
  INTERESSANTE: "bg-campo-600 text-white",
  IN_FOLLOW_UP: "bg-prama-600 text-white",
  NUOVO_CONTROLLO_RICHIESTO: "bg-prama-600 text-white",
  VIDEO_RICHIESTO: "bg-prama-600 text-white",
  IN_OSSERVAZIONE: "bg-prama-100 text-prama-800 dark:bg-prama-700 dark:text-prama-50",
  DA_VALUTARE: "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100",
  NON_PRIORITARIO: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100",
  ARCHIVIATO: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100",
  DUPLICATO: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100",
};

/** Etichetta di stato. `compact` mostra la dicitura sintetica della Player Card. */
export function StatusTag({ status, compact = false }: { status: string; compact?: boolean }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONES[status] ?? STATUS_TONES.ARCHIVIATO}`}>
      {compact ? cardLabel(status) : (STATUS_LABELS[status] ?? status)}
    </span>
  );
}

const REVIEW_TONES: Record<string, string> = {
  BOZZA: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100",
  DA_VALUTARE: "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100",
  INTEGRAZIONE_RICHIESTA: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-100",
  APPROVATA: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100",
};

export function Pill({ tone, children }: { tone?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${(tone && REVIEW_TONES[tone]) || "bg-prama-100 text-prama-800 dark:bg-prama-700 dark:text-prama-50"}`}>
      {children}
    </span>
  );
}

export function BadgeChip({ label, description }: { label: string; description?: string }) {
  return (
    <span
      title={description}
      className="inline-flex items-center gap-1.5 rounded-md border border-accent-500/50 bg-accent-400/15 px-2 py-1 text-xs font-semibold text-prama-900 dark:text-accent-400"
    >
      <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3 w-3 fill-accent-600 dark:fill-accent-400">
        <path d="M6 0l1.7 3.9L12 4.4 8.8 7.2l.9 4.3L6 9.3 2.3 11.5l.9-4.3L0 4.4l4.3-.5z" />
      </svg>
      {label}
    </span>
  );
}

/** Barra di un attributo su scala 1-5; `previous` mostra il valore della prima osservazione. */
export function AttributeBar({ label, value, previous }: { label: string; value: number | null; previous?: number | null }) {
  const pct = value === null ? 0 : ((value - 1) / 4) * 100;
  const tone = value === null ? "bg-prama-200" : value >= 4 ? "bg-campo-500" : value >= 3 ? "bg-prama-500" : "bg-accent-500";
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
      <span className="text-sm text-prama-800 dark:text-prama-100">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-prama-900 dark:text-white">
        {value === null ? <span className="muted font-normal">N/V</span> : value.toFixed(1)}
      </span>
      <div
        className="relative col-span-2 h-2 rounded-full bg-prama-100 dark:bg-prama-800"
        role="meter"
        aria-label={label}
        aria-valuemin={1}
        aria-valuemax={5}
        aria-valuenow={value ?? undefined}
        aria-valuetext={value === null ? "Non valutato" : `${value.toFixed(1)} su 5`}
      >
        <div className={`h-2 rounded-full ${tone}`} style={{ width: `${Math.max(pct, value === null ? 0 : 4)}%` }} />
        {previous !== null && previous !== undefined ? (
          <span
            aria-hidden="true"
            title={`Prima osservazione: ${previous.toFixed(1)}`}
            className="absolute top-[-3px] h-[14px] w-[2px] bg-prama-900 dark:bg-white"
            style={{ left: `${((previous - 1) / 4) * 100}%` }}
          />
        ) : null}
      </div>
    </div>
  );
}

export function StatTile({ label, value, href, tone = "default" }: { label: string; value: number | string; href?: string; tone?: "default" | "alert" | "good" }) {
  const accent = tone === "alert" ? "border-l-accent-500" : tone === "good" ? "border-l-campo-500" : "border-l-prama-500";
  const body = (
    <div className={`panel h-full border-l-4 ${accent} p-4`}>
      <p className="text-3xl font-bold tabular-nums text-prama-900 dark:text-white">{value}</p>
      <p className="muted mt-1 text-sm">{label}</p>
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-xl">
      {body}
    </Link>
  ) : (
    body
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "warn" | "error" | "success"; children: ReactNode }) {
  const tones = {
    info: "border-prama-200 bg-prama-50 text-prama-900 dark:border-prama-700 dark:bg-prama-800 dark:text-prama-50",
    warn: "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-100",
    error: "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/60 dark:text-red-100",
    success: "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-100",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

/** Tabella semplice con scorrimento orizzontale su schermi stretti. */
export function DataTable<T>({ columns, rows, rowKey, caption }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; caption: string }) {
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-prama-100 dark:border-prama-800">
          <tr>
            {columns.map((c) => (
              <th key={c.header} scope="col" className={`th ${c.className ?? ""}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-prama-100 dark:divide-prama-800">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="hover:bg-prama-50/60 dark:hover:bg-prama-800/50">
              {columns.map((c) => (
                <td key={c.header} className={`td ${c.className ?? ""}`}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
