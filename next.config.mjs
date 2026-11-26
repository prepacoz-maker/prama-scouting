/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      // Il player YouTube richiede un referrer: solo l'origine, solo nell'area match analysis.
      {
        source: "/match-analysis/:path*",
        headers: [{ key: "Referrer-Policy", value: "strict-origin" }],
      },
    ];
  },
};
export default nextConfig;
