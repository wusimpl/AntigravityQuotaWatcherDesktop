/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/**/*.{js,ts,jsx,tsx,html}',
  ],
  theme: {
    extend: {
      colors: {
        // 配额状态颜色
        quota: {
          normal: '#22c55e',    // 绿色 - 充足
          warning: '#eab308',   // 黄色 - 警告
          critical: '#ef4444',  // 红色 - 紧急
          depleted: '#6b7280',  // 灰色 - 耗尽
        },
      },
    },
  },
  plugins: [],
};
