// Sistema di valutazione PRAMA: funzioni pure, senza accesso al database.
// Ogni numero mostrato all'utente deriva da qui, in modo trasparente e testabile.

/** Attributi dei giocatori di movimento (standard v2.1, 17). */
export const OUTFIELD_ATTRIBUTES = [
  "tecnica",
  "passaggio",
  "controllo",
  "finalizzazione",
  "dribbling",
  "velocita",
  "resistenza",
  "coordinazione",
  "intelligenzaTattica",
  "posizionamento",
  "decisionMaking",
  "lavoroDiSquadra",
  "mentalita",
  "disciplina",
  "reazioneErrori",
  "pressioneRiaggressione",
  "unoControUnoDifensivo",
] as const;

/** Attributi del portiere (set portiere v1, approvato il 25/11/2026). */
export const GK_ATTRIBUTES = [
  "gkPiazzamento",
  "gkPresaRespinta",
  "gkReattivita",
  "gkUsciteAlte",
  "gkUnoControUno",
  "gkProfondita",
  "gkGiocoPiedi",
  "gkDistribuzione",
  "gkLettura",
  "gkComunicazione",
  "gkCompetere",
  "gkReazioneErrore",
] as const;

/** Tutte le colonne di voto della scheda (movimento + portiere). */
export const ATTRIBUTES = [...OUTFIELD_ATTRIBUTES, ...GK_ATTRIBUTES] as const;
export const STANDARD_VERSION = "v2.1";
// Standard di valutazione PRAMA v2.1 (approvato il 23/11/2026).
// Le chiavi storiche restano per non migrare i dati; l'etichetta mostrata segue lo standard:
// controllo → Controllo orientato · passaggio → Trasmissione · tecnica → Conduzione · dribbling → 1 contro 1 offensivo
// finalizzazione → Attacco della porta · intelligenzaTattica → Scansione · posizionamento → Smarcamento e spazi
// velocita → Accelerazione · resistenza → Ripetizione degli sforzi · coordinazione → Agilità · mentalita → Competere
// lavoroDiSquadra → Collaborazione · reazioneErrori → Reazione all'errore. Nuove: pressioneRiaggressione, unoControUnoDifensivo.

export type Attribute = (typeof ATTRIBUTES)[number];
export type Ratings = Partial<Record<Attribute, number | null | undefined>>;
export type RoleGroup = "PORTIERE" | "DIFENSORE" | "CENTROCAMPISTA" | "ATTACCANTE";
export type Reliability = "NESSUNA" | "BASSA" | "MEDIA" | "ALTA";
export type Weights = Record<Attribute, number>;

export const ATTRIBUTE_LABELS: Record<Attribute, string> = {
  tecnica: "Conduzione",
  passaggio: "Trasmissione",
  controllo: "Controllo orientato",
  finalizzazione: "Attacco della porta",
  dribbling: "1 contro 1 offensivo",
  velocita: "Accelerazione",
  resistenza: "Ripetizione degli sforzi",
  coordinazione: "Agilità",
  intelligenzaTattica: "Scansione",
  posizionamento: "Smarcamento e spazi",
  decisionMaking: "Decision-making",
  lavoroDiSquadra: "Collaborazione",
  mentalita: "Competere",
  disciplina: "Disciplina",
  reazioneErrori: "Reazione all'errore",
  pressioneRiaggressione: "Pressione e riaggressione",
  unoControUnoDifensivo: "1 contro 1 difensivo",
  gkPiazzamento: "Piazzamento",
  gkPresaRespinta: "Presa e respinta",
  gkReattivita: "Reattività e tuffo",
  gkUsciteAlte: "Uscite alte",
  gkUnoControUno: "1 contro 1 del portiere",
  gkProfondita: "Difesa della profondità",
  gkGiocoPiedi: "Gioco con i piedi",
  gkDistribuzione: "Distribuzione",
  gkLettura: "Lettura e decisione",
  gkComunicazione: "Comunicazione e guida della difesa",
  gkCompetere: "Competere",
  gkReazioneErrore: "Reazione all'errore",
};

/** Le 5 aree dello standard v2.1 (momenti del gioco) e gli attributi che le compongono. */
export type Area = { key: string; label: string; attributes: Attribute[] };
export const AREAS: Area[] = [
  { key: "possesso", label: "Possesso", attributes: ["controllo", "passaggio", "tecnica", "dribbling", "finalizzazione"] },
  { key: "lettura", label: "Lettura", attributes: ["intelligenzaTattica", "posizionamento", "decisionMaking"] },
  { key: "nonPossesso", label: "Non possesso e transizioni", attributes: ["pressioneRiaggressione", "unoControUnoDifensivo"] },
  { key: "atletica", label: "Atletica", attributes: ["velocita", "resistenza", "coordinazione"] },
  { key: "mentalitaComportamento", label: "Mentalità e comportamento", attributes: ["mentalita", "reazioneErrori", "lavoroDiSquadra", "disciplina"] },
];

/** Le 4 aree del portiere. */
export const GK_AREAS: Area[] = [
  { key: "difesaPorta", label: "Difesa della porta", attributes: ["gkPiazzamento", "gkPresaRespinta", "gkReattivita"] },
  { key: "difesaSpazio", label: "Difesa dello spazio", attributes: ["gkUsciteAlte", "gkUnoControUno", "gkProfondita"] },
  { key: "gioco", label: "Gioco", attributes: ["gkGiocoPiedi", "gkDistribuzione", "gkLettura"] },
  { key: "mentalitaGuida", label: "Mentalità e guida", attributes: ["gkComunicazione", "gkCompetere", "gkReazioneErrore"] },
];

export const isGoalkeeper = (roleGroup: RoleGroup | string) => roleGroup === "PORTIERE";
/** Attributi, aree e minimo di voti della scheda usata per un reparto. */
export const attributesFor = (roleGroup: RoleGroup | string): readonly Attribute[] =>
  isGoalkeeper(roleGroup) ? GK_ATTRIBUTES : OUTFIELD_ATTRIBUTES;
export const areasFor = (roleGroup: RoleGroup | string): Area[] => (isGoalkeeper(roleGroup) ? GK_AREAS : AREAS);

const zeros = (list: readonly Attribute[]) => Object.fromEntries(list.map((a) => [a, 0]));
/** Pesi dei giocatori di movimento (portiere a 0). */
const w = (values: number[]): Weights =>
  ({ ...zeros(GK_ATTRIBUTES), ...Object.fromEntries(OUTFIELD_ATTRIBUTES.map((a, i) => [a, values[i]])) }) as Weights;
/** Pesi del portiere (movimento a 0). */
const wGk = (values: number[]): Weights =>
  ({ ...zeros(OUTFIELD_ATTRIBUTES), ...Object.fromEntries(GK_ATTRIBUTES.map((a, i) => [a, values[i]])) }) as Weights;

/** Pesi predefiniti (modificabili dall'admin). Ordine: come ATTRIBUTES. */
export const DEFAULT_WEIGHTS: Record<RoleGroup, Weights> = {
  // Set portiere v1: piaz pres reat usc 1c1 prof piedi distr lett com comp reaz
  PORTIERE: wGk([1.4, 1.3, 1.3, 1.2, 1.2, 1.0, 1.0, 0.9, 1.3, 1.0, 1.0, 1.2]),
  // Standard v2.1 movimento:
  //                    tec pas con fin dri vel res coo int pos dec squ men dis rea pre 1d
  DIFENSORE: w([0.8, 1.2, 1.1, 0.3, 0.4, 1.1, 1.0, 1.0, 1.3, 1.1, 1.2, 0.9, 1.1, 0.9, 1.0, 1.2, 1.6]),
  CENTROCAMPISTA: w([1.1, 1.5, 1.4, 0.6, 0.8, 0.8, 1.2, 1.0, 1.5, 1.2, 1.5, 1.0, 1.0, 0.8, 1.0, 1.2, 1.0]),
  ATTACCANTE: w([1.2, 0.9, 1.2, 1.6, 1.4, 1.3, 0.9, 1.0, 1.0, 1.4, 1.2, 0.8, 1.0, 0.7, 1.0, 1.0, 0.5]),
};

export const OVERALL_MIN = 40;
export const OVERALL_MAX = 99;
/** Numero minimo di attributi valutati per calcolare un overall. */
export const MIN_RATED_ATTRIBUTES = 9;
/** Minimo di attributi per il portiere (set portiere v1). */
export const MIN_RATED_GK = 6;
export const minRatedFor = (roleGroup: RoleGroup | string) => (isGoalkeeper(roleGroup) ? MIN_RATED_GK : MIN_RATED_ATTRIBUTES);
/** Quante osservazioni approvate (le più recenti) entrano nella media. */
export const OBSERVATIONS_WINDOW = 5;

const isRated = (v: unknown): v is number => typeof v === "number" && v >= 1 && v <= 5;

/** Media per attributo sulle osservazioni fornite; null se mai valutato. */
export function averageRatings(observations: Ratings[]): Record<Attribute, number | null> {
  const out = {} as Record<Attribute, number | null>;
  for (const a of ATTRIBUTES) {
    const values = observations.map((o) => o[a]).filter(isRated);
    out[a] = values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
  }
  return out;
}

/** Converte una media 1-5 nella scala 40-99. */
export function toScale(mean: number): number {
  const clamped = Math.min(5, Math.max(1, mean));
  return Math.round(OVERALL_MIN + ((clamped - 1) / 4) * (OVERALL_MAX - OVERALL_MIN));
}

/**
 * Overall PRAMA: media ponderata degli attributi valutati, riportata su 40-99.
 * Gli attributi non valutati sono esclusi e i pesi rinormalizzati.
 * Restituisce null se gli attributi valutati sono meno di MIN_RATED_ATTRIBUTES.
 */
export function computeOverall(ratings: Ratings, weights: Weights, minRated = MIN_RATED_ATTRIBUTES): number | null {
  let sum = 0;
  let weightSum = 0;
  let rated = 0;
  for (const a of ATTRIBUTES) {
    const v = ratings[a];
    const weight = weights[a] ?? 0;
    if (!isRated(v)) continue;
    rated += 1;
    if (weight <= 0) continue;
    sum += v * weight;
    weightSum += weight;
  }
  if (rated < minRated || weightSum === 0) return null;
  return toScale(sum / weightSum);
}

export function areaScores(
  ratings: Ratings,
  areas: Area[] = AREAS,
): { key: string; label: string; attributes: readonly Attribute[]; value: number | null }[] {
  return areas.map((area) => {
    const values = area.attributes.map((a) => ratings[a]).filter(isRated);
    return {
      key: area.key,
      label: area.label,
      attributes: area.attributes,
      value: values.length ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10 : null,
    };
  });
}

/** Affidabilità: dipende dal numero di osservazioni approvate e dalla loro attualità. */
export function computeReliability(approvedCount: number, lastObservedAt: Date | null, now = new Date()): Reliability {
  if (approvedCount <= 0 || !lastObservedAt) return "NESSUNA";
  let level: Reliability = approvedCount >= 4 ? "ALTA" : approvedCount >= 2 ? "MEDIA" : "BASSA";
  const days = (now.getTime() - lastObservedAt.getTime()) / 86_400_000;
  if (days > 180) level = level === "ALTA" ? "MEDIA" : "BASSA";
  return level;
}

/** Serve un nuovo controllo se la valutazione è fragile, datata o se la scadenza è passata. */
export function needsNewCheck(
  reliability: Reliability,
  lastObservedAt: Date | null,
  nextCheckAt: Date | null,
  now = new Date(),
): boolean {
  if (reliability === "NESSUNA" || reliability === "BASSA") return true;
  if (nextCheckAt && nextCheckAt.getTime() <= now.getTime()) return true;
  if (!lastObservedAt) return true;
  return (now.getTime() - lastObservedAt.getTime()) / 86_400_000 > 90;
}

const LEARNING_ATTRIBUTES: Attribute[] = [
  "decisionMaking",
  "intelligenzaTattica",
  "mentalita",
  "reazioneErrori",
  "coordinazione",
  "gkLettura",
  "gkReattivita",
  "gkCompetere",
  "gkReazioneErrore",
];

/**
 * Potenziale PRAMA: stima prudente, espressa come intervallo e mai come promessa.
 * - richiede almeno due osservazioni approvate;
 * - parte dall'overall attuale;
 * - aggiunge un margine (max 6) legato agli attributi che meglio sostengono l'apprendimento;
 * - aggiunge un margine (max 3) se l'overall è cresciuto tra prima e ultima osservazione;
 * - il margine totale non supera 8 punti; l'estremo superiore non supera overall + 10 né 95;
 * - l'ampiezza dell'intervallo dipende dall'affidabilità (±2 alta, ±3 negli altri casi).
 */
export function computePotential(input: {
  overall: number | null;
  ratings: Ratings;
  approvedCount: number;
  firstOverall: number | null;
  lastOverall: number | null;
  reliability: Reliability;
}): { min: number; max: number } | null {
  const { overall, ratings, approvedCount, firstOverall, lastOverall, reliability } = input;
  if (overall === null || approvedCount < 2) return null;

  const learning = LEARNING_ATTRIBUTES.map((a) => ratings[a]).filter(isRated);
  const learningMean = learning.length ? learning.reduce((s, v) => s + v, 0) / learning.length : 3;
  const headroom = Math.min(1, Math.max(0, (learningMean - 3) / 2)) * 6;

  const delta = firstOverall !== null && lastOverall !== null ? lastOverall - firstOverall : 0;
  const trend = Math.min(3, Math.max(0, delta / 2));

  const center = overall + Math.min(8, headroom + trend);
  const half = reliability === "ALTA" ? 2 : 3;
  const min = Math.min(95, Math.max(overall, Math.round(center - half)));
  const max = Math.min(95, overall + 10, Math.round(center + half));
  return { min, max: Math.max(min, max) };
}

export type BadgeKey = "VISIONE" | "ESPLOSIVITA" | "AFFIDABILITA" | "INTENSITA" | "LEADERSHIP" | "MIGLIORAMENTO" | "TECNICA_PULITA";

export const BADGES: Record<BadgeKey, { label: string; description: string }> = {
  VISIONE: { label: "Lettura del gioco", description: "Scansione e decision-making sopra la media in modo costante." },
  ESPLOSIVITA: { label: "Accelerazione", description: "Accelerazione e cambio di ritmo distintivi per la categoria." },
  AFFIDABILITA: { label: "Affidabilità", description: "Disciplina e collaborazione costanti." },
  INTENSITA: { label: "Intensità senza palla", description: "Pressione, riaggressione e 1 contro 1 difensivo sopra la media." },
  LEADERSHIP: { label: "Leadership", description: "Competitività e influenza positiva sui compagni." },
  MIGLIORAMENTO: { label: "Miglioramento rapido", description: "Crescita misurata tra la prima e l'ultima osservazione." },
  TECNICA_PULITA: { label: "Qualità in possesso", description: "Controllo orientato, trasmissione e conduzione sopra la media." },
};

const mean = (values: (number | null)[]) => {
  const v = values.filter((x): x is number => x !== null);
  return v.length === values.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};

/** Badge assegnati in automatico: servono almeno due osservazioni approvate. */
export function computeBadges(input: {
  averages: Record<Attribute, number | null>;
  approvedCount: number;
  firstOverall: number | null;
  lastOverall: number | null;
}): BadgeKey[] {
  const { averages: a, approvedCount, firstOverall, lastOverall } = input;
  if (approvedCount < 2) return [];
  const out: BadgeKey[] = [];
  const atLeast = (value: number | null, threshold: number) => value !== null && value >= threshold;

  if (atLeast(mean([a.intelligenzaTattica, a.decisionMaking]), 4.25)) out.push("VISIONE");
  if (atLeast(a.velocita, 4.5)) out.push("ESPLOSIVITA");
  if (atLeast(mean([a.disciplina, a.lavoroDiSquadra]), 4.25)) out.push("AFFIDABILITA");
  if (atLeast(mean([a.pressioneRiaggressione, a.unoControUnoDifensivo]), 4.25)) out.push("INTENSITA");
  if (atLeast(a.mentalita, 4.5) && atLeast(a.lavoroDiSquadra, 4)) out.push("LEADERSHIP");
  if (atLeast(mean([a.tecnica, a.controllo, a.passaggio]), 4.25)) out.push("TECNICA_PULITA");
  if (approvedCount >= 3 && firstOverall !== null && lastOverall !== null && lastOverall - firstOverall >= 5) {
    out.push("MIGLIORAMENTO");
  }
  return out;
}

/** Le aree di sviluppo sono i tre attributi valutati con la media più bassa (sotto 3,5). */
export function developmentAreas(averages: Record<Attribute, number | null>, limit = 3): Attribute[] {
  return ATTRIBUTES.filter((a) => averages[a] !== null && (averages[a] as number) < 3.5)
    .sort((x, y) => (averages[x] as number) - (averages[y] as number))
    .slice(0, limit);
}
