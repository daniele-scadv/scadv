/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          200: '#c7d4f6',
          300: '#a3b4ef',
          400: '#7a8de6',
          500: '#5669db',
          600: '#3d4fcf',
          700: '#2f3eb8',
          800: '#1B2A4A',
          900: '#141e36',
          950: '#0d1425',
        },
        gold: {
          400: '#F0C040',
          500: '#E6AC00',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
