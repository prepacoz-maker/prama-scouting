import { describe, expect, it } from "vitest";
import { TEMPLATES, buttonsSchema, clipBounds, computeStats, eventsToCsv, fmtClock, halfOf, sessionSchema, youtubeId } from "../src/lib/match";

describe("match analysis", () => {
  it("formatta i tempi", () => {
    expect(fmtClock(0)).toBe("00:00");
    expect(fmtClock(75.4)).toBe("01:15");
    expect(fmtClock(3725)).toBe("1:02:05");
    expect(fmtClock(null)).toBe("--:--");
  });

  it("calcola i limiti della clip senza uscire dal video", () => {
    expect(clipBounds(3, 5, 3)).toEqual({ startSec: 0, endSec: 6 });
    expect(clipBounds(100, 5, 3, 101)).toEqual({ startSec: 95, endSec: 101 });
  });

  it("divide per tempi solo se il secondo tempo è segnato", () => {
    expect(halfOf(10, null)).toBeNull();
    expect(halfOf(10, 100)).toBe(1);
    expect(halfOf(100, 100)).toBe(2);
  });

  it("i modelli predefiniti sono validi (codici e tasti unici)", () => {
    for (const t of Object.values(TEMPLATES)) expect(buttonsSchema.safeParse(t.buttons).success).toBe(true);
  });

  it("rifiuta tasti ripetuti o riservati", () => {
    const base = TEMPLATES.calcio_movimento.buttons.slice(0, 2);
    expect(buttonsSchema.safeParse([base[0], { ...base[1], hotkey: base[0].hotkey }]).success).toBe(false);
    expect(buttonsSchema.safeParse([{ ...base[0], hotkey: "k" }]).success).toBe(false);
  });

  it("percentuali solo per coppie riuscito/sbagliato codificate", () => {
    const ev = (code: string, label: string, t: number) => ({ code, label, category: "Possesso", outcome: null, timeSec: t, rating: null, confidence: null });
    const stats = computeStats([ev("PASS_OK", "Passaggio riuscito", 10), ev("PASS_OK", "Passaggio riuscito", 200), ev("PASS_KO", "Passaggio sbagliato", 300), ev("RUN", "Movimento", 5)], 150);
    expect(stats.total).toBe(4);
    expect(stats.pairs).toEqual([{ label: "Passaggio", ok: 2, ko: 1, pct: 67 }]);
    expect(computeStats([ev("DUEL_OK", "Duello vinto", 1)]).pairs[0].label).toBe("Duello");
    expect(stats.byCode.find((s) => s.code === "PASS_OK")).toMatchObject({ first: 1, second: 1 });
  });

  it("CSV con separatore ; e formule neutralizzate", () => {
    const csv = eventsToCsv([
      { code: "PASS_OK", label: "Passaggio", category: "Possesso", outcome: "POSITIVO", timeSec: 10, startSec: 5, endSec: 13, rating: "BUONO", confidence: "ALTA", phase: "", fact: "=HYPERLINK(1)", inference: "a;b", recommendation: "", debrief: true },
    ]);
    const line = csv.split("\r\n")[1];
    expect(line).toContain("'=HYPERLINK(1)");
    expect(line).toContain('"a;b"');
    expect(line.startsWith("1;")).toBe(true);
  });

  it("riconosce i link YouTube", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=bEbvY-KLsrU")).toBe("bEbvY-KLsrU");
    expect(youtubeId("https://youtu.be/bEbvY-KLsrU?t=3")).toBe("bEbvY-KLsrU");
    expect(youtubeId("https://www.youtube.com/shorts/abcdefghijk")).toBe("abcdefghijk");
    expect(youtubeId("https://vimeo.com/123")).toBeNull();
  });

  it("l'intake richiede conferma dei diritti e link valido", () => {
    const base = { title: "Test", sport: "CALCIO", template: "calcio_movimento", date: "2026-11-26", competition: "", team: "Demo", opponent: "", score: "", roleTask: "", objective: "Tecnica", level: "", videoSource: "LINK", videoLabel: "link", videoAngle: "" };
    expect(sessionSchema.safeParse({ ...base, videoUrl: "https://youtu.be/bEbvY-KLsrU", rightsConfirmed: true }).success).toBe(true);
    expect(sessionSchema.safeParse({ ...base, videoUrl: "https://youtu.be/bEbvY-KLsrU", rightsConfirmed: false }).success).toBe(false);
    expect(sessionSchema.safeParse({ ...base, videoUrl: "javascript:alert(1)", rightsConfirmed: true }).success).toBe(false);
  });
});
