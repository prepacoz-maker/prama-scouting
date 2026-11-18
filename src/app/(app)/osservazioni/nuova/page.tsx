import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { athleteScopeWhere, canSeeIdentity } from "@/lib/permissions";
import { ObservationForm } from "@/components/ObservationForm";
import { emptyObservation } from "@/lib/observation-form";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Nuova osservazione" };

export default async function NewObservationPage({ searchParams }: { searchParams: { atleta?: string } }) {
  const user = await requireUser();
  const athletes = await db.athlete.findMany({
    where: { ...athleteScopeWhere(user), anonymizedAt: null, status: { notIn: ["ARCHIVIATO", "DUPLICATO"] } },
    include: { identity: true },
    orderBy: { code: "asc" },
  });
  const options = athletes.map((a) => ({
    id: a.id,
    label: `${a.code}${a.identity && canSeeIdentity(user, a) ? ` · ${a.identity.lastName} ${a.identity.firstName}` : ""} · ${a.team}`,
    team: a.team,
    category: a.category,
  }));
  const selected = options.find((o) => o.id === searchParams.atleta);

  return (
    <>
      <PageHeader title="Nuova osservazione" description="Compila entro 24-48 ore dalla gara. Puoi salvare la bozza e completarla più tardi." />
      {options.length === 0 ? (
        <EmptyState
          title="Nessun atleta disponibile"
          description="Crea il profilo dell'atleta osservato, poi compila la scheda."
          action={
            <Link href="/atleti/nuovo?poi=osservazione" className="btn-primary">
              Crea profilo
            </Link>
          }
        />
      ) : (
        <ObservationForm athletes={options} initial={emptyObservation(selected)} />
      )}
    </>
  );
}
