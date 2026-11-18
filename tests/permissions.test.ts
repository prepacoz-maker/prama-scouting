import { describe, expect, it } from "vitest";
import {
  athleteScopeWhere,
  can,
  canEditObservation,
  canManageAthlete,
  canReviewObservation,
  canSeeIdentity,
  canViewAthlete,
  observationScopeWhere,
  type SessionUser,
} from "@/lib/permissions";

const user = (role: SessionUser["role"], id: string, zoneId: string | null): SessionUser => ({ id, role, zoneId, name: id, email: `${id}@test` });
const scout = user("SCOUT", "scout-a", "z1");
const otherScout = user("SCOUT", "scout-b", "z1");
const referente = user("REFERENTE", "ref-a", "z1");
const admin = user("ADMIN", "admin", null);

const inZone = { zoneId: "z1", createdById: "scout-a", assignedScoutId: null };
const outOfZone = { zoneId: "z2", createdById: "someone", assignedScoutId: null };
const obs = (reviewStatus: "BOZZA" | "DA_VALUTARE" | "INTEGRAZIONE_RICHIESTA" | "APPROVATA", scoutId = "scout-a", zoneId = "z1") => ({ reviewStatus, scoutId, zoneId });

describe("permessi per ruolo", () => {
  it("riserva agli admin export, impostazioni, audit e anonimizzazione", () => {
    for (const p of ["export.run", "settings.manage", "audit.read", "athlete.anonymize"] as const) {
      expect(can(scout, p)).toBe(false);
      expect(can(referente, p)).toBe(false);
      expect(can(admin, p)).toBe(true);
    }
  });

  it("lo scout non valuta schede e non gestisce follow-up o consensi", () => {
    expect(can(scout, "observation.review")).toBe(false);
    expect(can(scout, "followup.manage")).toBe(false);
    expect(can(scout, "consent.manage")).toBe(false);
    expect(can(scout, "observation.create")).toBe(true);
    expect(can(null, "observation.create")).toBe(false);
  });
});

describe("accesso agli atleti per zona", () => {
  it("lo scout vede la propria zona e gli atleti assegnati, non le altre zone", () => {
    expect(canViewAthlete(scout, inZone)).toBe(true);
    expect(canViewAthlete(scout, outOfZone)).toBe(false);
    expect(canViewAthlete(scout, { ...outOfZone, assignedScoutId: "scout-a" })).toBe(true);
  });

  it("il referente vede e gestisce solo la propria zona", () => {
    expect(canViewAthlete(referente, inZone)).toBe(true);
    expect(canViewAthlete(referente, outOfZone)).toBe(false);
    expect(canManageAthlete(referente, inZone)).toBe(true);
    expect(canManageAthlete(referente, outOfZone)).toBe(false);
    expect(canManageAthlete(scout, inZone)).toBe(false);
  });

  it("l'admin vede tutto", () => {
    expect(canViewAthlete(admin, outOfZone)).toBe(true);
    expect(athleteScopeWhere(admin)).toEqual({});
  });

  it("genera filtri di query coerenti", () => {
    expect(athleteScopeWhere(scout)).toEqual({ OR: [{ zoneId: "z1" }, { assignedScoutId: "scout-a" }] });
    expect(athleteScopeWhere(referente)).toEqual({ zoneId: "z1" });
    expect(observationScopeWhere(scout)).toEqual({ scoutId: "scout-a" });
    expect(athleteScopeWhere(user("REFERENTE", "x", null))).toEqual({ id: "__none__" });
  });
});

describe("identità dell'atleta", () => {
  it("lo scout vede il nome solo se ha creato il profilo o gli è assegnato", () => {
    expect(canSeeIdentity(scout, inZone)).toBe(true);
    expect(canSeeIdentity(otherScout, inZone)).toBe(false);
    expect(canSeeIdentity(otherScout, { ...inZone, assignedScoutId: "scout-b" })).toBe(true);
  });

  it("il referente vede il nome solo nella propria zona", () => {
    expect(canSeeIdentity(referente, inZone)).toBe(true);
    expect(canSeeIdentity(referente, outOfZone)).toBe(false);
    expect(canSeeIdentity(admin, outOfZone)).toBe(true);
  });
});

describe("schede di osservazione", () => {
  it("una scheda approvata non è modificabile da nessuno", () => {
    for (const u of [scout, referente, admin]) expect(canEditObservation(u, obs("APPROVATA"))).toBe(false);
  });

  it("lo scout modifica solo le proprie bozze e le integrazioni richieste", () => {
    expect(canEditObservation(scout, obs("BOZZA"))).toBe(true);
    expect(canEditObservation(scout, obs("INTEGRAZIONE_RICHIESTA"))).toBe(true);
    expect(canEditObservation(scout, obs("DA_VALUTARE"))).toBe(false);
    expect(canEditObservation(otherScout, obs("BOZZA"))).toBe(false);
  });

  it("solo referente della zona e admin valutano le schede inviate", () => {
    expect(canReviewObservation(referente, obs("DA_VALUTARE"))).toBe(true);
    expect(canReviewObservation(referente, obs("DA_VALUTARE", "scout-a", "z2"))).toBe(false);
    expect(canReviewObservation(scout, obs("DA_VALUTARE"))).toBe(false);
    expect(canReviewObservation(admin, obs("DA_VALUTARE", "x", "z9"))).toBe(true);
    expect(canReviewObservation(referente, obs("BOZZA"))).toBe(false);
  });
});
