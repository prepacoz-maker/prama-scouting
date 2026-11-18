"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { createAthlete } from "@/app/actions/athletes";
import { CATEGORIES, FOOT_LABELS, ROLE_GROUP_LABELS } from "@/lib/labels";
import { athleteSchema } from "@/lib/validation";
import { Alert } from "./ui";

interface Values {
  firstName: string;
  lastName: string;
  zoneId: string;
  birthYear: string;
  roleGroup: string;
  primaryRole: string;
  secondaryRoles: string;
  team: string;
  category: string;
  foot: string;
  heightCm: string;
  weightKg: string;
}

export function AthleteForm({ zones, defaultZoneId, next }: { zones: { id: string; label: string }[]; defaultZoneId: string; next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(athleteSchema) as unknown as Resolver<Values>,
    defaultValues: { firstName: "", lastName: "", zoneId: defaultZoneId, birthYear: "", roleGroup: "", primaryRole: "", secondaryRoles: "", team: "", category: "", foot: "NON_RILEVATO", heightCm: "", weightKg: "" },
  });

  const onSubmit = handleSubmit(async (data) => {
    setPending(true);
    setError(null);
    const result = await createAthlete(data);
    setPending(false);
    if (!result.ok) return setError(result.error);
    router.push(next === "osservazione" ? `/osservazioni/nuova?atleta=${result.data!.id}` : `/atleti/${result.data!.id}`);
    router.refresh();
  });

  const field = (name: keyof Values) => ({ id: name, "aria-invalid": errors[name] ? true : undefined, ...register(name) });
  const Err = ({ name }: { name: keyof Values }) => (errors[name] ? <p className="error">{String(errors[name]?.message)}</p> : null);

  return (
    <form onSubmit={onSubmit} noValidate className="panel space-y-4 p-4 sm:p-5">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Alert tone="info">
        Il sistema assegna un <strong>codice atleta</strong>, usato in tutte le viste condivise. Nome e cognome sono facoltativi: inseriscili
        solo se confermati da una fonte ufficiale (distinta di gara, comunicati). Sono visibili solo a chi ne ha titolo.
      </Alert>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className="label">
            Nome <span className="muted font-normal">(facoltativo)</span>
          </label>
          <input {...field("firstName")} className="input" autoComplete="off" />
        </div>
        <div>
          <label htmlFor="lastName" className="label">
            Cognome <span className="muted font-normal">(facoltativo)</span>
          </label>
          <input {...field("lastName")} className="input" autoComplete="off" />
        </div>
        <div>
          <label htmlFor="zoneId" className="label">
            Zona PRAMA
          </label>
          {zones.length === 1 ? (
            <>
              <input type="hidden" {...register("zoneId")} />
              <p id="zoneId" className="input flex items-center bg-prama-50 dark:bg-prama-800">{zones[0].label}</p>
            </>
          ) : (
            <select {...field("zoneId")} className="input">
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.label}
                </option>
              ))}
            </select>
          )}
          <Err name="zoneId" />
        </div>
        <div>
          <label htmlFor="team" className="label">
            Squadra attuale
          </label>
          <input {...field("team")} className="input" autoComplete="off" />
          <Err name="team" />
        </div>
        <div>
          <label htmlFor="category" className="label">
            Categoria
          </label>
          <select {...field("category")} className="input">
            <option value="">Seleziona…</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <Err name="category" />
        </div>
        <div>
          <label htmlFor="birthYear" className="label">
            Anno di nascita <span className="muted font-normal">(se noto)</span>
          </label>
          <input type="number" inputMode="numeric" {...field("birthYear")} className="input" />
          <Err name="birthYear" />
        </div>
        <div>
          <label htmlFor="roleGroup" className="label">
            Reparto
          </label>
          <select {...field("roleGroup")} className="input">
            <option value="">Seleziona…</option>
            {Object.entries(ROLE_GROUP_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <p className="hint">Determina i pesi usati per calcolare l&apos;overall.</p>
          <Err name="roleGroup" />
        </div>
        <div>
          <label htmlFor="primaryRole" className="label">
            Ruolo principale
          </label>
          <input {...field("primaryRole")} className="input" placeholder="es. Esterno offensivo" autoComplete="off" />
          <Err name="primaryRole" />
        </div>
        <div>
          <label htmlFor="secondaryRoles" className="label">
            Ruoli secondari <span className="muted font-normal">(separati da virgola)</span>
          </label>
          <input {...field("secondaryRoles")} className="input" autoComplete="off" />
        </div>
        <div>
          <label htmlFor="foot" className="label">
            Piede preferito
          </label>
          <select {...field("foot")} className="input">
            {Object.entries(FOOT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="heightCm" className="label">
            Altezza in cm <span className="muted font-normal">(solo da fonte ufficiale)</span>
          </label>
          <input type="number" inputMode="numeric" {...field("heightCm")} className="input" />
          <Err name="heightCm" />
        </div>
        <div>
          <label htmlFor="weightKg" className="label">
            Peso in kg <span className="muted font-normal">(solo da fonte ufficiale)</span>
          </label>
          <input type="number" inputMode="numeric" {...field("weightKg")} className="input" />
          <Err name="weightKg" />
        </div>
      </div>
      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Creazione…" : "Crea profilo"}
        </button>
      </div>
    </form>
  );
}
