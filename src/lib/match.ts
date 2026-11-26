// Match analysis: modelli di codifica, validazione e funzioni pure (statistiche, export, link video).
import { z } from "zod";

export type Outcome = "POSITIVO" | "NEGATIVO" | "NEUTRO";

/** Un pulsante del pannello di codifica. */
export interface CodeButton {
  code: string; // chiave stabile, es. PASS_OK
  label: string;
  category: string;
  hotkey: string; // una lettera o una cifra
  outcome: Outcome | null;
  pre: number; // secondi prima della pressione
  post: number; // secondi dopo la pressione
}

export const CATEGORY_COLORS: Record<string, string> = {
  Possesso: "#2B4470",
  "Non possesso": "#A87A1C",
  Movimento: "#24744A",
  Portiere: "#5F7BAA",
  "Palla inattiva": "#6B7280",
  Altro: "#6B7280",
};

const b = (code: string, label: string, category: string, hotkey: string, outcome: Outcome | null, pre = 5, post = 3): CodeButton => ({
  code,
  label,
  category,
  hotkey,
  outcome,
  pre,
  post,
});

/** Modelli predefiniti. Il pannello della sessione è una copia: si può personalizzare senza toccare il modello. */
export const TEMPLATES: Record<string, { label: string; sport: "CALCIO" | "BASKET"; buttons: CodeButton[] }> = {
  calcio_movimento: {
    label: "Calcio · giocatore di movimento",
    sport: "CALCIO",
    buttons: [
      b("PASS_OK", "Passaggio riuscito", "Possesso", "q", "POSITIVO"),
      b("PASS_KO", "Passaggio sbagliato", "Possesso", "w", "NEGATIVO"),
      b("PASS_KEY", "Passaggio chiave", "Possesso", "e", "POSITIVO", 6, 3),
      b("CONTROL", "Controllo orientato", "Possesso", "r", "POSITIVO", 4, 2),
      b("DRIB_OK", "Dribbling riuscito", "Possesso", "t", "POSITIVO"),
      b("DRIB_KO", "Dribbling fallito", "Possesso", "y", "NEGATIVO"),
      b("SHOT_ON", "Tiro in porta", "Possesso", "u", "POSITIVO", 6, 3),
      b("SHOT_OFF", "Tiro fuori", "Possesso", "i", "NEGATIVO", 6, 3),
      b("GOAL", "Gol", "Possesso", "o", "POSITIVO", 10, 5),
      b("LOST", "Palla persa", "Possesso", "p", "NEGATIVO"),
      b("DUEL_OK", "Duello vinto", "Non possesso", "a", "POSITIVO"),
      b("DUEL_KO", "Duello perso", "Non possesso", "s", "NEGATIVO"),
      b("RECOVER", "Recupero palla", "Non possesso", "d", "POSITIVO"),
      b("PRESS", "Pressione / riaggressione", "Non possesso", "f", null, 4, 4),
      b("INTERCEPT", "Intercetto", "Non possesso", "g", "POSITIVO"),
      b("1V1_DEF", "1 contro 1 difensivo", "Non possesso", "h", null, 5, 3),
      b("RUN", "Movimento senza palla", "Movimento", "z", null, 6, 3),
      b("TRANS_POS", "Transizione positiva", "Movimento", "x", null, 4, 6),
      b("TRANS_NEG", "Transizione negativa", "Movimento", "c", null, 4, 6),
      b("POS_ERR", "Errore di posizionamento", "Movimento", "v", "NEGATIVO", 6, 3),
      b("SET_PIECE", "Palla inattiva", "Palla inattiva", "b", null, 3, 8),
      b("REVIEW", "Episodio da rivedere", "Altro", "n", null, 5, 5),
    ],
  },
  calcio_portiere: {
    label: "Calcio · portiere",
    sport: "CALCIO",
    buttons: [
      b("GK_SAVE", "Parata", "Portiere", "q", "POSITIVO", 6, 3),
      b("GK_PARRY", "Respinta corta", "Portiere", "w", "NEGATIVO", 6, 3),
      b("GK_HIGH_OK", "Uscita alta riuscita", "Portiere", "e", "POSITIVO", 5, 3),
      b("GK_HIGH_KO", "Uscita alta sbagliata", "Portiere", "r", "NEGATIVO", 5, 3),
      b("GK_1V1", "1 contro 1", "Portiere", "t", null, 6, 3),
      b("GK_SWEEP", "Uscita in profondità", "Portiere", "y", null, 5, 3),
      b("GK_SHORT_OK", "Distribuzione corta riuscita", "Possesso", "a", "POSITIVO", 3, 4),
      b("GK_SHORT_KO", "Distribuzione corta sbagliata", "Possesso", "s", "NEGATIVO", 3, 4),
      b("GK_LONG_OK", "Rilancio lungo riuscito", "Possesso", "d", "POSITIVO", 3, 5),
      b("GK_LONG_KO", "Rilancio lungo sbagliato", "Possesso", "f", "NEGATIVO", 3, 5),
      b("GK_FEET", "Gioco con i piedi sotto pressione", "Possesso", "g", null, 4, 3),
      b("GK_COMM", "Comunicazione / guida della linea", "Movimento", "z", null, 5, 3),
      b("GK_POS_ERR", "Errore di piazzamento", "Movimento", "x", "NEGATIVO", 6, 3),
      b("GOAL_CONCEDED", "Gol subito", "Portiere", "c", "NEGATIVO", 10, 4),
      b("SET_PIECE", "Palla inattiva", "Palla inattiva", "b", null, 3, 8),
      b("REVIEW", "Episodio da rivedere", "Altro", "n", null, 5, 5),
    ],
  },
};

export const RATING_LABELS = { ECCELLENTE: "Eccellente", BUONO: "Buono", DA_MIGLIORARE: "Da migliorare", CRITICO: "Critico" } as const;
export const CONFIDENCE_LABELS = { ALTA: "Alta", MEDIA: "Media", BASSA: "Bassa" } as const;
export const OUTCOME_LABELS = { POSITIVO: "Positivo", NEGATIVO: "Negativo", NEUTRO: "Neutro" } as const;
export const PHASES = [
  "Possesso consolidato",
  "Costruzione",
  "Transizione positiva",
  "Transizione negativa",
  "Non possesso",
  "Palla inattiva",
] as const;

/** Tasti riservati ai comandi del player. */
export const RESERVED_KEYS = [" ", "k", "j", "l", ",", ".", "m"];

// ─── Validazione ────────────────────────────────────────────────────────────

const text = (max: number) => z.string().trim().max(max, `Massimo ${max} caratteri.`);

export const codeButtonSchema = z.object({
  code: z.string().trim().min(1).max(40).regex(/^[A-Z0-9_]+$/, "Codice: solo lettere maiuscole, cifre e _."),
  label: text(60).min(1, "Nome del pulsante obbligatorio."),
  category: text(40).min(1, "Categoria obbligatoria."),
  hotkey: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]?$/, "Tasto rapido: una lettera o una cifra.")
    .refine((k) => !RESERVED_KEYS.includes(k), "Tasto riservato ai comandi del player."),
  outcome: z.enum(["POSITIVO", "NEGATIVO", "NEUTRO"]).nullable(),
  pre: z.number().min(0).max(60),
  post: z.number().min(0).max(60),
});

export const buttonsSchema = z
  .array(codeButtonSchema)
  .min(1, "Serve almeno un pulsante.")
  .max(60, "Massimo 60 pulsanti.")
  .superRefine((buttons, ctx) => {
    const codes = new Set<string>();
    const keys = new Set<string>();
    for (const btn of buttons) {
      if (codes.has(btn.code)) ctx.addIssue({ code: "custom", message: `Codice ripetuto: ${btn.code}.` });
      codes.add(btn.code);
      if (btn.hotkey) {
        if (keys.has(btn.hotkey)) ctx.addIssue({ code: "custom", message: `Tasto rapido ripetuto: ${btn.hotkey.toUpperCase()}.` });
        keys.add(btn.hotkey);
      }
    }
  });

const isHttpUrl = (v: string) => {
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
};

export const sessionSchema = z
  .object({
    title: text(120).min(3, "Titolo obbligatorio."),
    sport: z.enum(["CALCIO", "BASKET"]),
    template: z.string().refine((t) => t in TEMPLATES, "Modello di codifica non valido."),
    date: z.string().min(1, "Data obbligatoria."),
    competition: text(120),
    team: text(120).min(1, "Squadra obbligatoria."),
    opponent: text(120),
    score: text(20),
    athleteId: z.string().optional().nullable(),
    roleTask: text(300),
    objective: text(300).min(3, "Obiettivo dell'analisi obbligatorio."),
    level: text(60),
    minutes: z.number().int().min(0).max(200).nullable().optional(),
    videoSource: z.enum(["FILE_LOCALE", "LINK"]),
    videoLabel: text(200).min(1, "Indica il nome del file o una descrizione del link."),
    videoUrl: z.string().trim().max(500).optional().nullable(),
    videoAngle: text(200),
    rightsConfirmed: z.literal(true, { errorMap: () => ({ message: "Conferma diritti sul video e consensi prima di aprire l'analisi." }) }),
  })
  .superRefine((v, ctx) => {
    if (v.videoSource === "LINK" && (!v.videoUrl || !isHttpUrl(v.videoUrl))) {
      ctx.addIssue({ code: "custom", path: ["videoUrl"], message: "Inserisci un link valido (https://...)." });
    }
  });

export const eventCreateSchema = z.object({
  sessionId: z.string().min(1),
  code: z.string().min(1).max(40),
  timeSec: z.number().min(0).max(6 * 3600),
});

export const eventUpdateSchema = z
  .object({
    id: z.string().min(1),
    startSec: z.number().min(0).max(6 * 3600),
    endSec: z.number().min(0).max(6 * 3600),
    rating: z.enum(["ECCELLENTE", "BUONO", "DA_MIGLIORARE", "CRITICO"]).nullable(),
    confidence: z.enum(["ALTA", "MEDIA", "BASSA"]).nullable(),
    outcome: z.enum(["POSITIVO", "NEGATIVO", "NEUTRO"]).nullable(),
    phase: text(60),
    fact: text(2000),
    inference: text(2000),
    recommendation: text(2000),
    debrief: z.boolean(),
  })
  .refine((v) => v.endSec > v.startSec, { message: "La fine della clip deve seguire l'inizio.", path: ["endSec"] });

const point = z.object({ x: z.number().min(-0.5).max(1.5), y: z.number().min(-0.5).max(1.5) });
export const shapeSchema = z.object({
  type: z.enum(["arrow", "line", "circle", "zone", "text", "free"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  points: z.array(point).min(1).max(500),
  text: z.string().max(80).optional(),
});
export type Shape = z.infer<typeof shapeSchema>;
export const drawingSchema = z.object({
  id: z.string().min(1),
  drawingSec: z.number().min(0).nullable(),
  shapes: z.array(shapeSchema).max(50),
});

export const reportSchema = z.object({
  id: z.string().min(1),
  summary: text(3000),
  strengths: text(3000),
  improvements: text(3000),
  mainRecommendation: text(1000),
  patterns: text(4000),
  plan: text(4000),
  questions: text(2000),
  limits: text(2000),
  athleteFeedback: text(2000),
  status: z.enum(["IN_CORSO", "COMPLETATA"]),
});

export const playlistSchema = z.object({
  sessionId: z.string().min(1),
  name: text(80).min(1, "Nome della playlist obbligatorio."),
  eventIds: z.array(z.string().min(1)).min(1, "Seleziona almeno un episodio.").max(200),
});

// ─── Funzioni pure ──────────────────────────────────────────────────────────

/** 75.4 → "01:15"; oltre l'ora "1:02:05". */
export function fmtClock(sec: number | null | undefined): string {
  if (sec === null || sec === undefined || !Number.isFinite(sec) || sec < 0) return "--:--";
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
}

/** Limiti della clip attorno alla pressione del pulsante, senza uscire dal video. */
export function clipBounds(timeSec: number, pre: number, post: number, durationSec?: number | null) {
  const startSec = Math.max(0, timeSec - pre);
  let endSec = timeSec + post;
  if (durationSec && durationSec > 0) endSec = Math.min(endSec, durationSec);
  if (endSec <= startSec) endSec = startSec + 0.5;
  return { startSec: round2(startSec), endSec: round2(endSec) };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** 1 = primo tempo, 2 = secondo tempo; null se l'inizio del secondo tempo non è segnato. */
export function halfOf(timeSec: number, secondHalfSec: number | null | undefined): 1 | 2 | null {
  if (secondHalfSec === null || secondHalfSec === undefined) return null;
  return timeSec >= secondHalfSec ? 2 : 1;
}

export interface StatEvent {
  code: string;
  label: string;
  category: string;
  outcome: Outcome | null;
  timeSec: number;
  rating: keyof typeof RATING_LABELS | null;
  confidence: keyof typeof CONFIDENCE_LABELS | null;
}

export interface CodeStat {
  code: string;
  label: string;
  category: string;
  total: number;
  first: number;
  second: number;
}

/**
 * Statistiche ricavate solo dai tag. Le percentuali di riuscita si calcolano solo per le coppie
 * riuscito/sbagliato in cui entrambi gli esiti sono codificati (numeratore e denominatore osservati).
 */
export function computeStats(events: StatEvent[], secondHalfSec?: number | null) {
  const byCode = new Map<string, CodeStat>();
  for (const e of events) {
    const s = byCode.get(e.code) ?? { code: e.code, label: e.label, category: e.category, total: 0, first: 0, second: 0 };
    s.total += 1;
    const half = halfOf(e.timeSec, secondHalfSec);
    if (half === 1) s.first += 1;
    if (half === 2) s.second += 1;
    byCode.set(e.code, s);
  }
  const ratings = { ECCELLENTE: 0, BUONO: 0, DA_MIGLIORARE: 0, CRITICO: 0 };
  const confidence = { ALTA: 0, MEDIA: 0, BASSA: 0 };
  let positive = 0;
  let negative = 0;
  for (const e of events) {
    if (e.rating) ratings[e.rating] += 1;
    if (e.confidence) confidence[e.confidence] += 1;
    if (e.outcome === "POSITIVO") positive += 1;
    if (e.outcome === "NEGATIVO") negative += 1;
  }
  const pairs = successRates([...byCode.values()]);
  const rated = Object.values(confidence).reduce((a, n) => a + n, 0);
  return {
    total: events.length,
    byCode: [...byCode.values()].sort((a, b) => b.total - a.total),
    ratings,
    confidence,
    positive,
    negative,
    pairs,
    confidenceMediumHighPct: rated ? Math.round(((confidence.ALTA + confidence.MEDIA) / rated) * 100) : null,
  };
}

/** Coppie note riuscito/sbagliato (suffissi _OK/_KO, ON/OFF). */
export function successRates(stats: CodeStat[]) {
  const map = new Map(stats.map((s) => [s.code, s]));
  const out: { label: string; ok: number; ko: number; pct: number }[] = [];
  for (const s of stats) {
    const m = s.code.match(/^(.*)_(OK|ON)$/);
    if (!m) continue;
    const koCode = `${m[1]}_${m[2] === "OK" ? "KO" : "OFF"}`;
    const ko = map.get(koCode);
    const okN = s.total;
    const koN = ko?.total ?? 0;
    if (okN + koN === 0) continue;
    const base = s.label.replace(/\s+(riuscit[oa]|vint[oa]|in porta)$/i, "");
    out.push({ label: base, ok: okN, ko: koN, pct: Math.round((okN / (okN + koN)) * 100) });
  }
  return out;
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Neutralizza le formule quando il file viene aperto in un foglio di calcolo.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export interface CsvEvent extends StatEvent {
  startSec: number;
  endSec: number;
  phase: string;
  fact: string;
  inference: string;
  recommendation: string;
  debrief: boolean;
}

/** Export CSV (separatore ; per Excel in italiano). */
export function eventsToCsv(events: CsvEvent[], secondHalfSec?: number | null): string {
  const header = ["n", "tempo", "inizio", "fine", "codice", "evento", "categoria", "esito", "giudizio", "confidenza", "fase", "fatto", "inferenza", "raccomandazione", "debrief"];
  const rows = events.map((e, i) => [
    i + 1,
    halfOf(e.timeSec, secondHalfSec) ?? "",
    fmtClock(e.startSec),
    fmtClock(e.endSec),
    e.code,
    e.label,
    e.category,
    e.outcome ? OUTCOME_LABELS[e.outcome] : "",
    e.rating ? RATING_LABELS[e.rating] : "",
    e.confidence ? CONFIDENCE_LABELS[e.confidence] : "",
    e.phase,
    e.fact,
    e.inference,
    e.recommendation,
    e.debrief ? "sì" : "",
  ]);
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
}

/** ID YouTube da un link (watch, youtu.be, shorts, embed, live); null se non è YouTube. */
export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return clean(u.pathname.slice(1));
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.searchParams.get("v")) return clean(u.searchParams.get("v"));
      const m = u.pathname.match(/^\/(embed|shorts|live|v)\/([^/?#]+)/);
      if (m) return clean(m[2]);
    }
  } catch {
    return null;
  }
  return null;
}
const clean = (id: string | null) => (id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null);
