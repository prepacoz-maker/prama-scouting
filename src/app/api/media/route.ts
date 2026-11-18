import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getUser } from "@/lib/auth";
import { can, canViewAthlete } from "@/lib/permissions";
import { ALLOWED_MEDIA, maxMediaBytes, storage } from "@/lib/storage";

export const runtime = "nodejs";

const error = (message: string, status: number) => NextResponse.json({ error: message }, { status });

/** Upload protetto: verifica ruolo, abilitazione dello scout, consenso attivo, tipo e dimensione del file. */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user || !can(user, "media.upload")) return error("Accesso non consentito.", 401);

  const form = await request.formData();
  const athleteId = String(form.get("athleteId") ?? "");
  const observationId = String(form.get("observationId") ?? "") || null;
  const file = form.get("file");
  if (!(file instanceof File)) return error("Selezionare un file.", 400);

  const athlete = await db.athlete.findUnique({ where: { id: athleteId } });
  if (!athlete || !canViewAthlete(user, athlete)) return error("Atleta non trovato o fuori dalla tua zona.", 404);

  if (user.role === "SCOUT") {
    const scout = await db.scout.findUnique({ where: { userId: user.id } });
    if (!scout?.canUploadMedia) return error("Non sei abilitato al caricamento di media. Rivolgiti al referente.", 403);
  }

  const kind = ALLOWED_MEDIA[file.type];
  if (!kind) return error("Formato non ammesso. Usare MP4, MOV, WEBM, JPG, PNG o WEBP.", 400);
  if (file.size > maxMediaBytes()) return error(`Il file supera il limite di ${process.env.MEDIA_MAX_MB ?? 200} MB.`, 400);

  // Nessun media senza un consenso valido dei genitori/tutori per quel tipo di contenuto.
  const now = new Date();
  const consent = await db.consent.findFirst({
    where: { athleteId, type: kind, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
  });
  if (!consent) {
    return error(
      `Manca il consenso per ${kind === "VIDEO" ? "i video" : "le foto"} di questo atleta. Il referente deve registrarlo prima del caricamento.`,
      403,
    );
  }

  const storageKey = await storage.put(Buffer.from(await file.arrayBuffer()));
  const media = await db.media.create({
    data: {
      athleteId,
      observationId,
      uploadedById: user.id,
      kind,
      storageKey,
      filename: `${athlete.code}_${now.toISOString().slice(0, 10)}_${kind.toLowerCase()}`,
      mimeType: file.type,
      sizeBytes: file.size,
      tags: String(form.get("tags") ?? "")
        .split(",")
        .map((t) => t.trim().slice(0, 30))
        .filter(Boolean)
        .slice(0, 8),
    },
  });
  await audit(user.id, "MEDIA_UPLOAD", "Media", media.id, { athlete: athlete.code, kind, sizeBytes: file.size });
  return NextResponse.json({ id: media.id });
}
