/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        town: {
          bg: "#0a0b10",
          "bg-alt": "#0e1018",
          surface: "#13151e",
          "surface-hover": "#1a1d2a",
          "surface-active": "#1f2233",
          border: "#232638",
          "border-light": "#2e3250",
          accent: "#7c5cfc",
          "accent-hover": "#9b82fd",
          "accent-muted": "#5a3fd4",
          "accent-glow": "rgba(124, 92, 252, 0.15)",
          secondary: "#3b82f6",
          text: "#e8ecf4",
          "text-muted": "#8892a8",
          "text-faint": "#5a6178",
          danger: "#f43f5e",
          "danger-soft": "rgba(244, 63, 94, 0.12)",
          success: "#10b981",
          "success-soft": "rgba(16, 185, 129, 0.12)",
          warning: "#f59e0b",
          "warning-soft": "rgba(245, 158, 11, 0.12)",
          info: "#06b6d4",
        },
      },
      backgroundImage: {
        "gradient-accent": "linear-gradient(135deg, #7c5cfc 0%, #3b82f6 100%)",
        "gradient-accent-v":
          "linear-gradient(180deg, #7c5cfc 0%, #5a3fd4 100%)",
        "gradient-surface":
          "linear-gradient(180deg, #15172200 0%, #151722 100%)",
        "gradient-glow":
          "radial-gradient(ellipse at 50% 0%, rgba(124, 92, 252, 0.08) 0%, transparent 70%)",
      },
      boxShadow: {
        "glow-sm": "0 0 15px -3px rgba(124, 92, 252, 0.15)",
        "glow-md": "0 0 25px -5px rgba(124, 92, 252, 0.2)",
        "glow-lg": "0 0 40px -8px rgba(124, 92, 252, 0.25)",
        card: "0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.3)",
        dialog:
          "0 25px 50px -12px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.25s ease-out",
        "slide-in": "slideIn 0.2s ease-out",
        "scale-in": "scaleIn 0.15s ease-out",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          "0%": { opacity: "0", transform: "translateX(-8px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};
