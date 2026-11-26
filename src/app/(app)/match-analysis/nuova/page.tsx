import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { TEMPLATES } from "@/lib/match";
import { PageHeader } from "@/components/ui";
import { NewSessionForm } from "@/components/match/NewSessionForm";

export const metadata = { title: "Nuova analisi" };

export default async function NewMatchSessionPage({ searchParams }: { searchParams: { atleta?: string } }) {
  await requirePermission("match.manage");
  const now = new Date();
  const athletes = await db.athlete.findMany({
    where: { anonymizedAt: null, status: { notIn: ["ARCHIVIATO", "DUPLICATO"] } },
    include: {
      identity: true,
      consents: { where: { type: "VIDEO", revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, select: { id: true } },
    },
    orderBy: { code: "asc" },
  });
  const options = athletes.map((a) => ({
    id: a.id,
    label: `${a.code}${a.identity ? ` · ${a.identity.lastName} ${a.identity.firstName}` : ""} · ${a.team}`,
    team: a.team,
    roleGroup: a.roleGroup,
    primaryRole: a.primaryRole,
    category: a.category,
    hasVideoConsent: a.consents.length > 0,
  }));
  const templates = Object.entries(TEMPLATES).map(([key, t]) => ({ key, label: t.label, sport: t.sport }));

  return (
    <>
      <PageHeader
        title="Nuova analisi"
        description="Scheda di intake della match analysis. Se mancano atleta o squadra, ruolo e obiettivo, l'analisi non parte."
      />
      <NewSessionForm athletes={options} templates={templates} preselected={searchParams.atleta ?? null} />
    </>
  );
}
