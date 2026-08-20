import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      // 모모필라테스 브랜드 컬러 (로고 기준)
      colors: {
        brand: {
          50: "#fdf6f3",
          100: "#fbeae3",
          200: "#f7d4c7",
          300: "#f1b39d",
          400: "#e78868",
          500: "#dd6440",
          600: "#d2532a",
          700: "#ae4021",
          800: "#8c3520",
          900: "#732e1f",
        },
      },
      fontFamily: {
        serif: ["Noto Serif KR", "Nanum Myeongjo", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
