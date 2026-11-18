"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface Props {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Finestra di conferma basata su <dialog>: gestisce focus, tasto Esc e sfondo in modo nativo. */
export function ConfirmationModal({ open, title, children, confirmLabel, danger, pending, onConfirm, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="confirm-title"
      className="w-[min(92vw,28rem)] rounded-xl border border-prama-100 bg-white p-5 text-prama-900 shadow-card backdrop:bg-prama-950/60 dark:border-prama-700 dark:bg-prama-900 dark:text-prama-50"
    >
      <h2 id="confirm-title" className="text-lg font-semibold">
        {title}
      </h2>
      <div className="mt-2 text-sm">{children}</div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose} disabled={pending}>
          Annulla
        </button>
        <button type="button" className={danger ? "btn-danger" : "btn-primary"} onClick={onConfirm} disabled={pending}>
          {pending ? "Attendere…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
