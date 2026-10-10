import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#1E1917",
          light: "#2C2623",
          dark: "#141110",
        },
        brand: {
          DEFAULT: "#C8102E",
          hover: "#A00D24",
          light: "#FDF2F4",
        },
        cream: {
          DEFAULT: "#F6F0E6",
          dark: "#EFE6D8",
        },
        card: {
          DEFAULT: "#FFFDF8",
        },
        border: {
          DEFAULT: "#E2D8C8",
          dark: "#C6B9A5",
        },
        muted: {
          DEFAULT: "#5A504A",
          light: "#847770",
        },
        // Public now-serving board (dark departure-board look)
        board: {
          bg: "#141110",
          tile: "#1E1917",
          rule: "#2C2623",
          digit: "#F6F0E6",
          dim: "#847770",
        },
        status: {
          done: {
            text: "#15803D",
            bg: "#DCFCE7",
            border: "#86EFAC",
          },
          pending: {
            text: "#B45309",
            bg: "#FEF3C7",
            border: "#FDE68A",
          },
          cancelled: {
            text: "#B91C1C",
            bg: "#FEE2E2",
            border: "#FCA5A5",
          },
          called: {
            text: "#1D4ED8",
            bg: "#DBEAFE",
            border: "#93C5FD",
          },
        },
      },
      fontFamily: {
        // Noto fallbacks carry Hindi and Gujarati glyphs, which Oswald and Public Sans don't have
        heading: ["var(--font-oswald)", "var(--font-noto-deva)", "var(--font-noto-guj)", "sans-serif"],
        body: ["var(--font-public-sans)", "var(--font-noto-deva)", "var(--font-noto-guj)", "sans-serif"],
      },
      boxShadow: {
        card: "0 4px 20px -2px rgba(30, 25, 23, 0.08)",
        dropdown: "0 10px 25px -5px rgba(30, 25, 23, 0.12)",
      },
    },
  },
  plugins: [],
};
export default config;
