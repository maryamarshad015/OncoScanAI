/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './App.tsx',
    './main.tsx',
    './components/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          pink: '#ec4899',
          'pink-light': '#f9a8d4',
          'pink-dark': '#db2777',
          blue: '#3b82f6',
          background: '#f8fafc',
          surface: '#ffffff',
          'text-primary': '#0f172a',
          'text-secondary': '#64748b',
        },
      },
      boxShadow: {
        subtle: '0 1px 2px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.1)',
        lifted: '0 10px 20px rgba(15, 23, 42, 0.12), 0 4px 6px rgba(15, 23, 42, 0.08)',
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};