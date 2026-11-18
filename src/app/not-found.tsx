import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="panel max-w-md p-6 text-center">
        <h1 className="text-xl font-bold">Pagina non trovata</h1>
        <p className="muted mt-2 text-sm">Il contenuto non esiste oppure non rientra nella tua zona o nei tuoi permessi.</p>
        <Link href="/" className="btn-primary mt-4">
          Torna alla dashboard
        </Link>
      </div>
    </main>
  );
}
