"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  createEvent,
  createPlaylist,
  deleteEvent,
  deletePlaylist,
  saveDrawing,
  setVideoMeta,
  updateButtons,
  updateEvent,
} from "@/app/actions/match";
import {
  CATEGORY_COLORS,
  CONFIDENCE_LABELS,
  OUTCOME_LABELS,
  PHASES,
  RATING_LABELS,
  computeStats,
  fmtClock,
  halfOf,
  youtubeId,
  type CodeButton,
  type Outcome,
  type Shape,
} from "@/lib/match";
import { Alert } from "@/components/ui";
import { Player, type PlayerHandle, type PlayerSource } from "./Player";
import { COLORS, DrawingLayer, TOOLS, type Tool } from "./Drawing";
import { ButtonsEditor } from "./ButtonsEditor";

export interface WsEvent {
  id: string;
  code: string;
  label: string;
  category: string;
  outcome: Outcome | null;
  timeSec: number;
  startSec: number;
  endSec: number;
  rating: keyof typeof RATING_LABELS | null;
  confidence: keyof typeof CONFIDENCE_LABELS | null;
  phase: string;
  fact: string;
  inference: string;
  recommendation: string;
  debrief: boolean;
  drawing: Shape[] | null;
  drawingSec: number | null;
}

export interface WsSession {
  id: string;
  title: string;
  videoSource: "FILE_LOCALE" | "LINK";
  videoLabel: string;
  videoUrl: string | null;
  durationSec: number | null;
  secondHalfSec: number | null;
  buttons: CodeButton[];
}

interface Playlist {
  id: string;
  name: string;
  eventIds: string[];
}

const RATES = [0.25, 0.5, 1, 1.5, 2];
const FRAME = 1 / 25;
const colorOf = (cat: string) => CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.Altro;
const isTyping = (el: EventTarget | null) => el instanceof HTMLElement && (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable);

export function Workspace({ session, initialEvents, initialPlaylists }: { session: WsSession; initialEvents: WsEvent[]; initialPlaylists: Playlist[] }) {
  const player = useRef<PlayerHandle>(null);
  const videoBox = useRef<HTMLDivElement>(null);
  const [source, setSource] = useState<PlayerSource | null>(() => {
    if (session.videoSource !== "LINK" || !session.videoUrl) return null;
    const yt = youtubeId(session.videoUrl);
    return yt ? { kind: "youtube", id: yt } : { kind: "url", url: session.videoUrl };
  });
  const [fileWarning, setFileWarning] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success" | "info"; text: string } | null>(null);
  const [buttons, setButtons] = useState<CodeButton[]>(session.buttons);
  const [events, setEvents] = useState<WsEvent[]>(() => [...initialEvents].sort((a, b) => a.startSec - b.startSec));
  const [playlists, setPlaylists] = useState<Playlist[]>(initialPlaylists);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(session.durationSec ?? 0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [secondHalf, setSecondHalf] = useState<number | null>(session.secondHalfSec);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({ category: "", code: "", outcome: "", rating: "", debrief: false });
  const [tab, setTab] = useState<"episodi" | "playlist" | "statistiche">("episodi");
  const [editingButtons, setEditingButtons] = useState(false);
  const [lastTag, setLastTag] = useState<string | null>(null);
  // Telestrazione
  const [drawMode, setDrawMode] = useState(false);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [tool, setTool] = useState<Tool>("arrow");
  const [color, setColor] = useState(COLORS[0]);
  const [drawText, setDrawText] = useState("");
  // Riproduzione di playlist o di una clip
  const [queue, setQueue] = useState<{ ids: string[]; index: number; name: string } | null>(null);
  const [overlay, setOverlay] = useState<Shape[] | null>(null);
  const holdRef = useRef<{ until: number; eventId: string } | null>(null);
  const shownDrawing = useRef<string | null>(null);
  const [, startTransition] = useTransition();

  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const selected = selectedId ? (byId.get(selectedId) ?? null) : null;

  // ─── Video ────────────────────────────────────────────────────────────────
  const onDuration = useCallback(
    (d: number) => {
      if (!Number.isFinite(d) || d <= 0) return;
      setDuration(d);
      if (!session.durationSec || Math.abs(session.durationSec - d) > 1) void setVideoMeta(session.id, { durationSec: Math.round(d * 100) / 100 });
    },
    [session.id, session.durationSec],
  );

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    if (source?.kind === "file") URL.revokeObjectURL(source.url);
    setVideoError(null);
    setSource({ kind: "file", url: URL.createObjectURL(file) });
    setFileWarning(
      file.name !== session.videoLabel ? `Hai aperto «${file.name}», ma l'analisi è stata creata su «${session.videoLabel}». Verifica che sia la stessa partita: i tempi degli episodi dipendono dal file.` : null,
    );
  };
  useEffect(() => () => (source?.kind === "file" ? URL.revokeObjectURL(source.url) : undefined), [source]);

  // Ciclo di aggiornamento: tempo, playlist, pause sui disegni.
  useEffect(() => {
    const id = window.setInterval(() => {
      const p = player.current;
      if (!p) return;
      const t = p.getTime();
      setTime(t);
      setPlaying(p.isPlaying());
      const hold = holdRef.current;
      if (hold) {
        if (Date.now() >= hold.until) {
          holdRef.current = null;
          setOverlay(null);
          p.play();
        }
        return;
      }
      if (queue) {
        const ev = byId.get(queue.ids[queue.index]);
        if (!ev) return advance();
        if (ev.drawing?.length && ev.drawingSec !== null && shownDrawing.current !== ev.id && t >= ev.drawingSec && t < ev.drawingSec + 0.6) {
          shownDrawing.current = ev.id;
          p.pause();
          p.seek(ev.drawingSec);
          setOverlay(ev.drawing);
          holdRef.current = { until: Date.now() + 3000, eventId: ev.id };
          return;
        }
        if (t >= ev.endSec) advance();
      }
    }, 100);
    function advance() {
      setQueue((q) => {
        if (!q) return q;
        const next = q.index + 1;
        if (next >= q.ids.length) {
          player.current?.pause();
          return null;
        }
        const ev = byId.get(q.ids[next]);
        shownDrawing.current = null;
        if (ev) player.current?.seek(ev.startSec);
        return { ...q, index: next };
      });
    }
    return () => window.clearInterval(id);
  }, [queue, byId]);

  const playQueue = (ids: string[], name: string) => {
    const ordered = ids.filter((i) => byId.has(i));
    if (!ordered.length || !player.current) return;
    setDrawMode(false);
    setOverlay(null);
    holdRef.current = null;
    shownDrawing.current = null;
    setQueue({ ids: ordered, index: 0, name });
    player.current.seek(byId.get(ordered[0])!.startSec);
    player.current.play();
  };
  const stopQueue = () => {
    setQueue(null);
    holdRef.current = null;
    setOverlay(null);
    player.current?.pause();
  };

  // Disegno dell'episodio selezionato visibile quando il video è fermo sul suo fotogramma.
  const staticOverlay =
    !drawMode && !playing && selected?.drawing?.length && selected.drawingSec !== null && Math.abs(time - selected.drawingSec) < 0.25 ? selected.drawing : null;

  // ─── Codifica ─────────────────────────────────────────────────────────────
  const tag = useCallback(
    (btn: CodeButton) => {
      const p = player.current;
      if (!p || !source) {
        setMessage({ tone: "error", text: "Apri prima il video." });
        return;
      }
      const t = p.getTime();
      const tempId = `tmp-${Date.now()}`;
      const startSec = Math.max(0, t - btn.pre);
      const optimistic: WsEvent = {
        id: tempId,
        code: btn.code,
        label: btn.label,
        category: btn.category,
        outcome: btn.outcome,
        timeSec: t,
        startSec,
        endSec: t + btn.post,
        rating: null,
        confidence: null,
        phase: "",
        fact: "",
        inference: "",
        recommendation: "",
        debrief: false,
        drawing: null,
        drawingSec: null,
      };
      setEvents((prev) => [...prev, optimistic].sort((a, b) => a.startSec - b.startSec));
      setLastTag(`${btn.label} · ${fmtClock(t)}`);
      startTransition(async () => {
        const res = await createEvent({ sessionId: session.id, code: btn.code, timeSec: t });
        if (!res.ok) {
          setEvents((prev) => prev.filter((e) => e.id !== tempId));
          setMessage({ tone: "error", text: res.error });
          return;
        }
        const data = res.data!;
        setEvents((prev) => prev.map((e) => (e.id === tempId ? { ...e, id: data.id, startSec: data.startSec, endSec: data.endSec } : e)));
        setSelectedId((cur) => (cur === tempId ? data.id : cur));
      });
    },
    [session.id, source],
  );

  const markSecondHalf = () => {
    const t = player.current?.getTime() ?? 0;
    setSecondHalf(t);
    void setVideoMeta(session.id, { secondHalfSec: Math.round(t * 100) / 100 });
    setMessage({ tone: "success", text: `Inizio del secondo tempo segnato a ${fmtClock(t)}.` });
  };

  // Scorciatoie da tastiera.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey || editingButtons) return;
      const p = player.current;
      const k = e.key.toLowerCase();
      if (k === " " || k === "k") {
        e.preventDefault();
        p?.toggle();
      } else if (k === "j" || e.key === "ArrowLeft") {
        e.preventDefault();
        p?.seek(p.getTime() - 5);
      } else if (k === "l" || e.key === "ArrowRight") {
        e.preventDefault();
        p?.seek(p.getTime() + 5);
      } else if (k === ",") p?.step(-FRAME);
      else if (k === ".") p?.step(FRAME);
      else if (!drawMode) {
        const btn = buttons.find((b) => b.hotkey && b.hotkey === k);
        if (btn) {
          e.preventDefault();
          tag(btn);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [buttons, tag, drawMode, editingButtons]);

  // ─── Episodi ──────────────────────────────────────────────────────────────
  const filtered = events.filter(
    (e) =>
      (!filters.category || e.category === filters.category) &&
      (!filters.code || e.code === filters.code) &&
      (!filters.outcome || e.outcome === filters.outcome) &&
      (!filters.rating || e.rating === filters.rating) &&
      (!filters.debrief || e.debrief),
  );
  const categories = [...new Set(buttons.map((b) => b.category).concat(events.map((e) => e.category)))];
  const codes = [...new Map(events.map((e) => [e.code, e.label])).entries()];

  const selectEvent = (ev: WsEvent, seekTo: "start" | "drawing" = "start") => {
    setSelectedId(ev.id);
    setDrawMode(false);
    stopQueueSilently();
    const t = seekTo === "drawing" && ev.drawingSec !== null ? ev.drawingSec : ev.startSec;
    player.current?.seek(t);
    if (seekTo === "drawing") videoBox.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
  const stopQueueSilently = () => {
    setQueue(null);
    holdRef.current = null;
    setOverlay(null);
  };

  const patchLocal = (id: string, patch: Partial<WsEvent>) => setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)).sort((a, b) => a.startSec - b.startSec));

  const saveSelected = (draft: WsEvent) => {
    startTransition(async () => {
      const res = await updateEvent({
        id: draft.id,
        startSec: draft.startSec,
        endSec: draft.endSec,
        rating: draft.rating,
        confidence: draft.confidence,
        outcome: draft.outcome,
        phase: draft.phase,
        fact: draft.fact,
        inference: draft.inference,
        recommendation: draft.recommendation,
        debrief: draft.debrief,
      });
      if (!res.ok) return setMessage({ tone: "error", text: res.error });
      patchLocal(draft.id, draft);
      setMessage({ tone: "success", text: "Episodio salvato." });
    });
  };

  const removeSelected = (id: string) => {
    startTransition(async () => {
      const res = await deleteEvent(id);
      if (!res.ok) return setMessage({ tone: "error", text: res.error });
      setEvents((prev) => prev.filter((e) => e.id !== id));
      setPlaylists((prev) => prev.map((p) => ({ ...p, eventIds: p.eventIds.filter((x) => x !== id) })));
      setSelectedId(null);
    });
  };

  // ─── Telestrazione ────────────────────────────────────────────────────────
  const startDrawing = () => {
    if (!selected || selected.id.startsWith("tmp-")) return;
    player.current?.pause();
    stopQueueSilently();
    if (selected.drawing?.length && selected.drawingSec !== null) player.current?.seek(selected.drawingSec);
    setShapes(selected.drawing ?? []);
    setDrawMode(true);
    videoBox.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
  const commitDrawing = (clear = false) => {
    if (!selected) return;
    const list = clear ? [] : shapes;
    const at = clear ? null : (player.current?.getTime() ?? time);
    startTransition(async () => {
      const res = await saveDrawing({ id: selected.id, drawingSec: at, shapes: list });
      if (!res.ok) return setMessage({ tone: "error", text: res.error });
      patchLocal(selected.id, { drawing: list.length ? list : null, drawingSec: list.length ? at : null });
      setDrawMode(false);
      setMessage({ tone: "success", text: list.length ? `Disegno salvato a ${fmtClock(at)}.` : "Disegno rimosso." });
    });
  };

  // ─── Playlist ─────────────────────────────────────────────────────────────
  const [playlistName, setPlaylistName] = useState("");
  const newPlaylist = () => {
    const ids = events.filter((e) => checked.has(e.id)).map((e) => e.id);
    startTransition(async () => {
      const res = await createPlaylist({ sessionId: session.id, name: playlistName, eventIds: ids });
      if (!res.ok) return setMessage({ tone: "error", text: res.error });
      setPlaylists((prev) => [{ id: res.data!.id, name: playlistName.trim(), eventIds: ids }, ...prev]);
      setPlaylistName("");
      setChecked(new Set());
      setTab("playlist");
    });
  };
  const removePlaylist = (id: string) => {
    startTransition(async () => {
      const res = await deletePlaylist(id);
      if (!res.ok) return setMessage({ tone: "error", text: res.error });
      setPlaylists((prev) => prev.filter((p) => p.id !== id));
    });
  };

  const stats = useMemo(() => computeStats(events, secondHalf), [events, secondHalf]);
  const grouped = useMemo(() => {
    const m = new Map<string, CodeButton[]>();
    for (const b of buttons) m.set(b.category, [...(m.get(b.category) ?? []), b]);
    return [...m.entries()];
  }, [buttons]);
  // La timeline copre il video e tutti gli episodi (anche se il file aperto è più corto).
  const span = Math.max(duration, ...events.map((e) => e.endSec), 1);
  const lanes = categories.filter((c) => events.some((e) => e.category === c));
  const current = queue ? byId.get(queue.ids[queue.index]) : null;
  const shownOverlay = drawMode ? shapes : (overlay ?? staticOverlay);

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4">
      {message ? (
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <Alert tone={message.tone}>{message.text}</Alert>
          </div>
          <button type="button" className="btn-secondary btn-sm" onClick={() => setMessage(null)}>
            Chiudi
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Video, controlli e timeline */}
        <section className="panel min-w-0 overflow-hidden" aria-label="Video">
          <div ref={videoBox} className="relative aspect-video w-full select-none bg-black">
            {source ? (
              <Player ref={player} source={source} onDuration={onDuration} onError={setVideoError} />
            ) : session.videoSource === "FILE_LOCALE" ? (
              <label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-3 p-6 text-center text-white">
                <span className="text-lg font-semibold">Apri il file della partita dal tuo computer</span>
                <span className="max-w-md text-sm text-white/70">File atteso: «{session.videoLabel}». Il video resta sul tuo computer: non viene caricato da nessuna parte.</span>
                <span className="btn-primary">Scegli il file</span>
                <input type="file" accept="video/*" className="sr-only" onChange={(e) => pickFile(e.target.files?.[0])} />
              </label>
            ) : (
              <p className="absolute inset-0 flex items-center justify-center text-white">Link non valido.</p>
            )}
            {shownOverlay ? <DrawingLayer shapes={shownOverlay} editable={drawMode} tool={tool} color={color} textValue={drawText} onChange={setShapes} /> : null}
            {queue ? (
              <div className="pointer-events-none absolute left-3 top-3 rounded bg-black/70 px-2 py-1 text-xs font-semibold text-white">
                {queue.name} · {queue.index + 1}/{queue.ids.length}
                {current ? ` · ${current.label}` : ""}
              </div>
            ) : null}
            {lastTag && !queue ? <div className="pointer-events-none absolute right-3 top-3 rounded bg-accent-500 px-2 py-1 text-xs font-bold text-prama-950">{lastTag}</div> : null}
          </div>

          {fileWarning ? <div className="p-3"><Alert tone="warn">{fileWarning}</Alert></div> : null}
          {videoError ? <div className="p-3"><Alert tone="error">{videoError}</Alert></div> : null}

          {drawMode ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-prama-100 p-3 dark:border-prama-800">
              <span className="text-sm font-semibold">Disegno su {fmtClock(time)}</span>
              {TOOLS.map((t) => (
                <button key={t.key} type="button" className={tool === t.key ? "btn-primary btn-sm" : "btn-secondary btn-sm"} onClick={() => setTool(t.key)} aria-pressed={tool === t.key}>
                  {t.label}
                </button>
              ))}
              {tool === "text" ? <input className="input !min-h-[36px] w-40 !py-1 text-sm" placeholder="Testo, poi clic sul video" value={drawText} onChange={(e) => setDrawText(e.target.value)} /> : null}
              <span className="flex gap-1" role="radiogroup" aria-label="Colore">
                {COLORS.map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={`Colore ${c}`} onClick={() => setColor(c)} className={`h-7 w-7 rounded-full border-2 ${color === c ? "border-prama-900 dark:border-white" : "border-transparent"}`} style={{ background: c }} />
                ))}
              </span>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setShapes((s) => s.slice(0, -1))} disabled={!shapes.length}>
                Annulla ultimo
              </button>
              <button type="button" className="btn-secondary btn-sm" onClick={() => player.current?.step(-FRAME)}>
                ◀ fotogramma
              </button>
              <button type="button" className="btn-secondary btn-sm" onClick={() => player.current?.step(FRAME)}>
                fotogramma ▶
              </button>
              <span className="flex-1" />
              {selected?.drawing?.length ? (
                <button type="button" className="btn-danger btn-sm" onClick={() => commitDrawing(true)}>
                  Elimina disegno
                </button>
              ) : null}
              <button type="button" className="btn-secondary btn-sm" onClick={() => setDrawMode(false)}>
                Esci
              </button>
              <button type="button" className="btn-primary btn-sm" onClick={() => commitDrawing()}>
                Salva disegno
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 border-t border-prama-100 p-3 dark:border-prama-800">
              <button type="button" className="btn-primary btn-sm min-w-[5.5rem]" onClick={() => player.current?.toggle()} disabled={!source}>
                {playing ? "Pausa" : "Play"}
              </button>
              <button type="button" className="btn-secondary btn-sm" onClick={() => player.current?.seek(time - 5)} disabled={!source} title="J">
                −5 s
              </button>
              <button type="button" className="btn-secondary btn-sm" onClick={() => player.current?.step(-FRAME)} disabled={!source} title=",">
                ◀ fot.
              </button>
              <button type="button" className="btn-secondary btn-sm" onClick={() => player.current?.step(FRAME)} disabled={!source} title=".">
                fot. ▶
              </button>
              <button type="button" className="btn-secondary btn-sm" onClick={() => player.current?.seek(time + 5)} disabled={!source} title="L">
                +5 s
              </button>
              <label className="flex items-center gap-1 text-sm">
                <span className="sr-only">Velocità</span>
                <select
                  className="input !min-h-[36px] !w-auto !py-1 text-sm"
                  value={rate}
                  onChange={(e) => {
                    const r = Number(e.target.value);
                    setRate(r);
                    player.current?.setRate(r);
                  }}
                >
                  {RATES.map((r) => (
                    <option key={r} value={r}>
                      {r}x
                    </option>
                  ))}
                </select>
              </label>
              <span className="font-mono text-sm tabular-nums">
                {fmtClock(time)} / {fmtClock(duration)}
                {secondHalf !== null ? ` · ${halfOf(time, secondHalf)}° tempo` : ""}
              </span>
              <span className="flex-1" />
              {queue ? (
                <button type="button" className="btn-secondary btn-sm" onClick={stopQueue}>
                  Ferma playlist
                </button>
              ) : null}
              <button type="button" className="btn-secondary btn-sm" onClick={markSecondHalf} disabled={!source}>
                {secondHalf === null ? "Segna inizio 2° tempo" : `2° tempo da ${fmtClock(secondHalf)}`}
              </button>
              {session.videoSource === "FILE_LOCALE" && source ? (
                <label className="btn-secondary btn-sm cursor-pointer">
                  Cambia file
                  <input type="file" accept="video/*" className="sr-only" onChange={(e) => pickFile(e.target.files?.[0])} />
                </label>
              ) : null}
            </div>
          )}

          {/* Timeline */}
          <div className="border-t border-prama-100 p-3 dark:border-prama-800">
            <div
              className="relative cursor-pointer overflow-hidden rounded bg-prama-50 dark:bg-prama-950"
              style={{ height: `${Math.max(1, lanes.length) * 18 + 8}px` }}
              onClick={(e) => {
                if (!source) return;
                const r = e.currentTarget.getBoundingClientRect();
                player.current?.seek(((e.clientX - r.left) / r.width) * span);
              }}
              role="presentation"
            >
              {secondHalf !== null ? <div className="absolute inset-y-0 w-px bg-prama-300" style={{ left: `${(secondHalf / span) * 100}%` }} /> : null}
              {events.length
                ? events.map((e) => {
                    const lane = Math.max(0, lanes.indexOf(e.category));
                    return (
                      <button
                        key={e.id}
                        type="button"
                        title={`${e.label} · ${fmtClock(e.timeSec)}`}
                        aria-label={`${e.label} a ${fmtClock(e.timeSec)}`}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          selectEvent(e);
                        }}
                        className={`absolute h-3.5 rounded-sm ${selectedId === e.id ? "ring-2 ring-accent-500" : ""}`}
                        style={{
                          left: `${(e.startSec / span) * 100}%`,
                          width: `max(4px, ${((e.endSec - e.startSec) / span) * 100}%)`,
                          top: `${lane * 18 + 4}px`,
                          background: colorOf(e.category),
                          opacity: e.outcome === "NEGATIVO" ? 0.55 : 1,
                        }}
                      />
                    );
                  })
                : null}
              {source ? <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-accent-500" style={{ left: `${(time / span) * 100}%` }} /> : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              {lanes.map((c) => (
                <span key={c} className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: colorOf(c) }} />
                  {c}
                </span>
              ))}
              <span className="muted">Barre più chiare = esito negativo. Scorciatoie: Spazio play/pausa, J/L ±5 s, virgola/punto ±1 fotogramma.</span>
            </div>
          </div>
        </section>

        {/* Pannello di codifica */}
        <section className="panel p-3" aria-label="Pannello di codifica">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Pannello di codifica</h2>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setEditingButtons(true)}>
              Personalizza
            </button>
          </div>
          <div className="grid gap-3">
            {grouped.map(([cat, list]) => (
              <div key={cat}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: colorOf(cat) }}>
                  {cat}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {list.map((btn) => (
                    <button
                      key={btn.code}
                      type="button"
                      onClick={() => tag(btn)}
                      disabled={!source || drawMode}
                      className="flex min-h-[40px] items-center justify-between gap-1 rounded-md border px-2 py-1 text-left text-xs font-semibold text-white disabled:opacity-40"
                      style={{ background: colorOf(cat), borderColor: btn.outcome === "NEGATIVO" ? "#EF4444" : btn.outcome === "POSITIVO" ? "#22C55E" : "transparent" }}
                    >
                      <span>{btn.label}</span>
                      {btn.hotkey ? <kbd className="rounded bg-black/30 px-1 font-mono text-[10px] uppercase">{btn.hotkey}</kbd> : null}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {editingButtons ? (
        <ButtonsEditor
          buttons={buttons}
          onCancel={() => setEditingButtons(false)}
          onSave={async (next) => {
            const res = await updateButtons(session.id, next);
            if (!res.ok) return res.error;
            setButtons(next);
            setEditingButtons(false);
            setMessage({ tone: "success", text: "Pannello di codifica aggiornato. Gli episodi già codificati non cambiano." });
            return null;
          }}
        />
      ) : null}

      {/* Schede: episodi, playlist, statistiche */}
      <div className="flex flex-wrap items-center gap-2" role="tablist">
        {(
          [
            ["episodi", `Episodi (${events.length})`],
            ["playlist", `Playlist (${playlists.length})`],
            ["statistiche", "Statistiche"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "btn-primary btn-sm" : "btn-secondary btn-sm"} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
        <span className="flex-1" />
        <a href={`/api/match-analysis/${session.id}/csv`} className="btn-secondary btn-sm">
          Esporta CSV
        </a>
        <Link href={`/match-analysis/${session.id}/report`} className="btn-primary btn-sm">
          Report
        </Link>
      </div>

      {tab === "episodi" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <section className="panel p-3" aria-label="Elenco episodi">
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              <select className="input !min-h-[36px] !py-1 text-sm" aria-label="Categoria" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
                <option value="">Tutte le categorie</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <select className="input !min-h-[36px] !py-1 text-sm" aria-label="Evento" value={filters.code} onChange={(e) => setFilters({ ...filters, code: e.target.value })}>
                <option value="">Tutti gli eventi</option>
                {codes.map(([c, l]) => (
                  <option key={c} value={c}>
                    {l}
                  </option>
                ))}
              </select>
              <select className="input !min-h-[36px] !py-1 text-sm" aria-label="Esito" value={filters.outcome} onChange={(e) => setFilters({ ...filters, outcome: e.target.value })}>
                <option value="">Tutti gli esiti</option>
                {Object.entries(OUTCOME_LABELS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
              <select className="input !min-h-[36px] !py-1 text-sm" aria-label="Giudizio" value={filters.rating} onChange={(e) => setFilters({ ...filters, rating: e.target.value })}>
                <option value="">Tutti i giudizi</option>
                {Object.entries(RATING_LABELS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={filters.debrief} onChange={(e) => setFilters({ ...filters, debrief: e.target.checked })} />
                Solo debrief
              </label>
            </div>

            <div className="mb-2 flex flex-wrap items-center gap-2">
              <button type="button" className="btn-secondary btn-sm" disabled={!filtered.length || !source} onClick={() => playQueue(filtered.map((e) => e.id), "Episodi filtrati")}>
                Riproduci i {filtered.length} filtrati
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => setChecked(checked.size === filtered.length && filtered.length ? new Set() : new Set(filtered.map((e) => e.id)))}
              >
                {checked.size === filtered.length && filtered.length ? "Deseleziona" : "Seleziona filtrati"}
              </button>
              {checked.size ? (
                <>
                  <input className="input !min-h-[36px] !w-48 !py-1 text-sm" placeholder="Nome playlist" value={playlistName} onChange={(e) => setPlaylistName(e.target.value)} />
                  <button type="button" className="btn-primary btn-sm" onClick={newPlaylist} disabled={!playlistName.trim()}>
                    Crea playlist ({checked.size})
                  </button>
                </>
              ) : null}
            </div>

            {filtered.length === 0 ? (
              <p className="muted py-6 text-center text-sm">{events.length ? "Nessun episodio con questi filtri." : "Nessun episodio: avvia il video e premi i pulsanti del pannello (o i tasti rapidi)."}</p>
            ) : (
              <ul className="max-h-[28rem] divide-y divide-prama-100 overflow-y-auto dark:divide-prama-800">
                {filtered.map((e) => (
                  <li key={e.id} className={`flex items-center gap-2 py-1.5 ${selectedId === e.id ? "bg-accent-400/15" : ""}`}>
                    <input
                      type="checkbox"
                      aria-label={`Seleziona ${e.label} ${fmtClock(e.timeSec)}`}
                      checked={checked.has(e.id)}
                      onChange={(ev) => {
                        const next = new Set(checked);
                        if (ev.target.checked) next.add(e.id);
                        else next.delete(e.id);
                        setChecked(next);
                      }}
                    />
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm" onClick={() => selectEvent(e)}>
                      <span className="font-mono tabular-nums">{fmtClock(e.timeSec)}</span>
                      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: colorOf(e.category) }} />
                      <span className="truncate font-medium">{e.label}</span>
                      {e.outcome === "NEGATIVO" ? <span className="text-xs text-red-600 dark:text-red-300">✗</span> : e.outcome === "POSITIVO" ? <span className="text-xs text-campo-600">✓</span> : null}
                      {e.rating ? <span className="muted truncate text-xs">{RATING_LABELS[e.rating]}</span> : null}
                      {e.drawing?.length ? <span className="text-xs" title="Con disegno">✎</span> : null}
                      {e.debrief ? <span className="text-xs font-semibold text-accent-600">debrief</span> : null}
                    </button>
                    <button type="button" className="btn-secondary btn-sm" onClick={() => playQueue([e.id], e.label)} disabled={!source || e.id.startsWith("tmp-")}>
                      Clip
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel p-3" aria-label="Episodio selezionato">
            {selected ? (
              <EventEditor
                key={selected.id + selected.startSec + selected.endSec}
                event={selected}
                currentTime={time}
                onSave={saveSelected}
                onDelete={() => removeSelected(selected.id)}
                onDraw={startDrawing}
                onShowDrawing={() => selectEvent(selected, "drawing")}
                disabled={selected.id.startsWith("tmp-")}
              />
            ) : (
              <p className="muted py-6 text-center text-sm">Seleziona un episodio per dare il giudizio, scrivere fatto, inferenza e raccomandazione o disegnare sul fermo immagine.</p>
            )}
          </section>
        </div>
      ) : null}

      {tab === "playlist" ? (
        <section className="panel p-3">
          {playlists.length === 0 ? (
            <p className="muted py-6 text-center text-sm">Nessuna playlist. Seleziona gli episodi nell&apos;elenco e crea una playlist (es. «Pressione alta», «Debrief»).</p>
          ) : (
            <ul className="divide-y divide-prama-100 dark:divide-prama-800">
              {playlists.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="flex-1 font-medium">
                    {p.name} <span className="muted text-sm">· {p.eventIds.length} episodi</span>
                  </span>
                  <button type="button" className="btn-primary btn-sm" disabled={!source || !p.eventIds.length} onClick={() => playQueue(events.filter((e) => p.eventIds.includes(e.id)).map((e) => e.id), p.name)}>
                    Riproduci
                  </button>
                  <button type="button" className="btn-danger btn-sm" onClick={() => removePlaylist(p.id)}>
                    Elimina
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="muted mt-2 text-xs">Durante la riproduzione, gli episodi con un disegno si fermano 3 secondi sul fotogramma disegnato.</p>
        </section>
      ) : null}

      {tab === "statistiche" ? <StatsView stats={stats} hasHalves={secondHalf !== null} /> : null}
    </div>
  );
}

function EventEditor({
  event,
  currentTime,
  onSave,
  onDelete,
  onDraw,
  onShowDrawing,
  disabled,
}: {
  event: WsEvent;
  currentTime: number;
  onSave: (e: WsEvent) => void;
  onDelete: () => void;
  onDraw: () => void;
  onShowDrawing: () => void;
  disabled: boolean;
}) {
  const [d, setD] = useState(event);
  const set = <K extends keyof WsEvent>(k: K, v: WsEvent[K]) => setD((p) => ({ ...p, [k]: v }));
  const area = "input min-h-[64px] text-sm";
  return (
    <div className="grid gap-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold">{event.label}</h3>
        <span className="font-mono text-xs tabular-nums">
          {fmtClock(d.startSec)}–{fmtClock(d.endSec)}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className="btn-secondary btn-sm" onClick={() => set("startSec", Math.round(currentTime * 100) / 100)}>
          Inizio = ora
        </button>
        <button type="button" className="btn-secondary btn-sm" onClick={() => set("endSec", Math.round(currentTime * 100) / 100)}>
          Fine = ora
        </button>
        <button type="button" className="btn-secondary btn-sm" onClick={onDraw} disabled={disabled}>
          {event.drawing?.length ? "Modifica disegno" : "Disegna"}
        </button>
        {event.drawing?.length ? (
          <button type="button" className="btn-secondary btn-sm" onClick={onShowDrawing}>
            Vedi disegno
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className="grid gap-0.5">
          <span className="text-xs font-medium">Esito</span>
          <select className="input !min-h-[36px] !py-1 text-sm" value={d.outcome ?? ""} onChange={(e) => set("outcome", (e.target.value || null) as WsEvent["outcome"])}>
            <option value="">—</option>
            {Object.entries(OUTCOME_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-0.5">
          <span className="text-xs font-medium">Giudizio</span>
          <select className="input !min-h-[36px] !py-1 text-sm" value={d.rating ?? ""} onChange={(e) => set("rating", (e.target.value || null) as WsEvent["rating"])}>
            <option value="">—</option>
            {Object.entries(RATING_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-0.5">
          <span className="text-xs font-medium">Confidenza</span>
          <select className="input !min-h-[36px] !py-1 text-sm" value={d.confidence ?? ""} onChange={(e) => set("confidence", (e.target.value || null) as WsEvent["confidence"])}>
            <option value="">—</option>
            {Object.entries(CONFIDENCE_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="grid gap-0.5">
        <span className="text-xs font-medium">Fase di gioco</span>
        <select className="input !min-h-[36px] !py-1 text-sm" value={d.phase} onChange={(e) => set("phase", e.target.value)}>
          <option value="">—</option>
          {PHASES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-0.5">
        <span className="text-xs font-medium">[FATTO] Che cosa si vede</span>
        <textarea className={area} value={d.fact} onChange={(e) => set("fact", e.target.value)} />
      </label>
      <label className="grid gap-0.5">
        <span className="text-xs font-medium">[INFERENZA] Lettura tecnico-tattica</span>
        <textarea className={area} value={d.inference} onChange={(e) => set("inference", e.target.value)} />
      </label>
      <label className="grid gap-0.5">
        <span className="text-xs font-medium">[RACCOMANDAZIONE] Correzione allenabile</span>
        <textarea className={area} value={d.recommendation} onChange={(e) => set("recommendation", e.target.value)} />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={d.debrief} onChange={(e) => set("debrief", e.target.checked)} />
        Clip per il debrief con l&apos;atleta
      </label>
      <p className="muted text-xs">Compagni e avversari non vanno nominati né valutati.</p>
      <div className="flex justify-between gap-2">
        <button type="button" className="btn-danger btn-sm" onClick={onDelete} disabled={disabled}>
          Elimina
        </button>
        <button type="button" className="btn-primary btn-sm" onClick={() => onSave(d)} disabled={disabled || d.endSec <= d.startSec}>
          Salva episodio
        </button>
      </div>
    </div>
  );
}

function StatsView({ stats, hasHalves }: { stats: ReturnType<typeof computeStats>; hasHalves: boolean }) {
  if (!stats.total) return <section className="panel muted p-6 text-center text-sm">Le statistiche compaiono quando ci sono episodi codificati.</section>;
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="panel p-3">
        <h3 className="mb-2 text-base font-semibold">Eventi codificati ({stats.total})</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-prama-500">
              <th className="py-1">Evento</th>
              <th className="py-1 text-right">Totale</th>
              {hasHalves ? (
                <>
                  <th className="py-1 text-right">1° t.</th>
                  <th className="py-1 text-right">2° t.</th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {stats.byCode.map((s) => (
              <tr key={s.code} className="border-t border-prama-100 dark:border-prama-800">
                <td className="py-1">
                  <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: colorOf(s.category) }} />
                  {s.label}
                </td>
                <td className="py-1 text-right tabular-nums">{s.total}</td>
                {hasHalves ? (
                  <>
                    <td className="py-1 text-right tabular-nums">{s.first}</td>
                    <td className="py-1 text-right tabular-nums">{s.second}</td>
                  </>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        {!hasHalves ? <p className="muted mt-2 text-xs">Segna l&apos;inizio del secondo tempo per vedere la divisione per tempi.</p> : null}
      </div>
      <div className="grid gap-4">
        <div className="panel p-3">
          <h3 className="mb-2 text-base font-semibold">Riuscita (solo coppie codificate)</h3>
          {stats.pairs.length ? (
            <ul className="grid gap-2 text-sm">
              {stats.pairs.map((p) => (
                <li key={p.label}>
                  <div className="flex justify-between">
                    <span>{p.label}</span>
                    <span className="tabular-nums">
                      {p.ok}/{p.ok + p.ko} · {p.pct}%
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded bg-prama-100 dark:bg-prama-800">
                    <div className="h-2 rounded bg-campo-500" style={{ width: `${p.pct}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted text-sm">Nessuna coppia riuscito/sbagliato codificata.</p>
          )}
          <p className="muted mt-2 text-xs">Percentuali calcolate solo sugli episodi codificati, non sull&apos;intera partita.</p>
        </div>
        <div className="panel p-3 text-sm">
          <h3 className="mb-2 text-base font-semibold">Giudizi e confidenza</h3>
          <p>
            {Object.entries(stats.ratings)
              .map(([k, n]) => `${RATING_LABELS[k as keyof typeof RATING_LABELS]} ${n}`)
              .join(" · ")}
          </p>
          <p className="mt-1">
            Confidenza:{" "}
            {Object.entries(stats.confidence)
              .map(([k, n]) => `${CONFIDENCE_LABELS[k as keyof typeof CONFIDENCE_LABELS]} ${n}`)
              .join(" · ")}
            {stats.confidenceMediumHighPct !== null ? ` · media o alta: ${stats.confidenceMediumHighPct}%` : ""}
          </p>
        </div>
      </div>
    </section>
  );
}
