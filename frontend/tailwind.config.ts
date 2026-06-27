import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "#E2E7F0",
        surface: "#F7F8FB",
        panel: "#FFFFFF",
        ink: "#111827",
        muted: "#667085",
        subtle: "#98A2B3",
        accent: "#F45113",
        "accent-strong": "#D63D00",
        "accent-soft": "#FFF1E8",
        success: "#12B76A",
        "success-soft": "#E9F9F1",
        warning: "#F59E0B",
        "warning-soft": "#FFF7E6",
        danger: "#EF4444",
        "danger-soft": "#FEECEC",
        info: "#2563EB",
        "info-soft": "#EFF6FF",
        purple: "#8B5CF6",
        "purple-soft": "#F4F0FF",
      },
      boxShadow: {
        panel: "0 1px 2px rgba(17, 24, 39, 0.06), 0 10px 24px rgba(17, 24, 39, 0.03)",
      },
    },
  },
  plugins: [],
};

export default config;
