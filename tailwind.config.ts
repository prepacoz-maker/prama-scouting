import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Palette PRAMA: blu profondo, neutri caldi, accento ambra, verde per gli stati positivi.
        prama: {
          50: "#F2F5FA",
          100: "#E1E8F2",
          200: "#C2CFE3",
          300: "#93A8C9",
          400: "#5F7BAA",
          500: "#3D5A8C",
          600: "#2B4470",
          700: "#1F3357",
          800: "#172743",
          900: "#101C33",
          950: "#0A1324",
        },
        accent: { 400: "#E0B04A", 500: "#C9962B", 600: "#A87A1C" },
        campo: { 500: "#2F8F5B", 600: "#24744A" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      boxShadow: { card: "0 1px 2px rgba(16,28,51,.06), 0 8px 24px -12px rgba(16,28,51,.18)" },
    },
  },
  plugins: [],
};
export default config;
