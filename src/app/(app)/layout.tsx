import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/labels";
import { Shell } from "@/components/Shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const zone = user.zoneId ? await db.zone.findUnique({ where: { id: user.zoneId } }) : null;
  return (
    <Shell user={{ name: user.name, roleLabel: ROLE_LABELS[user.role], zone: zone ? `${zone.code} ${zone.name}` : null }} isAdmin={user.role === "ADMIN"}>
      {children}
    </Shell>
  );
}
