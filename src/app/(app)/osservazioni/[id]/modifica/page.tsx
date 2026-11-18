import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canEditObservation } from "@/lib/permissions";
import { ATTRIBUTES } from "@/lib/rating";
import { ObservationForm } from "@/components/ObservationForm";
import type { ObservationFormValues } from "@/lib/observation-form";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Modifica scheda" };

export default async function EditObservationPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const obs = await db.observation.findUnique({ where: { id: params.id }, include: { athlete: true } });
  if (!obs) notFound();
  if (!canEditObservation(user, obs)) redirect(`/osservazioni/${obs.id}`);

  const initial = {
    ...(Object.fromEntries(ATTRIBUTES.map((a) => [a, obs[a]])) as Pick<ObservationFormValues, (typeof ATTRIBUTES)[number]>),
    athleteId: obs.athleteId,
    date: obs.date.toISOString().slice(0, 10),
    eventType: obs.eventType,
    team: obs.team,
    opponent: obs.opponent ?? "",
    category: obs.category,
    competition: obs.competition ?? "",
    venue: obs.venue ?? "",
    minutes: obs.minutes,
    conditions: obs.conditions ?? "",
    maturation: obs.maturation,
    strengths: obs.strengths,
    improvements: obs.improvements,
    notes: obs.notes,
    interest: obs.interest,
    action: obs.action,
    nextCheckSuggested: obs.nextCheckSuggested?.toISOString().slice(0, 10) ?? "",
    conflictOfInterest: obs.conflictOfInterest,
  } satisfies ObservationFormValues;

  return (
    <>
      <PageHeader title="Completa la scheda" description={`Atleta ${obs.athlete.code}`} />
      <ObservationForm
        athletes={[{ id: obs.athleteId, label: `${obs.athlete.code} · ${obs.athlete.team}`, team: obs.athlete.team, category: obs.athlete.category }]}
        initial={initial}
        observationId={obs.id}
        reviewNote={obs.reviewStatus === "INTEGRAZIONE_RICHIESTA" ? obs.reviewNote : null}
      />
    </>
  );
}
