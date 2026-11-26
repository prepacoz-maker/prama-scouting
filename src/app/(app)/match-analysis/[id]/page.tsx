import Link from "next/link";
import { notFound } from "next/navigation";
import { audit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { fmtDate } from "@/lib/labels";
import { loadMatchSession } from "@/lib/match-data";
import { PageHeader } from "@/components/ui";
import { Workspace } from "@/components/match/Workspace";

export const metadata = { title: "Analisi video" };

export default async function MatchSessionPage({ params }: { params: { id: string } }) {
  const user = await requirePermission("match.manage");
  const data = await loadMatchSession(params.id);
  if (!data) notFound();
  const { session } = data;
  await audit(user.id, "MATCH_VIEW", "MatchSession", session.id);
  const subtitle = [
    fmtDate(session.date),
    `${session.team}${session.opponent ? ` vs ${session.opponent}` : ""}${session.score ? ` ${session.score}` : ""}`,
    session.competition,
    session.athlete ? `atleta ${session.athlete.code}` : "analisi di squadra",
    session.objective ? `obiettivo: ${session.objective}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <PageHeader
        title={session.title}
        description={subtitle}
        actions={
          <>
            {session.athlete ? (
              <Link href={`/atleti/${session.athlete.id}`} className="btn-secondary">
                Scheda atleta
              </Link>
            ) : null}
            <Link href="/match-analysis" className="btn-secondary">
              Tutte le analisi
            </Link>
          </>
        }
      />
      <Workspace
        session={{
          id: session.id,
          title: session.title,
          videoSource: session.videoSource,
          videoLabel: session.videoLabel,
          videoUrl: session.videoUrl,
          durationSec: session.durationSec,
          secondHalfSec: session.secondHalfSec,
          buttons: data.buttons,
        }}
        initialEvents={data.events}
        initialPlaylists={data.playlists}
      />
    </>
  );
}
