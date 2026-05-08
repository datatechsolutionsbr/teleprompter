/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    './node_modules/@datatechsolutions/teleprompter/dist/**/*.{js,mjs,cjs}',
  ],
  theme: { extend: {} },
  plugins: [],
}
