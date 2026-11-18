import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PRAMA Scouting",
    short_name: "PRAMA",
    description: "Archivio scouting riservato PRAMA Talent Management",
    start_url: "/",
    display: "standalone",
    background_color: "#F4F5F7",
    theme_color: "#172743",
    lang: "it",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
