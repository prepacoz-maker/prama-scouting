import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AthleteForm } from "@/components/AthleteForm";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Nuovo profilo" };

export default async function NewAthletePage({ searchParams }: { searchParams: { poi?: string } }) {
  const user = await requireUser();
  const zones = await db.zone.findMany({
    where: { active: true, ...(user.role === "ADMIN" ? {} : { id: user.zoneId ?? "__none__" }) },
    orderBy: { code: "asc" },
  });
  return (
    <>
      <PageHeader title="Nuovo profilo atleta" description="Bastano i dati sportivi essenziali. Il resto si aggiunge con le osservazioni." />
      {zones.length === 0 ? (
        <EmptyState title="Nessuna zona assegnata" description="Chiedi a un admin PRAMA di assegnarti una zona." />
      ) : (
        <AthleteForm zones={zones.map((z) => ({ id: z.id, label: `${z.code} ${z.name}` }))} defaultZoneId={user.zoneId ?? zones[0].id} next={searchParams.poi} />
      )}
    </>
  );
}
