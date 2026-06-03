/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        whatsapp: {
          light: '#25D366',
          DEFAULT: '#128C7E',
          dark: '#075E54',
          bg: '#0b141a',
          panel: '#111b21',
          border: '#222d34'
        }
      }
    },
  },
  plugins: [],
}
