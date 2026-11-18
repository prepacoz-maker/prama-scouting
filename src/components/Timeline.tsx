import Link from "next/link";
import { EVENT_LABELS, REVIEW_LABELS, fmtDate } from "@/lib/labels";
import { Pill } from "./ui";

export interface TimelineItem {
  id: string;
  date: Date;
  eventType: string;
  reviewStatus: string;
  overall: number | null;
  scout: string;
  minutes: number;
  team: string;
  opponent: string | null;
}

/** Cronologia verticale delle osservazioni, dalla più recente. */
export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="relative ml-2 space-y-4 border-l-2 border-prama-100 pl-5 dark:border-prama-700">
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span aria-hidden="true" className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-prama-600 dark:border-prama-900" />
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/osservazioni/${item.id}`} className="font-semibold underline-offset-2 hover:underline">
              {fmtDate(item.date)} · {EVENT_LABELS[item.eventType]}
            </Link>
            <Pill tone={item.reviewStatus}>{REVIEW_LABELS[item.reviewStatus]}</Pill>
            {item.overall !== null ? (
              <span className="rounded bg-prama-100 px-1.5 py-0.5 text-xs font-bold tabular-nums dark:bg-prama-700">Overall {item.overall}</span>
            ) : null}
          </div>
          <p className="muted text-sm">
            {item.team}
            {item.opponent ? ` – ${item.opponent}` : ""} · {item.minutes}′ osservati · scout {item.scout}
          </p>
        </li>
      ))}
    </ol>
  );
}
