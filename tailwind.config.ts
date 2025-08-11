import type { Config } from "tailwindcss"

export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}", // 根据你的项目路径调整
  ],
  theme: {
    extend: {
      colors: {
        primary: "#445ff6",    // 主色
        secondary: "#7f0df9",  // 副色
        accent: "#56a6ec",     // 辅助色
        darkblue: "#1f28fa",   // 强调色
        darkbg: "#252077",     // 深色背景
        textmain: "#000001",   // 主文本色
        lightbg: "#f9faff"     // 浅色模式背景
      },
      backgroundImage: {
        "gradient-primary": "linear-gradient(135deg, #445ff6, #7f0df9)",
        "gradient-blue": "linear-gradient(135deg, #1f28fa, #56a6ec)",
        "gradient-dark": "linear-gradient(135deg, #252077, #1f28fa)",
      },
      fontFamily: {
        sans: ["Inter", "PingFang SC", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        sm: "4px",
        md: "8px",
      },
      boxShadow: {
        card: "0 4px 20px rgba(0, 0, 0, 0.08)",
        glow: "0 6px 20px rgba(68, 95, 246, 0.3)",
      },
      spacing: {
        section: "64px",
      },
      transitionDuration: {
        fast: "200ms",
        normal: "300ms",
      },
    },
  },
  plugins: [],
} satisfies Config