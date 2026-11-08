/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#0a0d14',
          surface: '#111726',
          border: '#1f293d',
          accent: '#06b6d4',
          neon: '#a855f7',
        },
      },
    },
  },
  plugins: [],
};
