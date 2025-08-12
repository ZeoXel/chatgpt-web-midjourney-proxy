/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#445ff6',    // 主色
        secondary: '#7f0df9',  // 副色
        accent: '#56a6ec',     // 辅助色
        darkblue: '#1f28fa',   // 强调色
        darkbg: '#252077',     // 深色背景
        textmain: '#000001',   // 主文本色
        lightbg: '#f9faff',    // 浅色模式背景
      },
      animation: {
        blink: 'blink 1.2s infinite steps(1, start)',
      },
      keyframes: {
        blink: {
          '0%, 100%': { 'background-color': 'currentColor' },
          '50%': { 'background-color': 'transparent' },
        },
      },
    },
  },
  plugins: [],
}
