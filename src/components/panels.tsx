"use client";

// Pannelli interattivi del profilo atleta e della scheda: valutazione, stato, follow-up, media, consensi.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { anonymizeAthlete, deleteAthlete, recordConsent, revokeConsent, updateAthleteStatus } from "@/app/actions/athletes";
import { closeFollowUp, createFollowUp } from "@/app/actions/followups";
import { addMarker, deleteMedia } from "@/app/actions/media";
import { deleteDraft, reviewObservation } from "@/app/actions/observations";
import type { ActionResult } from "@/app/actions/result";
import { CONSENT_LABELS, FOLLOWUP_TYPE_LABELS, INTEREST_LABELS, STATUS_LABELS, fmtDate } from "@/lib/labels";
import { ConfirmationModal } from "./ConfirmationModal";
import { Alert } from "./ui";

/** Esegue una server action mostrando esito ed errori in modo uniforme. */
function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const run = (action: () => Promise<ActionResult>, okMessage: string, after?: () => void) =>
    start(async () => {
      setError(null);
      setSuccess(null);
      const result = await action();
      if (!result.ok) return setError(result.error);
      setSuccess(okMessage);
      after?.();
      router.refresh();
    });
  const feedback = (
    <>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}
    </>
  );
  return { run, pending, feedback };
}

export function ReviewPanel({ observationId }: { observationId: string }) {
  const { run, pending, feedback } = useAction();
  const [note, setNote] = useState("");
  return (
    <div className="space-y-3">
      {feedback}
      <div>
        <label htmlFor="review-note" className="label">
          Nota del referente <span className="muted font-normal">(obbligatoria per chiedere un&apos;integrazione)</span>
        </label>
        <textarea id="review-note" rows={3} className="input" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" disabled={pending} onClick={() => run(() => reviewObservation({ observationId, decision: "approve", note }), "Scheda approvata: la Player Card è stata aggiornata.")}>
          Approva
        </button>
        <button type="button" className="btn-secondary" disabled={pending} onClick={() => run(() => reviewObservation({ observationId, decision: "integrate", note }), "Integrazione richiesta allo scout.")}>
          Richiedi integrazione
        </button>
      </div>
      <p className="hint">Una scheda approvata non è più modificabile ed entra nel calcolo della Player Card.</p>
    </div>
  );
}

export function DeleteDraftButton({ observationId }: { observationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <button type="button" className="btn-danger" onClick={() => setOpen(true)}>
        Elimina bozza
      </button>
      <ConfirmationModal
        open={open}
        title="Eliminare la bozza?"
        confirmLabel="Elimina"
        danger
        pending={pending}
        onClose={() => setOpen(false)}
        onConfirm={() =>
          start(async () => {
            await deleteDraft(observationId);
            router.push("/");
            router.refresh();
          })
        }
      >
        La bozza verrà eliminata in modo definitivo.
      </ConfirmationModal>
    </>
  );
}

export function StatusPanel({
  athleteId,
  status,
  interest,
  nextCheckAt,
  assignedScoutId,
  scouts,
}: {
  athleteId: string;
  status: string;
  interest: string | null;
  nextCheckAt: string;
  assignedScoutId: string | null;
  scouts: { id: string; name: string }[];
}) {
  const { run, pending, feedback } = useAction();
  const [form, setForm] = useState({ status, interest: interest ?? "", nextCheckAt, assignedScoutId: assignedScoutId ?? "" });
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateAthleteStatus({ athleteId, ...form, interest: form.interest || null }), "Stato aggiornato.");
      }}
    >
      {feedback}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="st-status" className="label">
            Stato della segnalazione
          </label>
          <select id="st-status" className="input" value={form.status} onChange={set("status")}>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="st-interest" className="label">
            Interesse confermato
          </label>
          <select id="st-interest" className="input" value={form.interest} onChange={set("interest")}>
            <option value="">Non definito</option>
            {Object.entries(INTEREST_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="st-next" className="label">
            Prossimo controllo
          </label>
          <input id="st-next" type="date" className="input" value={form.nextCheckAt} onChange={set("nextCheckAt")} />
        </div>
        <div>
          <label htmlFor="st-scout" className="label">
            Scout assegnato
          </label>
          <select id="st-scout" className="input" value={form.assignedScoutId} onChange={set("assignedScoutId")}>
            <option value="">Nessuno</option>
            {scouts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button type="submit" className="btn-primary" disabled={pending}>
        Salva stato
      </button>
    </form>
  );
}

export function FollowUpForm({ athleteId, scouts, isAdmin }: { athleteId: string; scouts: { id: string; name: string }[]; isAdmin: boolean }) {
  const { run, pending, feedback } = useAction();
  const blank = { type: "NUOVO_CONTROLLO", dueDate: "", assignedToId: "", note: "" };
  const [form, setForm] = useState(blank);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => createFollowUp({ athleteId, ...form, assignedToId: form.assignedToId || null }), "Follow-up pianificato.", () => setForm(blank));
      }}
    >
      {feedback}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="fu-type" className="label">
            Tipo
          </label>
          <select id="fu-type" className="input" value={form.type} onChange={set("type")}>
            {Object.entries(FOLLOWUP_TYPE_LABELS)
              .filter(([k]) => isAdmin || k !== "COLLOQUIO")
              .map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label htmlFor="fu-date" className="label">
            Scadenza
          </label>
          <input id="fu-date" type="date" required className="input" value={form.dueDate} onChange={set("dueDate")} />
        </div>
        <div>
          <label htmlFor="fu-scout" className="label">
            Assegnato a
          </label>
          <select id="fu-scout" className="input" value={form.assignedToId} onChange={set("assignedToId")}>
            <option value="">Nessuno</option>
            {scouts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="fu-note" className="label">
          Nota <span className="muted font-normal">(che cosa verificare)</span>
        </label>
        <input id="fu-note" className="input" value={form.note} onChange={set("note")} />
      </div>
      <button type="submit" className="btn-primary" disabled={pending}>
        Pianifica
      </button>
    </form>
  );
}

export function CloseFollowUp({ followUpId, canCancel }: { followUpId: string; canCancel: boolean }) {
  const { run, pending, feedback } = useAction();
  const [outcome, setOutcome] = useState("");
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(true)}>
        Chiudi
      </button>
    );
  }
  return (
    <div className="mt-2 w-full space-y-2">
      {feedback}
      <label htmlFor={`out-${followUpId}`} className="label">
        Esito
      </label>
      <input id={`out-${followUpId}`} className="input" value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="es. Scheda inserita il…" />
      <div className="flex gap-2">
        <button type="button" className="btn-primary btn-sm" disabled={pending} onClick={() => run(() => closeFollowUp(followUpId, "COMPLETATO", outcome), "Follow-up completato.")}>
          Completato
        </button>
        {canCancel ? (
          <button type="button" className="btn-secondary btn-sm" disabled={pending} onClick={() => run(() => closeFollowUp(followUpId, "ANNULLATO", outcome), "Follow-up annullato.")}>
            Annulla follow-up
          </button>
        ) : null}
      </div>
    </div>
  );
}

interface MediaItem {
  id: string;
  kind: string;
  filename: string;
  createdAt: string;
  tags: string[];
  markers: { t: number; label: string }[];
  uploadedBy: string;
}

const clock = (t: number) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;

export function MediaPanel({ athleteId, items, canUpload, canManage, uploadBlockedReason }: { athleteId: string; items: MediaItem[]; canUpload: boolean; canManage: boolean; uploadBlockedReason: string | null }) {
  const router = useRouter();
  const { run, pending, feedback } = useAction();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadOk, setUploadOk] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [marker, setMarker] = useState({ min: "", sec: "", label: "" });

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setUploading(true);
    setUploadError(null);
    setUploadOk(false);
    const body = new FormData(formElement);
    body.set("athleteId", athleteId);
    try {
      const response = await fetch("/api/media", { method: "POST", body });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Caricamento non riuscito.");
      formElement.reset();
      setUploadOk(true);
      router.refresh();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Caricamento non riuscito. Controllare la connessione e riprovare.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Alert tone="warn">
        <strong>Divieto di condivisione.</strong> Video e foto riguardano anche minori: non si scaricano, non si inoltrano e non si pubblicano
        su social o chat. Ogni apertura viene registrata.
      </Alert>
      {feedback}

      {items.length === 0 ? <p className="muted text-sm">Nessun media caricato.</p> : null}
      <ul className="space-y-3">
        {items.map((m) => (
          <li key={m.id} className="rounded-lg border border-prama-100 p-3 dark:border-prama-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">
                  {m.kind === "VIDEO" ? "Video" : "Foto"} · {fmtDate(m.createdAt)}
                </p>
                <p className="muted text-xs">
                  Caricato da {m.uploadedBy}
                  {m.tags.length ? ` · ${m.tags.join(", ")}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary btn-sm" aria-expanded={openId === m.id} onClick={() => setOpenId(openId === m.id ? null : m.id)}>
                  {openId === m.id ? "Chiudi" : "Apri anteprima"}
                </button>
                {canManage ? (
                  <button type="button" className="btn-danger btn-sm" onClick={() => setToDelete(m.id)}>
                    Elimina
                  </button>
                ) : null}
              </div>
            </div>
            {openId === m.id ? (
              <div className="mt-3 space-y-3">
                {m.kind === "VIDEO" ? (
                  <video
                    src={`/api/media/${m.id}`}
                    controls
                    controlsList="nodownload noremoteplayback"
                    disablePictureInPicture
                    playsInline
                    onContextMenu={(e) => e.preventDefault()}
                    className="max-h-[60vh] w-full rounded-lg bg-black"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/media/${m.id}`} alt="Foto dell'atleta" onContextMenu={(e) => e.preventDefault()} className="max-h-[60vh] rounded-lg" />
                )}
                {m.kind === "VIDEO" ? (
                  <div>
                    <p className="text-sm font-semibold">Azioni chiave</p>
                    {m.markers.length ? (
                      <ul className="mt-1 flex flex-wrap gap-2">
                        {m.markers.map((k, i) => (
                          <li key={i} className="rounded-md bg-prama-100 px-2 py-1 text-xs dark:bg-prama-700">
                            <span className="font-bold tabular-nums">{clock(k.t)}</span> {k.label}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted text-xs">Nessuna azione segnata.</p>
                    )}
                    <form
                      className="mt-2 flex flex-wrap items-end gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        run(() => addMarker({ mediaId: m.id, t: Number(marker.min || 0) * 60 + Number(marker.sec || 0), label: marker.label }), "Azione aggiunta.", () => setMarker({ min: "", sec: "", label: "" }));
                      }}
                    >
                      <div>
                        <label htmlFor={`mk-min-${m.id}`} className="label">
                          Min
                        </label>
                        <input id={`mk-min-${m.id}`} type="number" min={0} inputMode="numeric" className="input w-20" value={marker.min} onChange={(e) => setMarker({ ...marker, min: e.target.value })} />
                      </div>
                      <div>
                        <label htmlFor={`mk-sec-${m.id}`} className="label">
                          Sec
                        </label>
                        <input id={`mk-sec-${m.id}`} type="number" min={0} max={59} inputMode="numeric" className="input w-20" value={marker.sec} onChange={(e) => setMarker({ ...marker, sec: e.target.value })} />
                      </div>
                      <div className="min-w-[10rem] flex-1">
                        <label htmlFor={`mk-label-${m.id}`} className="label">
                          Azione
                        </label>
                        <input id={`mk-label-${m.id}`} className="input" value={marker.label} onChange={(e) => setMarker({ ...marker, label: e.target.value })} placeholder="es. Filtrante per l'attaccante" />
                      </div>
                      <button type="submit" className="btn-secondary" disabled={pending}>
                        Aggiungi
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {canUpload ? (
        uploadBlockedReason ? (
          <Alert tone="info">{uploadBlockedReason}</Alert>
        ) : (
          <form onSubmit={upload} className="space-y-3 rounded-lg border border-dashed border-prama-200 p-3 dark:border-prama-700">
            {uploadError ? <Alert tone="error">{uploadError}</Alert> : null}
            {uploadOk ? <Alert tone="success">File caricato e cifrato.</Alert> : null}
            <div>
              <label htmlFor="media-file" className="label">
                Carica video o foto
              </label>
              <input id="media-file" name="file" type="file" required accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp" className="input" />
              <p className="hint">Solo materiale ottenuto da fonti autorizzate. MP4, MOV, WEBM, JPG, PNG, WEBP.</p>
            </div>
            <div>
              <label htmlFor="media-tags" className="label">
                Tag <span className="muted font-normal">(separati da virgola)</span>
              </label>
              <input id="media-tags" name="tags" className="input" placeholder="es. gara, primo tempo" />
            </div>
            <button type="submit" className="btn-primary" disabled={uploading}>
              {uploading ? "Caricamento…" : "Carica"}
            </button>
          </form>
        )
      ) : null}

      <ConfirmationModal
        open={toDelete !== null}
        title="Eliminare il media?"
        confirmLabel="Elimina"
        danger
        pending={pending}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && run(() => deleteMedia(toDelete), "Media eliminato.", () => setToDelete(null))}
      >
        Il file verrà eliminato in modo definitivo dall&apos;archivio.
      </ConfirmationModal>
    </div>
  );
}

interface ConsentItem {
  id: string;
  type: string;
  grantedBy: string;
  grantedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  documentRef: string | null;
}

export function ConsentPanel({ athleteId, items, canManage }: { athleteId: string; items: ConsentItem[]; canManage: boolean }) {
  const { run, pending, feedback } = useAction();
  const blank = { type: "VIDEO", grantedBy: "Genitore/tutore", grantedAt: new Date().toISOString().slice(0, 10), expiresAt: "", documentRef: "" };
  const [form, setForm] = useState(blank);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });
  const now = Date.now();
  return (
    <div className="space-y-3">
      {feedback}
      {items.length === 0 ? <p className="muted text-sm">Nessun consenso registrato: foto e video non possono essere caricati.</p> : null}
      <ul className="space-y-2">
        {items.map((c) => {
          const active = !c.revokedAt && (!c.expiresAt || new Date(c.expiresAt).getTime() > now);
          return (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-prama-100 px-3 py-2 text-sm dark:border-prama-700">
              <span>
                <strong>{CONSENT_LABELS[c.type]}</strong> · {c.grantedBy} · dal {fmtDate(c.grantedAt)}
                {c.expiresAt ? ` al ${fmtDate(c.expiresAt)}` : ""}
                {c.documentRef ? ` · rif. ${c.documentRef}` : ""}
              </span>
              <span className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${active ? "bg-emerald-100 text-emerald-900" : "bg-slate-200 text-slate-700"}`}>
                  {c.revokedAt ? "Revocato" : active ? "Attivo" : "Scaduto"}
                </span>
                {canManage && active ? (
                  <button type="button" className="btn-secondary btn-sm" disabled={pending} onClick={() => run(() => revokeConsent(c.id), "Consenso revocato.")}>
                    Revoca
                  </button>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
      {canManage ? (
        <form
          className="grid gap-3 rounded-lg border border-dashed border-prama-200 p-3 dark:border-prama-700 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => recordConsent({ athleteId, ...form }), "Consenso registrato.", () => setForm(blank));
          }}
        >
          <div>
            <label htmlFor="cs-type" className="label">
              Consenso per
            </label>
            <select id="cs-type" className="input" value={form.type} onChange={set("type")}>
              {Object.entries(CONSENT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="cs-by" className="label">
              Rilasciato da
            </label>
            <input id="cs-by" className="input" value={form.grantedBy} onChange={set("grantedBy")} />
          </div>
          <div>
            <label htmlFor="cs-from" className="label">
              Data del consenso
            </label>
            <input id="cs-from" type="date" required className="input" value={form.grantedAt} onChange={set("grantedAt")} />
          </div>
          <div>
            <label htmlFor="cs-to" className="label">
              Scadenza <span className="muted font-normal">(facoltativa)</span>
            </label>
            <input id="cs-to" type="date" className="input" value={form.expiresAt} onChange={set("expiresAt")} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="cs-ref" className="label">
              Riferimento del documento firmato
            </label>
            <input id="cs-ref" className="input" value={form.documentRef} onChange={set("documentRef")} placeholder="es. protocollo o posizione in archivio" />
            <p className="hint">Il documento firmato si conserva fuori dall&apos;app, presso i professionisti PRAMA.</p>
          </div>
          <div>
            <button type="submit" className="btn-primary" disabled={pending}>
              Registra consenso
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

export function PrivacyActions({ athleteId, code }: { athleteId: string; code: string }) {
  const router = useRouter();
  const { run, pending, feedback } = useAction();
  const [mode, setMode] = useState<"anonymize" | "delete" | null>(null);
  return (
    <div className="space-y-3">
      {feedback}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" onClick={() => setMode("anonymize")}>
          Anonimizza il profilo
        </button>
        <button type="button" className="btn-danger" onClick={() => setMode("delete")}>
          Cancella tutto
        </button>
      </div>
      <ConfirmationModal
        open={mode !== null}
        title={mode === "delete" ? `Cancellare ${code}?` : `Anonimizzare ${code}?`}
        confirmLabel={mode === "delete" ? "Cancella definitivamente" : "Anonimizza"}
        danger
        pending={pending}
        onClose={() => setMode(null)}
        onConfirm={() =>
          mode === "delete"
            ? run(() => deleteAthlete(athleteId), "Profilo cancellato.", () => router.push("/atleti"))
            : run(() => anonymizeAthlete(athleteId), "Profilo anonimizzato.", () => setMode(null))
        }
      >
        {mode === "delete"
          ? "Verranno eliminati profilo, schede, media, consensi e follow-up. L'operazione non si può annullare."
          : "Verranno eliminati nome, media, consensi, follow-up e testi liberi. Restano solo i voti, a fini statistici. L'operazione non si può annullare."}
      </ConfirmationModal>
    </div>
  );
}
