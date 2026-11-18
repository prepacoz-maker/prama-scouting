import { describe, expect, it } from "vitest";
import { ATTRIBUTES } from "@/lib/rating";
import { athleteSchema, observationSchema, submissionIssues, userSchema, zoneSchema } from "@/lib/validation";

const today = new Date().toISOString().slice(0, 10);
const valid = {
  athleteId: "a1",
  date: today,
  eventType: "PARTITA",
  team: "Squadra Demo",
  category: "U15",
  minutes: "70",
  ...Object.fromEntries(ATTRIBUTES.map((a) => [a, 3])),
  strengths: "Primo controllo",
  improvements: "Continuità",
  interest: "MEDIO",
  action: "NUOVO_CONTROLLO",
};

describe("scheda di osservazione", () => {
  it("accetta una scheda completa e converte i minuti in numero", () => {
    const parsed = observationSchema.parse(valid);
    expect(parsed.minutes).toBe(70);
    expect(parsed.maturation).toBe("NON_VALUTABILE");
    expect(submissionIssues(parsed)).toEqual([]);
  });

  it("rifiuta voti fuori scala", () => {
    expect(observationSchema.safeParse({ ...valid, tecnica: 6 }).success).toBe(false);
    expect(observationSchema.safeParse({ ...valid, tecnica: 0 }).success).toBe(false);
    expect(observationSchema.safeParse({ ...valid, tecnica: null }).success).toBe(true);
  });

  it("rifiuta date future e minuti mancanti", () => {
    const future = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    expect(observationSchema.safeParse({ ...valid, date: future }).success).toBe(false);
    expect(observationSchema.safeParse({ ...valid, minutes: "" }).success).toBe(false);
  });

  it("blocca le informazioni sanitarie o familiari nei testi liberi", () => {
    const result = observationSchema.safeParse({ ...valid, notes: "Rientra da un infortunio al ginocchio" });
    expect(result.success).toBe(false);
    expect(observationSchema.safeParse({ ...valid, notes: "25' filtrante per la punta" }).success).toBe(true);
  });

  it("permette la bozza incompleta ma elenca che cosa manca per l'invio", () => {
    const draft = observationSchema.parse({ athleteId: "a1", date: today, eventType: "ALLENAMENTO", team: "Squadra Demo", category: "U15", minutes: 30 });
    const issues = submissionIssues(draft);
    expect(issues.length).toBe(5);
    expect(issues[0]).toContain("almeno 8 attributi");
  });
});

describe("profilo atleta, utenti e zone", () => {
  const athlete = { zoneId: "z1", roleGroup: "ATTACCANTE", primaryRole: "Punta", team: "Squadra Demo", category: "U15" };

  it("non richiede nome e cognome", () => {
    const parsed = athleteSchema.parse(athlete);
    expect(parsed.firstName).toBe("");
    expect(parsed.birthYear).toBeUndefined();
  });

  it("valida anno di nascita, altezza e reparto", () => {
    expect(athleteSchema.safeParse({ ...athlete, birthYear: "1950" }).success).toBe(false);
    expect(athleteSchema.safeParse({ ...athlete, heightCm: "300" }).success).toBe(false);
    expect(athleteSchema.safeParse({ ...athlete, roleGroup: "" }).success).toBe(false);
    expect(athleteSchema.parse({ ...athlete, birthYear: "2011", heightCm: "" }).birthYear).toBe(2011);
  });

  it("richiede password robuste e codici zona nel formato previsto", () => {
    expect(userSchema.safeParse({ name: "Mario Demo", email: "m@test.it", role: "SCOUT", password: "corta" }).success).toBe(false);
    expect(zoneSchema.safeParse({ code: "Z1", name: "Zona" }).success).toBe(false);
    expect(zoneSchema.safeParse({ code: "Z04", name: "Zona" }).success).toBe(true);
  });
});
