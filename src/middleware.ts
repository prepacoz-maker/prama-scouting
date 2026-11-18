import { withAuth } from "next-auth/middleware";

export default withAuth({ pages: { signIn: "/login" } });

// Tutto richiede il login, tranne la pagina di accesso, le API di autenticazione e i file statici.
export const config = {
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)"],
};
