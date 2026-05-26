/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#2EC4A0',
          dark: '#22a386',
          light: '#4DD9B6',
          50: '#f0fdf9',
          100: '#ccfbef',
          900: '#134e3f',
        },
      },
    },
  },
  plugins: [],
};
