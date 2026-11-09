/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Warna brand FloralWin's: dusty pink / peach pastel.
        floral: {
          DEFAULT: '#D48C8C',
          50: '#fdf6f6',
          100: '#fae9e9',
          200: '#f4d4d4',
          300: '#ebbbbb',
          400: '#e1a3a3',
          500: '#d48c8c',
          600: '#b06868',
          700: '#955454',
          800: '#7a4545',
          900: '#633a3a',
        },
      },
      boxShadow: {
        card: '0 18px 45px -20px rgba(15, 23, 42, 0.25)',
      },
    },
  },
  plugins: [],
};
