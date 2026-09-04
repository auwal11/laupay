import type { Config } from "tailwindcss";

// LAUPAY brand tokens. Keep these as the single source of truth for color —
// components should reference laupay.* rather than raw hex values.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        laupay: {
          indigo: "#171A4A",
          "indigo-deep": "#101233",
          "indigo-soft": "#2A2E6B",
          amber: "#F4B33F",
          "amber-soft": "#FCE4B2",
          surface: "#FFFFFF",
          "surface-muted": "#F6F7FB",
          border: "#E4E6F1",
          ink: "#12142E",
          "ink-muted": "#5B5E80",
          success: "#1E8E5A",
          danger: "#C4453A",
          pending: "#B8862E",
        },
      },
      fontFamily: {
        // Headings: a slightly geometric sans for a bit of character.
        display: [
          "Sora",
          "Manrope",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        // Body/data: optimized for legibility at small sizes and tabular figures.
        body: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "14px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(18, 20, 46, 0.06), 0 1px 1px rgba(18, 20, 46, 0.04)",
        raised: "0 8px 24px rgba(23, 26, 74, 0.12)",
      },
    },
  },
  plugins: [],
} satisfies Config;
