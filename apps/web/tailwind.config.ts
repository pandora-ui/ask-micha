import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: [
    "./components/**/*.{js,vue,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./plugins/**/*.{js,ts}",
    "./app.vue",
    "./error.vue"
  ],
  safelist: [
    // Status badge classes (dynamically applied)
    "bg-emerald-100", "text-emerald-700",
    "bg-amber-100", "text-amber-700",
    "bg-red-100", "text-red-700",
    "bg-slate-100", "text-slate-500",
    // Status dot classes
    "bg-emerald-500", "bg-amber-500", "animate-pulse", "bg-red-500", "bg-slate-400",
    // Dark variants for status badges
    "dark:bg-emerald-900/30", "dark:text-emerald-400",
    "dark:bg-amber-900/30", "dark:text-amber-400",
    "dark:bg-red-900/30", "dark:text-red-400",
    "dark:bg-slate-800", "dark:text-slate-400",
    // Impact tag classes
    "bg-purple-100", "text-purple-700", "dark:bg-purple-900/30", "dark:text-purple-400",
    "bg-blue-100", "text-blue-700", "dark:bg-blue-900/30", "dark:text-blue-400",
    "bg-orange-100", "text-orange-700", "dark:bg-orange-900/30", "dark:text-orange-400",
    "bg-indigo-100", "text-indigo-700", "dark:bg-indigo-900/30", "dark:text-indigo-400",
    "bg-slate-600", "text-slate-600"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Sora", "Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "Menlo", "Consolas", "monospace"]
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out"
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(-6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      }
    }
  },
  plugins: []
} satisfies Config;
