/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        playfair: ['"Playfair Display"', 'serif'],
        dm: ['"DM Sans"', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
      colors: {
  beige: {
    50: '#F0EBE3',
    100: '#E8E0D5',
    200: '#DDD4C7',
    300: '#C9BFB3',
    400: '#B5A99B',
    500: '#9C8E82',
    600: '#7D7168',
    700: '#5F5650',
    800: '#3E3B37',
    900: '#2C2A27',
  }
},
    },
  },
  plugins: [],
}