import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getUser } from "@/lib/auth";
import { canViewAthlete } from "@/lib/permissions";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

/** Streaming del media solo a utenti autorizzati; ogni accesso è registrato. Nessun URL pubblico. */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) return new NextResponse("Accesso non consentito.", { status: 401 });

  const media = await db.media.findUnique({ where: { id: params.id }, include: { athlete: true } });
  if (!media || !canViewAthlete(user, media.athlete)) return new NextResponse("Non trovato.", { status: 404 });

  const data = await storage.get(media.storageKey);
  const range = request.headers.get("range");
  const headers: Record<string, string> = {
    "Content-Type": media.mimeType,
    "Content-Disposition": "inline",
    "Cache-Control": "private, no-store",
    "Accept-Ranges": "bytes",
  };

  // Le richieste parziali (seek del video) non generano una riga di log ciascuna.
  if (!range || range.startsWith("bytes=0-")) {
    await audit(user.id, "MEDIA_VIEW", "Media", media.id, { athlete: media.athlete.code });
    if (user.role !== "SCOUT" && !media.viewed) await db.media.update({ where: { id: media.id }, data: { viewed: true } });
  }

  if (range) {
    const match = /bytes=(\d+)-(\d*)/.exec(range);
    if (match) {
      const start = Number(match[1]);
      const end = match[2] ? Math.min(Number(match[2]), data.length - 1) : data.length - 1;
      if (start >= data.length || start > end) {
        return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${data.length}` } });
      }
      return new NextResponse(new Uint8Array(data.subarray(start, end + 1)), {
        status: 206,
        headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${data.length}`, "Content-Length": String(end - start + 1) },
      });
    }
  }
  return new NextResponse(new Uint8Array(data), { headers: { ...headers, "Content-Length": String(data.length) } });
}
