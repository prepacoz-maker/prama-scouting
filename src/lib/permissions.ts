// Regole di accesso: funzioni pure, usate da pagine, server actions e route handler.
// Ogni controllo avviene sul server; il client riceve solo dati già filtrati.

export type Role = "SCOUT" | "REFERENTE" | "ADMIN";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  zoneId: string | null;
}

export const PERMISSIONS = {
  "athlete.create": ["SCOUT", "REFERENTE", "ADMIN"],
  "athlete.updateStatus": ["REFERENTE", "ADMIN"],
  "athlete.anonymize": ["ADMIN"],
  "observation.create": ["SCOUT", "REFERENTE", "ADMIN"],
  "observation.review": ["REFERENTE", "ADMIN"],
  "followup.manage": ["REFERENTE", "ADMIN"],
  "media.upload": ["SCOUT", "REFERENTE", "ADMIN"], // lo scout solo se abilitato (Scout.canUploadMedia)
  "consent.manage": ["REFERENTE", "ADMIN"],
  "export.run": ["ADMIN"],
  "settings.manage": ["ADMIN"],
  "audit.read": ["ADMIN"],
  // Match analysis v1: riservata al team PRAMA (gli scout non hanno accesso).
  "match.manage": ["ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(user: Pick<SessionUser, "role"> | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  return (PERMISSIONS[permission] as readonly Role[]).includes(user.role);
}

interface AthleteScope {
  zoneId: string;
  assignedScoutId?: string | null;
  createdById?: string | null;
}

/** Scout: propria zona o atleti assegnati. Referente: propria zona. Admin: tutto. */
export function canViewAthlete(user: SessionUser, athlete: AthleteScope): boolean {
  if (user.role === "ADMIN") return true;
  if (user.zoneId && athlete.zoneId === user.zoneId) return true;
  if (user.role === "SCOUT" && athlete.assignedScoutId === user.id) return true;
  return false;
}

/** Nome e cognome: admin, referente della zona, scout che ha creato il profilo o a cui è assegnato. */
export function canSeeIdentity(user: SessionUser, athlete: AthleteScope): boolean {
  if (user.role === "ADMIN") return true;
  if (user.role === "REFERENTE") return !!user.zoneId && athlete.zoneId === user.zoneId;
  return athlete.createdById === user.id || athlete.assignedScoutId === user.id;
}

export function canManageAthlete(user: SessionUser, athlete: AthleteScope): boolean {
  if (user.role === "ADMIN") return true;
  return user.role === "REFERENTE" && !!user.zoneId && athlete.zoneId === user.zoneId;
}

interface ObservationScope {
  scoutId: string;
  zoneId: string;
  reviewStatus: "BOZZA" | "DA_VALUTARE" | "INTEGRAZIONE_RICHIESTA" | "APPROVATA";
}

/** Una scheda approvata non si modifica. Lo scout modifica solo le proprie bozze o integrazioni richieste. */
export function canEditObservation(user: SessionUser, obs: ObservationScope): boolean {
  if (obs.reviewStatus === "APPROVATA") return false;
  if (user.role === "ADMIN") return true;
  if (user.role === "REFERENTE") return obs.scoutId === user.id && obs.reviewStatus !== "DA_VALUTARE";
  return obs.scoutId === user.id && (obs.reviewStatus === "BOZZA" || obs.reviewStatus === "INTEGRAZIONE_RICHIESTA");
}

export function canReviewObservation(user: SessionUser, obs: ObservationScope): boolean {
  if (obs.reviewStatus !== "DA_VALUTARE") return false;
  if (user.role === "ADMIN") return true;
  return user.role === "REFERENTE" && !!user.zoneId && obs.zoneId === user.zoneId;
}

/** Filtro Prisma da applicare a ogni query sugli atleti. */
export function athleteScopeWhere(user: SessionUser) {
  if (user.role === "ADMIN") return {};
  const zone = user.zoneId ? [{ zoneId: user.zoneId }] : [];
  if (user.role === "SCOUT") return { OR: [...zone, { assignedScoutId: user.id }] };
  return user.zoneId ? { zoneId: user.zoneId } : { id: "__none__" };
}

/** Filtro Prisma per le osservazioni: lo scout vede solo le proprie. */
export function observationScopeWhere(user: SessionUser) {
  if (user.role === "ADMIN") return {};
  if (user.role === "SCOUT") return { scoutId: user.id };
  return user.zoneId ? { zoneId: user.zoneId } : { id: "__none__" };
}
