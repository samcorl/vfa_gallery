/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Art-inspired warm palette
        canvas: {
          50: '#fdfcfb',
          100: '#f9f6f3',
          200: '#f0ebe4',
          300: '#e4dcd1',
          400: '#d1c4b3',
          500: '#b8a694',
          600: '#9a8574',
          700: '#7d6a5c',
          800: '#65554b',
          900: '#524640',
        },
        artist: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#baddfd',
          300: '#7ec2fc',
          400: '#3aa3f8',
          500: '#1087e9',
          600: '#0469c7',
          700: '#0554a1',
          800: '#094885',
          900: '#0d3d6e',
        },
        accent: {
          50: '#fdf4f3',
          100: '#fce7e4',
          200: '#fad3ce',
          300: '#f5b3ab',
          400: '#ed867a',
          500: '#e15f50',
          600: '#cd4333',
          700: '#ac3528',
          800: '#8e3025',
          900: '#772d25',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'system-ui', 'sans-serif'],
      },
      animation: {
        shimmer: 'shimmer 1.5s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
      spacing: {
        'touch': '44px',
      },
      minHeight: {
        'touch': '44px',
      },
      minWidth: {
        'touch': '44px',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
