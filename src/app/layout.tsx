import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "PRAMA Scouting", template: "%s · PRAMA Scouting" },
  description: "Archivio scouting riservato PRAMA Talent Management",
  robots: { index: false, follow: false },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#172743" },
    { media: "(prefers-color-scheme: dark)", color: "#0A1324" },
  ],
};

// Applica il tema salvato prima del primo rendering, per evitare lampi di colore.
const themeScript = `try{if(localStorage.getItem("prama-theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
