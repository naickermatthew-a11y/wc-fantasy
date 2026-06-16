/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        orbitron: ['Orbitron', 'monospace'],
      },
      colors: {
        pitch: {
          dark: '#0a0f0d',
          card: '#111815',
          border: '#1e2b25',
        },
        neon: {
          green: '#00ff87',
          yellow: '#FFE600',
          blue: '#00BFFF',
        },
        green: {
          50:  '#f0fff8',
          100: '#ccffea',
          200: '#99ffd4',
          300: '#66ffbe',
          400: '#00ff87',
          500: '#00de72',
          600: '#00aa58',
          700: '#007a3f',
          800: '#005a2e',
          900: '#003a1d',
          950: '#001e0f',
        },
        yellow: {
          300: '#fff380',
          400: '#FFE600',
          500: '#e6cf00',
          900: '#332e00',
          950: '#1a1700',
        },
        blue: {
          300: '#80dfff',
          400: '#00BFFF',
          500: '#00a8e0',
          700: '#005a80',
          950: '#001420',
        },
      },
    },
  },
  plugins: [],
}
