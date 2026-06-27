import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "#D9DEE8",
        surface: "#F7F8FA",
        ink: "#172033",
        muted: "#5F6B7A",
        accent: "#EA580C",
        "accent-strong": "#C2410C",
        "accent-soft": "#FFF7ED",
      },
      boxShadow: {
        panel: "0 1px 2px rgba(18, 25, 38, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
