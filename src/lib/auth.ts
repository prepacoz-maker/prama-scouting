import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "./db";
import { audit } from "./audit";
import { can, type Permission, type Role, type SessionUser } from "./permissions";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credenziali",
      credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? "";
        if (!email || !password) return null;
        const user = await db.user.findUnique({ where: { email } });
        if (!user || !user.active) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;
        await audit(user.id, "LOGIN", "User", user.id);
        return { id: user.id, name: user.name, email: user.email, role: user.role, zoneId: user.zoneId };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as unknown as SessionUser).role;
        token.zoneId = (user as unknown as SessionUser).zoneId;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.id as string,
        name: token.name ?? "",
        email: token.email ?? "",
        role: token.role as Role,
        zoneId: (token.zoneId as string | null) ?? null,
      } as SessionUser;
      return session;
    },
  },
};

/** Utente corrente, riletto dal database: ruolo, zona e stato attivo sono sempre aggiornati. */
export async function getUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  const id = (session?.user as SessionUser | undefined)?.id;
  if (!id) return null;
  const user = await db.user.findUnique({ where: { id } });
  if (!user || !user.active) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role, zoneId: user.zoneId };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user, permission)) redirect("/");
  return user;
}
