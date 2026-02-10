/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        town: {
          bg: "#0f1117",
          surface: "#1a1d27",
          border: "#2a2d3a",
          accent: "#6366f1",
          "accent-hover": "#818cf8",
          text: "#e2e8f0",
          "text-muted": "#94a3b8",
          danger: "#ef4444",
          success: "#22c55e",
        },
      },
    },
  },
  plugins: [],
};
