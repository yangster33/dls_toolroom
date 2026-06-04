// postcss.config.js
export default {
  plugins: {
    // ✅ 关键：使用 @tailwindcss/postcss 来处理 Tailwind v4
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
}
