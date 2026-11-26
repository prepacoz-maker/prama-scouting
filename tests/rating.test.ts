import { describe, expect, it } from "vitest";
import {
  ATTRIBUTES,
  DEFAULT_WEIGHTS,
  GK_ATTRIBUTES,
  MIN_RATED_GK,
  OUTFIELD_ATTRIBUTES,
  areaScores,
  areasFor,
  averageRatings,
  computeBadges,
  computeOverall,
  computePotential,
  computeReliability,
  developmentAreas,
  needsNewCheck,
  toScale,
  type Ratings,
} from "@/lib/rating";

const all = (value: number | null): Ratings => Object.fromEntries(ATTRIBUTES.map((a) => [a, value]));
const DAY = 86_400_000;

describe("overall PRAMA", () => {
  it("riporta la scala 1-5 su 40-99", () => {
    expect(toScale(1)).toBe(40);
    expect(toScale(5)).toBe(99);
    expect(toScale(3)).toBe(70);
  });

  it("resta sempre tra 40 e 99 per ogni reparto", () => {
    for (const weights of Object.values(DEFAULT_WEIGHTS)) {
      expect(computeOverall(all(1), weights)).toBe(40);
      expect(computeOverall(all(5), weights)).toBe(99);
    }
  });

  it("non calcola un valore con meno di 8 attributi valutati", () => {
    const ratings = { ...all(null), tecnica: 5, passaggio: 5, controllo: 5 };
    expect(computeOverall(ratings, DEFAULT_WEIGHTS.ATTACCANTE)).toBeNull();
  });

  it("esclude gli attributi non valutabili e rinormalizza i pesi", () => {
    const ratings = { ...all(4), finalizzazione: null, dribbling: null };
    expect(computeOverall(ratings, DEFAULT_WEIGHTS.PORTIERE)).toBe(toScale(4));
  });

  it("applica pesi diversi in base al reparto", () => {
    const ratings = { ...all(3), finalizzazione: 5, dribbling: 5 };
    const striker = computeOverall(ratings, DEFAULT_WEIGHTS.ATTACCANTE)!;
    const keeper = computeOverall(ratings, DEFAULT_WEIGHTS.PORTIERE)!;
    expect(striker).toBeGreaterThan(keeper);
  });

  it("fa la media per attributo ignorando i non valutati", () => {
    const avg = averageRatings([{ tecnica: 4 }, { tecnica: 2 }, { tecnica: null }]);
    expect(avg.tecnica).toBe(3);
    expect(avg.passaggio).toBeNull();
  });
});

describe("potenziale PRAMA (stima prudente)", () => {
  const base = { ratings: all(4), firstOverall: 70, lastOverall: 80, reliability: "MEDIA" as const };

  it("non si stima con una sola osservazione", () => {
    expect(computePotential({ ...base, overall: 80, approvedCount: 1 })).toBeNull();
    expect(computePotential({ ...base, overall: null, approvedCount: 3 })).toBeNull();
  });

  it("non scende sotto l'overall e non lo supera di oltre 10 punti", () => {
    for (const overall of [45, 60, 75, 90, 99]) {
      const p = computePotential({ ...base, ratings: all(5), overall, approvedCount: 4, reliability: "ALTA" })!;
      expect(p.min).toBeGreaterThanOrEqual(Math.min(95, overall));
      expect(p.max).toBeLessThanOrEqual(Math.max(p.min, Math.min(95, overall + 10)));
      expect(p.max).toBeGreaterThanOrEqual(p.min);
    }
  });

  it("senza segnali di apprendimento né crescita resta vicino all'overall", () => {
    const p = computePotential({ overall: 70, ratings: all(3), approvedCount: 2, firstOverall: 70, lastOverall: 70, reliability: "MEDIA" })!;
    expect(p.min).toBe(70);
    expect(p.max).toBeLessThanOrEqual(73);
  });

  it("l'intervallo è più stretto con affidabilità alta", () => {
    const high = computePotential({ ...base, overall: 75, approvedCount: 4, reliability: "ALTA" })!;
    const medium = computePotential({ ...base, overall: 75, approvedCount: 2, reliability: "MEDIA" })!;
    expect(high.max - high.min).toBeLessThanOrEqual(medium.max - medium.min);
  });
});

describe("affidabilità e nuovo controllo", () => {
  const now = new Date("2026-11-18T12:00:00Z");
  const ago = (days: number) => new Date(now.getTime() - days * DAY);

  it("dipende dal numero di osservazioni approvate", () => {
    expect(computeReliability(0, null, now)).toBe("NESSUNA");
    expect(computeReliability(1, ago(5), now)).toBe("BASSA");
    expect(computeReliability(2, ago(5), now)).toBe("MEDIA");
    expect(computeReliability(4, ago(5), now)).toBe("ALTA");
  });

  it("scende di un livello se l'ultima osservazione è datata", () => {
    expect(computeReliability(4, ago(200), now)).toBe("MEDIA");
    expect(computeReliability(2, ago(200), now)).toBe("BASSA");
  });

  it("segnala il bisogno di un nuovo controllo", () => {
    expect(needsNewCheck("BASSA", ago(5), null, now)).toBe(true);
    expect(needsNewCheck("ALTA", ago(5), null, now)).toBe(false);
    expect(needsNewCheck("ALTA", ago(100), null, now)).toBe(true);
    expect(needsNewCheck("ALTA", ago(5), ago(1), now)).toBe(true);
  });
});

describe("badge e aree di sviluppo", () => {
  it("non assegna badge con una sola osservazione", () => {
    expect(computeBadges({ averages: averageRatings([all(5)]), approvedCount: 1, firstOverall: 99, lastOverall: 99 })).toEqual([]);
  });

  it("assegna i badge in base a soglie esplicite", () => {
    const averages = averageRatings([{ ...all(3), intelligenzaTattica: 5, decisionMaking: 4, velocita: 5 }]);
    const badges = computeBadges({ averages, approvedCount: 3, firstOverall: 70, lastOverall: 76 });
    expect(badges).toContain("VISIONE");
    expect(badges).toContain("ESPLOSIVITA");
    expect(badges).toContain("MIGLIORAMENTO");
    expect(badges).not.toContain("LEADERSHIP");
  });

  it("indica al massimo tre aree di sviluppo, dalla più bassa", () => {
    const averages = averageRatings([{ ...all(4), resistenza: 2, finalizzazione: 3, dribbling: 1, velocita: 3 }]);
    expect(developmentAreas(averages)).toEqual(["dribbling", "resistenza", "finalizzazione"]);
  });
});

describe("standard v2.1 e set portiere", () => {
  const only = (attrs: readonly string[], value: number): Ratings =>
    Object.fromEntries(ATTRIBUTES.map((a) => [a, attrs.includes(a) ? value : null]));

  it("ha 17 attributi di movimento e 12 del portiere", () => {
    expect(OUTFIELD_ATTRIBUTES.length).toBe(17);
    expect(GK_ATTRIBUTES.length).toBe(12);
  });

  it("calcola l'Overall del portiere solo con gli attributi della scheda portiere", () => {
    const gk = only(GK_ATTRIBUTES, 4);
    expect(computeOverall(gk, DEFAULT_WEIGHTS.PORTIERE, MIN_RATED_GK)).not.toBeNull();
    // I voti di movimento non incidono sul portiere (peso 0).
    const mixed = { ...gk, ...only(OUTFIELD_ATTRIBUTES, 1) } as Ratings;
    for (const a of GK_ATTRIBUTES) mixed[a] = 4;
    expect(computeOverall(mixed, DEFAULT_WEIGHTS.PORTIERE, MIN_RATED_GK)).toBe(computeOverall(gk, DEFAULT_WEIGHTS.PORTIERE, MIN_RATED_GK));
    // Un giocatore di movimento con soli voti da portiere non ha Overall.
    expect(computeOverall(gk, DEFAULT_WEIGHTS.DIFENSORE)).toBeNull();
  });

  it("usa 5 aree per il movimento e 4 per il portiere", () => {
    expect(areasFor("ATTACCANTE").length).toBe(5);
    expect(areasFor("PORTIERE").length).toBe(4);
    expect(areaScores(only(GK_ATTRIBUTES, 3), areasFor("PORTIERE")).every((a) => a.value === 3)).toBe(true);
  });

  it("assegna il badge Intensità senza palla con pressione e 1 contro 1 difensivo alti", () => {
    const averages = { ...all(3), pressioneRiaggressione: 5, unoControUnoDifensivo: 4 } as Ratings;
    expect(computeBadges({ averages, approvedCount: 3, firstOverall: null, lastOverall: null })).toContain("INTENSITA");
  });
});
