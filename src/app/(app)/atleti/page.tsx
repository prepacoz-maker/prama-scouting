import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { athleteScopeWhere, canSeeIdentity } from "@/lib/permissions";
import { INTEREST_LABELS, RELIABILITY_LABELS, ROLE_GROUP_LABELS, STATUS_LABELS, fmtDate } from "@/lib/labels";
import { AthleteCardCompact } from "@/components/AthleteCard";
import { DataTable, EmptyState, PageHeader, StatusTag } from "@/components/ui";

export const metadata = { title: "Archivio atleti" };

type Params = { q?: string; zona?: string; reparto?: string; anno?: string; stato?: string; interesse?: string; controllo?: string; vista?: string };

export default async function AthletesPage({ searchParams }: { searchParams: Params }) {
  const user = await requireUser();
  const { q, zona, reparto, anno, stato, interesse, controllo } = searchParams;
  const view = searchParams.vista === "tabella" ? "tabella" : "card";
  const filters: Prisma.AthleteWhereInput[] = [athleteScopeWhere(user)];

  if (q?.trim()) {
    const term = q.trim();
    const contains = { contains: term, mode: "insensitive" as const };
    // La ricerca per nome considera solo i profili di cui l'utente può vedere l'identità.
    const identityScope: Prisma.AthleteWhereInput = user.role === "SCOUT" ? { OR: [{ createdById: user.id }, { assignedScoutId: user.id }] } : {};
    filters.push({
      OR: [
        { code: contains },
        { team: contains },
        { primaryRole: contains },
        { AND: [identityScope, { identity: { OR: [{ firstName: contains }, { lastName: contains }] } }] },
      ],
    });
  }
  if (zona) filters.push({ zoneId: zona });
  if (reparto && reparto in ROLE_GROUP_LABELS) filters.push({ roleGroup: reparto as keyof typeof ROLE_GROUP_LABELS as never });
  if (anno && /^\d{4}$/.test(anno)) filters.push({ birthYear: Number(anno) });
  if (stato && stato in STATUS_LABELS) filters.push({ status: stato as never });
  else if (!stato) filters.push({ status: { notIn: ["ARCHIVIATO", "DUPLICATO"] } });
  if (interesse === "ALTO_PLUS") filters.push({ interest: { in: ["ALTO", "MOLTO_ALTO"] } });
  else if (interesse && interesse in INTEREST_LABELS) filters.push({ interest: interesse as never });
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
  if (controllo === "30") filters.push({ lastObservedAt: { gte: daysAgo(30) } });
  if (controllo === "90") filters.push({ lastObservedAt: { gte: daysAgo(90) } });
  if (controllo === "oltre90") filters.push({ lastObservedAt: { lt: daysAgo(90) } });
  if (controllo === "mai") filters.push({ lastObservedAt: null });

  const [athletes, zones] = await Promise.all([
    db.athlete.findMany({ where: { AND: filters }, include: { zone: true, identity: true }, orderBy: [{ updatedAt: "desc" }], take: 200 }),
    user.role === "ADMIN" ? db.zone.findMany({ orderBy: { code: "asc" } }) : Promise.resolve([]),
  ]);
  // L'identità non lascia mai il server se l'utente non ne ha titolo.
  const rows = athletes.map(({ identity, ...a }) => ({
    ...a,
    displayName: identity && canSeeIdentity(user, a) ? `${identity.lastName} ${identity.firstName}` : a.code,
  }));

  const query = (extra: Record<string, string>) => {
    const p = new URLSearchParams(Object.entries({ ...searchParams, ...extra }).filter(([, v]) => v) as [string, string][]);
    return `/atleti?${p.toString()}`;
  };
  const hasFilters = Object.entries(searchParams).some(([k, v]) => k !== "vista" && v);

  return (
    <>
      <PageHeader
        title="Archivio atleti"
        description={`${rows.length} profili${rows.length === 200 ? " (primi 200: affinare i filtri)" : ""}`}
        actions={
          <Link href="/atleti/nuovo" className="btn-primary">
            Nuovo profilo
          </Link>
        }
      />

      <form className="panel no-print mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4" role="search" aria-label="Filtri dell'archivio">
        <input type="hidden" name="vista" value={view} />
        <div className="sm:col-span-2">
          <label htmlFor="q" className="label">
            Cerca
          </label>
          <input id="q" name="q" defaultValue={q ?? ""} className="input" placeholder="Nome, codice atleta, squadra o ruolo" />
        </div>
        {user.role === "ADMIN" ? (
          <div>
            <label htmlFor="zona" className="label">
              Zona
            </label>
            <select id="zona" name="zona" defaultValue={zona ?? ""} className="input">
              <option value="">Tutte</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.code} {z.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div>
          <label htmlFor="reparto" className="label">
            Reparto
          </label>
          <select id="reparto" name="reparto" defaultValue={reparto ?? ""} className="input">
            <option value="">Tutti</option>
            {Object.entries(ROLE_GROUP_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="anno" className="label">
            Anno di nascita
          </label>
          <input id="anno" name="anno" type="number" inputMode="numeric" defaultValue={anno ?? ""} className="input" placeholder="es. 2011" />
        </div>
        <div>
          <label htmlFor="stato" className="label">
            Stato
          </label>
          <select id="stato" name="stato" defaultValue={stato ?? ""} className="input">
            <option value="">Attivi (esclusi archiviati)</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="interesse" className="label">
            Livello di interesse
          </label>
          <select id="interesse" name="interesse" defaultValue={interesse ?? ""} className="input">
            <option value="">Tutti</option>
            <option value="ALTO_PLUS">Alto e molto alto</option>
            {Object.entries(INTEREST_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="controllo" className="label">
            Ultimo controllo
          </label>
          <select id="controllo" name="controllo" defaultValue={controllo ?? ""} className="input">
            <option value="">Qualsiasi</option>
            <option value="30">Negli ultimi 30 giorni</option>
            <option value="90">Negli ultimi 90 giorni</option>
            <option value="oltre90">Oltre 90 giorni fa</option>
            <option value="mai">Mai osservato</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="btn-primary">
            Filtra
          </button>
          {hasFilters ? (
            <Link href={`/atleti?vista=${view}`} className="btn-secondary">
              Azzera
            </Link>
          ) : null}
        </div>
      </form>

      <div className="no-print mb-3 flex justify-end gap-1" role="group" aria-label="Tipo di vista">
        <Link href={query({ vista: "card" })} aria-current={view === "card" ? "true" : undefined} className={view === "card" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>
          Card
        </Link>
        <Link href={query({ vista: "tabella" })} aria-current={view === "tabella" ? "true" : undefined} className={view === "tabella" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>
          Tabella
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Nessun atleta trovato"
          description={hasFilters ? "Prova a modificare o azzerare i filtri." : "Crea il primo profilo per iniziare."}
          action={
            <Link href="/atleti/nuovo" className="btn-primary">
              Nuovo profilo
            </Link>
          }
        />
      ) : view === "card" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((a) => (
            <AthleteCardCompact key={a.id} athlete={a} displayName={a.displayName} />
          ))}
        </div>
      ) : (
        <DataTable
          caption="Elenco degli atleti"
          rows={rows}
          rowKey={(a) => a.id}
          columns={[
            { header: "Atleta", cell: (a) => (<Link href={`/atleti/${a.id}`} className="font-semibold underline-offset-2 hover:underline">{a.displayName}</Link>) },
            { header: "Codice", cell: (a) => <span className="tabular-nums">{a.code}</span> },
            { header: "Zona", cell: (a) => a.zone.code },
            { header: "Squadra", cell: (a) => `${a.team} · ${a.category}` },
            { header: "Ruolo", cell: (a) => a.primaryRole },
            { header: "Anno", cell: (a) => a.birthYear ?? "—" },
            { header: "Overall", cell: (a) => <strong className="tabular-nums">{a.overall ?? "—"}</strong> },
            { header: "Potenziale", cell: (a) => (a.potentialMin !== null ? `${a.potentialMin}–${a.potentialMax}` : "—") },
            { header: "Affidabilità", cell: (a) => RELIABILITY_LABELS[a.reliability] },
            { header: "Stato", cell: (a) => <StatusTag status={a.status} /> },
            { header: "Ultimo controllo", cell: (a) => fmtDate(a.lastObservedAt) },
          ]}
        />
      )}
    </>
  );
}
