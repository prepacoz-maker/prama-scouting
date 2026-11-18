import type { SessionUser } from "@/lib/permissions";

declare module "next-auth" {
  interface Session {
    user: SessionUser;
  }
}
