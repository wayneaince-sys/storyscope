/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: {
          50: '#f7f5f0',
          100: '#ebe7dc',
          200: '#d6cfbd',
          300: '#b9ae93',
          400: '#998a68',
          500: '#7d6f4f',
          600: '#5e533c',
          700: '#3f372a',
          800: '#26211a',
          900: '#15120e',
          950: '#0c0a07',
        },
        accent: {
          DEFAULT: '#c2410c',
          soft: '#fb923c',
          deep: '#7c2d12',
        },
      },
      boxShadow: {
        'paper': '0 1px 2px rgba(15,15,12,0.06), 0 8px 24px -12px rgba(15,15,12,0.18)',
      },
    },
  },
  plugins: [],
};
