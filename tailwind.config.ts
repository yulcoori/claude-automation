import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fdf6f3",
          100: "#fbeae4",
          200: "#f7d5c9",
          300: "#f0b5a1",
          400: "#e78a6d",
          500: "#dc6845",
          600: "#c94f2c",
          700: "#a83f23",
          800: "#8a3621",
          900: "#722f20",
        },
      },
    },
  },
  plugins: [],
};
export default config;
