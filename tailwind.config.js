/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#d9e9ff',
          200: '#b8d7ff',
          300: '#88bfff',
          400: '#5ca2ff',
          500: '#347efb',
          600: '#1f5ee0',
          700: '#1b4bb4',
          800: '#1c4190',
          900: '#1a356f',
        },
      },
      boxShadow: {
        soft: '0 10px 30px rgba(20, 32, 60, 0.12)',
      },
    },
  },
  plugins: [],
}
