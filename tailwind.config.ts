import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./context/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        vibe: {
          coral: "#FF5C7A",
          orange: "#FF9F5A",
          purple: "#8B5CF6",
          violet: "#6D28D9",
          ink: "#120E1C",
          card: "#1B1526",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      backgroundImage: {
        "vibe-gradient": "linear-gradient(135deg, #FF5C7A 0%, #FF9F5A 45%, #8B5CF6 100%)",
        "vibe-gradient-soft": "linear-gradient(160deg, rgba(255,92,122,0.25) 0%, rgba(139,92,246,0.25) 100%)",
      },
      boxShadow: {
        glow: "0 0 40px rgba(255, 92, 122, 0.35)",
        card: "0 20px 60px -15px rgba(0,0,0,0.5)",
      },
      keyframes: {
        blob: {
          "0%, 100%": { transform: "translate(0px, 0px) scale(1)" },
          "33%": { transform: "translate(30px, -40px) scale(1.1)" },
          "66%": { transform: "translate(-20px, 20px) scale(0.95)" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        blob: "blob 12s infinite ease-in-out",
        "pulse-glow": "pulse-glow 2.5s infinite ease-in-out",
      },
    },
  },
  plugins: [],
};
export default config;
