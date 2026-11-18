import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Accesso" };

export default async function LoginPage() {
  if (await getUser()) redirect("/");
  return (
    <main className="flex min-h-screen items-center justify-center bg-prama-900 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-3 text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="h-12 w-12" />
          <div>
            <p className="font-display text-2xl font-bold leading-none tracking-[0.2em]">PRAMA</p>
            <p className="text-sm text-white/70">Scouting · archivio riservato</p>
          </div>
        </div>
        <div className="panel p-6">
          <h1 className="text-xl font-bold">Accedi</h1>
          <p className="muted mb-4 mt-1 text-sm">Accesso riservato a scout, referenti e staff PRAMA.</p>
          <LoginForm />
        </div>
        <p className="mt-4 text-center text-xs text-white/60">
          I dati e i video presenti nell&apos;archivio riguardano anche minori: è vietata ogni condivisione esterna.
        </p>
      </div>
    </main>
  );
}
