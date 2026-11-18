"use client";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="panel mx-auto max-w-md p-6 text-center" role="alert">
      <h1 className="text-xl font-bold">Qualcosa non ha funzionato</h1>
      <p className="muted mt-2 text-sm">I dati già salvati sono al sicuro. Riprova; se il problema continua, avvisa il referente.</p>
      <button type="button" className="btn-primary mt-4" onClick={reset}>
        Riprova
      </button>
    </div>
  );
}
