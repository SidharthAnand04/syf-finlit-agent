import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          950: "#090b12",
          900: "#11131d",
          850: "#171923",
          800: "#202331",
        },
        syf: {
          gold: "#FBC600",
          goldDark: "#D9A800",
          charcoal: "#3B3C43",
          ink: "#171923",
          cream: "#fbfbf8",
          muted: "#94969A",
        },
        accent: {
          cyan: "#54D6FF",
          violet: "#9D7CFF",
        },
      },
      fontFamily: {
        sans: ["Synchrony Sans", "Inter", "Arial", "sans-serif"],
      },
      borderRadius: {
        glass: "1.25rem",
      },
      boxShadow: {
        glass:
          "0 24px 70px rgba(4,8,18,0.28), inset 0 1px 0 rgba(255,255,255,0.22)",
        "glass-soft":
          "0 16px 42px rgba(4,8,18,0.18), inset 0 1px 0 rgba(255,255,255,0.18)",
        glow: "0 18px 45px rgba(251,198,0,0.22)",
        "cool-glow": "0 18px 52px rgba(84,214,255,0.18)",
      },
      backgroundImage: {
        "app-canvas":
          "radial-gradient(circle at 12% 8%, rgba(251,198,0,0.24) 0, transparent 30%), radial-gradient(circle at 82% 14%, rgba(84,214,255,0.16) 0, transparent 26%), radial-gradient(circle at 72% 72%, rgba(157,124,255,0.14) 0, transparent 30%), linear-gradient(135deg, #090b12 0%, #171923 48%, #202331 100%)",
        "glass-highlight":
          "linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06))",
      },
      keyframes: {
        "glass-in": {
          "0%": { opacity: "0", transform: "translateY(12px) scale(0.985)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-220% 0" },
          "100%": { backgroundPosition: "220% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      animation: {
        "glass-in": "glass-in 420ms cubic-bezier(0.16,1,0.3,1) both",
        shimmer: "shimmer 1.6s linear infinite",
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
