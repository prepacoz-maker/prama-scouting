import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { ROLE_LABELS, fmtDate, fmtDateTime } from "@/lib/labels";
import { getWeights, retentionMonths } from "@/lib/recompute";
import type { Attribute, RoleGroup } from "@/lib/rating";
import { RetentionForm, Toggle, UserForm, WeightsEditor, ZoneForm } from "@/components/admin";
import { DataTable, EmptyState, PageHeader, Panel } from "@/components/ui";

export const metadata = { title: "Impostazioni" };

const GROUPS: RoleGroup[] = ["PORTIERE", "DIFENSORE", "CENTROCAMPISTA", "ATTACCANTE"];
const SECTIONS = [
  ["zone", "Zone"],
  ["utenti", "Utenti"],
  ["pesi", "Pesi delle metriche"],
  ["privacy", "Privacy"],
  ["export", "Export"],
  ["log", "Log delle attività"],
] as const;

export default async function SettingsPage() {
  await requirePermission("settings.manage");
  const now = new Date();
  const [zones, users, months, dueReview, logs, weightEntries] = await Promise.all([
    db.zone.findMany({ orderBy: { code: "asc" }, include: { _count: { select: { athletes: true, users: true } } } }),
    db.user.findMany({ orderBy: [{ role: "desc" }, { name: "asc" }], include: { zone: true, scout: true } }),
    retentionMonths(),
    db.athlete.findMany({ where: { anonymizedAt: null, reviewDueAt: { lte: now } }, include: { zone: true }, orderBy: { reviewDueAt: "asc" }, take: 50 }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { user: { select: { name: true } } } }),
    Promise.all(GROUPS.map(async (g) => [g, await getWeights(g)] as const)),
  ]);
  const weights = Object.fromEntries(weightEntries) as Record<string, Record<Attribute, number>>;

  return (
    <>
      <PageHeader title="Impostazioni" description="Zone, utenti, pesi delle metriche, privacy, export e log. Sezione riservata agli admin PRAMA." />
      <nav aria-label="Sezioni delle impostazioni" className="no-print mb-4 flex flex-wrap gap-2">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="btn-secondary btn-sm">
            {label}
          </a>
        ))}
      </nav>

      <div className="space-y-5">
        <div id="zone" className="scroll-mt-4">
          <Panel title="Zone">
            <DataTable
              caption="Zone PRAMA"
              rows={zones}
              rowKey={(z) => z.id}
              columns={[
                { header: "Codice", cell: (z) => <strong>{z.code}</strong> },
                { header: "Nome", cell: (z) => z.name },
                { header: "Utenti", cell: (z) => z._count.users },
                { header: "Atleti", cell: (z) => z._count.athletes },
                { header: "Attiva", cell: (z) => <Toggle kind="zone" id={z.id} value={z.active} label={`Zona ${z.code} attiva`} /> },
              ]}
            />
            <ZoneForm />
          </Panel>
        </div>

        <div id="utenti" className="scroll-mt-4">
          <Panel title="Scout, referenti e admin">
            <DataTable
              caption="Utenti"
              rows={users}
              rowKey={(u) => u.id}
              columns={[
                { header: "Nome", cell: (u) => <strong>{u.name}</strong> },
                { header: "Email", cell: (u) => u.email },
                { header: "Ruolo", cell: (u) => ROLE_LABELS[u.role] },
                { header: "Zona", cell: (u) => u.zone?.code ?? "—" },
                { header: "Carica media", cell: (u) => (u.role === "SCOUT" ? <Toggle kind="upload" id={u.id} value={u.scout?.canUploadMedia ?? false} label={`${u.name} può caricare media`} /> : "Sì") },
                { header: "Attivo", cell: (u) => <Toggle kind="user" id={u.id} value={u.active} label={`${u.name} attivo`} /> },
              ]}
            />
            <UserForm zones={zones.filter((z) => z.active).map((z) => ({ id: z.id, label: `${z.code} ${z.name}` }))} />
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer font-semibold">Permessi per ruolo</summary>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                {Object.entries(PERMISSIONS).map(([permission, roles]) => (
                  <li key={permission}>
                    <code className="text-xs">{permission}</code>: {roles.map((r) => ROLE_LABELS[r]).join(", ")}
                  </li>
                ))}
              </ul>
            </details>
          </Panel>
        </div>

        <div id="pesi" className="scroll-mt-4">
          <Panel title="Pesi delle metriche per reparto">
            <p className="mb-3 text-sm">
              Overall PRAMA = media ponderata degli attributi valutati (scala 1-5), riportata sulla scala 40-99. Gli attributi «non valutabili»
              sono esclusi e i pesi rinormalizzati.
            </p>
            <WeightsEditor weights={weights} />
          </Panel>
        </div>

        <div id="privacy" className="scroll-mt-4">
          <Panel title="Privacy e conservazione">
            <RetentionForm months={months} />
            <h3 className="mb-2 mt-5 text-sm font-semibold">Profili da rivedere ({dueReview.length})</h3>
            {dueReview.length === 0 ? (
              <EmptyState title="Nessun profilo in scadenza" description="Qui compaiono i profili che hanno superato il termine di conservazione." />
            ) : (
              <DataTable
                caption="Profili con revisione di conservazione scaduta"
                rows={dueReview}
                rowKey={(a) => a.id}
                columns={[
                  { header: "Codice", cell: (a) => (<Link href={`/atleti/${a.id}`} className="font-semibold underline">{a.code}</Link>) },
                  { header: "Zona", cell: (a) => a.zone.code },
                  { header: "Ultima osservazione", cell: (a) => fmtDate(a.lastObservedAt) },
                  { header: "Revisione entro", cell: (a) => fmtDate(a.reviewDueAt) },
                ]}
              />
            )}
            <p className="hint mt-3">
              Dal profilo dell&apos;atleta l&apos;admin può anonimizzare o cancellare i dati. Termini e basi giuridiche vanno validati dai legali PRAMA.
            </p>
          </Panel>
        </div>

        <div id="export" className="scroll-mt-4">
          <Panel title="Export">
            <div className="flex flex-wrap gap-2">
              <a href="/api/export?type=atleti" className="btn-secondary">
                Atleti (CSV, solo codice)
              </a>
              <a href="/api/export?type=atleti&lista=interesse" className="btn-secondary">
                Lista di interesse (CSV)
              </a>
              <a href="/api/export?type=osservazioni" className="btn-secondary">
                Osservazioni (CSV)
              </a>
              <a href="/api/export?type=atleti&identita=1" className="btn-danger">
                Atleti con nomi (CSV)
              </a>
            </div>
            <p className="hint mt-3">
              Ogni export viene registrato nel log. Il PDF di una Player Card si ottiene dal profilo dell&apos;atleta, con «Report stampabile».
              L&apos;export con i nomi va usato solo quando indispensabile e non va inviato all&apos;esterno.
            </p>
          </Panel>
        </div>

        <div id="log" className="scroll-mt-4">
          <Panel title="Log delle attività (ultime 100)">
            <DataTable
              caption="Log delle attività"
              rows={logs}
              rowKey={(l) => l.id}
              columns={[
                { header: "Quando", cell: (l) => <span className="whitespace-nowrap tabular-nums">{fmtDateTime(l.createdAt)}</span> },
                { header: "Utente", cell: (l) => l.user?.name ?? "—" },
                { header: "Azione", cell: (l) => <code className="text-xs">{l.action}</code> },
                { header: "Oggetto", cell: (l) => l.entity },
                { header: "Dettagli", cell: (l) => <span className="muted text-xs">{l.meta ? JSON.stringify(l.meta) : ""}</span> },
              ]}
            />
          </Panel>
        </div>
      </div>
    </>
  );
}
