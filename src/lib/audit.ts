import type { Prisma } from "@prisma/client";
import { db } from "./db";

export type AuditAction =
  | "LOGIN"
  | "ATHLETE_VIEW"
  | "ATHLETE_CREATE"
  | "ATHLETE_UPDATE"
  | "ATHLETE_STATUS"
  | "ATHLETE_ANONYMIZE"
  | "OBSERVATION_CREATE"
  | "OBSERVATION_UPDATE"
  | "OBSERVATION_SUBMIT"
  | "OBSERVATION_REVIEW"
  | "FOLLOWUP_CREATE"
  | "FOLLOWUP_UPDATE"
  | "MEDIA_UPLOAD"
  | "MEDIA_VIEW"
  | "MEDIA_DELETE"
  | "CONSENT_RECORD"
  | "CONSENT_REVOKE"
  | "EXPORT"
  | "SETTINGS_UPDATE"
  | "USER_CREATE"
  | "USER_UPDATE"
  | "MATCH_CREATE"
  | "MATCH_VIEW"
  | "MATCH_UPDATE"
  | "MATCH_DELETE"
  | "MATCH_EXPORT";

/** Registra un evento. Mai inserire in `meta` nomi, note o altri dati personali. */
export async function audit(
  userId: string | null,
  action: AuditAction,
  entity: string,
  entityId?: string | null,
  meta?: Prisma.InputJsonValue,
) {
  try {
    await db.auditLog.create({ data: { userId, action, entity, entityId: entityId ?? null, meta } });
  } catch (error) {
    console.error("Audit log non scritto", action, entity, error);
  }
}
