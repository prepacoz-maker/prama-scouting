import Link from "next/link";
import { notFound } from "next/navigation";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { loadAthleteCard } from "@/lib/athlete-view";
import { fmtDate } from "@/lib/labels";
import { AthleteCard } from "@/components/AthleteCard";
import { PrintButton } from "@/components/PrintButton";
import { Alert } from "@/components/ui";

export const metadata = { title: "Player Card" };

/** Player Card in formato report: per impostazione predefinita mostra solo il codice atleta. */
export default async function CardPage({ params, searchParams }: { params: { id: string }; searchParams: { nome?: string } }) {
  const user = await requireUser();
  const withName = searchParams.nome === "1";
  const data = await loadAthleteCard(user, params.id, { forceAnonymous: !withName });
  if (!data) notFound();
  await audit(user.id, "ATHLETE_VIEW", "Athlete", data.athlete.id, { code: data.athlete.code, report: true, withName });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href={`/atleti/${data.athlete.id}`} className="btn-secondary">
          Torna al profilo
        </Link>
        <div className="flex flex-wrap gap-2">
          <Link href={withName ? "?" : "?nome=1"} className="btn-secondary">
            {withName ? "Mostra solo il codice" : "Mostra il nome (se autorizzato)"}
          </Link>
          <PrintButton />
        </div>
      </div>
      <div className="no-print mb-4">
        <Alert tone="warn">
          Report a uso interno PRAMA. La versione con il solo codice atleta è quella da usare in riunioni e documenti condivisi nel team.
        </Alert>
      </div>
      <AthleteCard data={data} showActions={false} />
      <p className="muted mt-3 text-xs">
        Generato il {fmtDate(new Date())} da {user.name}. PRAMA Talent Management · documento riservato.
      </p>
    </div>
  );
}
