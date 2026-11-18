"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { ATTRIBUTES } from "@/lib/rating";
import { recomputeAll } from "@/lib/recompute";
import { userSchema, zoneSchema } from "@/lib/validation";
import { describeError, fail, type ActionResult } from "./result";

async function requireAdmin() {
  const user = await requireUser();
  return can(user, "settings.manage") ? user : null;
}

const DENIED = "Operazione riservata agli admin PRAMA.";

export async function createZone(raw: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return fail(DENIED);
  try {
    const input = zoneSchema.parse(raw);
    if (await db.zone.findUnique({ where: { code: input.code } })) return fail("Esiste già una zona con questo codice.");
    const zone = await db.zone.create({ data: input });
    await audit(admin.id, "SETTINGS_UPDATE", "Zone", zone.id, { code: zone.code });
    revalidatePath("/impostazioni");
    return { ok: true };
  } catch (error) {
    return fail(describeError(error));
  }
}

export async function toggleZone(zoneId: string, active: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return fail(DENIED);
  await db.zone.update({ where: { id: zoneId }, data: { active } });
  await audit(admin.id, "SETTINGS_UPDATE", "Zone", zoneId, { active });
  revalidatePath("/impostazioni");
  return { ok: true };
}

export async function createUser(raw: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return fail(DENIED);
  try {
    const input = userSchema.parse(raw);
    if (input.role !== "ADMIN" && !input.zoneId) return fail("Scout e referenti devono avere una zona.");
    if (await db.user.findUnique({ where: { email: input.email } })) return fail("Esiste già un utente con questa email.");
    const user = await db.user.create({
      data: {
        name: input.name,
        email: input.email,
        role: input.role,
        zoneId: input.role === "ADMIN" ? null : input.zoneId,
        passwordHash: await bcrypt.hash(input.password, 12),
        scout: input.role === "SCOUT" ? { create: { canUploadMedia: input.canUploadMedia } } : undefined,
      },
    });
    await audit(admin.id, "USER_CREATE", "User", user.id, { role: user.role });
    revalidatePath("/impostazioni");
    return { ok: true };
  } catch (error) {
    return fail(describeError(error));
  }
}

export async function setUserActive(userId: string, active: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return fail(DENIED);
  if (userId === admin.id) return fail("Non puoi disattivare il tuo stesso utente.");
  await db.user.update({ where: { id: userId }, data: { active } });
  await audit(admin.id, "USER_UPDATE", "User", userId, { active });
  revalidatePath("/impostazioni");
  return { ok: true };
}

export async function setScoutUpload(userId: string, canUploadMedia: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return fail(DENIED);
  await db.scout.upsert({ where: { userId }, update: { canUploadMedia }, create: { userId, canUploadMedia } });
  await audit(admin.id, "USER_UPDATE", "User", userId, { canUploadMedia });
  revalidatePath("/impostazioni");
  return { ok: true };
}

const weightsSchema = z.object({
  roleGroup: z.enum(["PORTIERE", "DIFENSORE", "CENTROCAMPISTA", "ATTACCANTE"]),
  weights: z.record(z.enum(ATTRIBUTES), z.coerce.number().min(0, "Il peso minimo è 0").max(3, "Il peso massimo è 3")),
});

/** Salva i pesi di un reparto e ricalcola tutte le Player Card. */
export async function saveWeights(raw: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return fail(DENIED);
  try {
    const input = weightsSchema.parse(raw);
    if (Object.values(input.weights).every((v) => v === 0)) return fail("Almeno un attributo deve avere peso maggiore di 0.");
    await db.$transaction(
      Object.entries(input.weights).map(([attribute, weight]) =>
        db.metricWeight.upsert({
          where: { roleGroup_attribute: { roleGroup: input.roleGroup, attribute } },
          update: { weight },
          create: { roleGroup: input.roleGroup, attribute, weight },
        }),
      ),
    );
    await recomputeAll();
    await audit(admin.id, "SETTINGS_UPDATE", "MetricWeight", input.roleGroup);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return fail(describeError(error));
  }
}

export async function saveRetention(months: number): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return fail(DENIED);
  if (!Number.isInteger(months) || months < 3 || months > 60) return fail("Indicare un numero di mesi tra 3 e 60.");
  await db.setting.upsert({ where: { key: "retentionMonths" }, update: { value: String(months) }, create: { key: "retentionMonths", value: String(months) } });
  await audit(admin.id, "SETTINGS_UPDATE", "Setting", "retentionMonths", { months });
  revalidatePath("/impostazioni");
  return { ok: true };
}
