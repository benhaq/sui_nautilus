/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Medical Vault color palette
        primary: {
          50: '#E8F4FF',
          100: '#D1E9FF',
          200: '#A3D3FF',
          300: '#75BDFF',
          400: '#47A7FF',
          500: '#298DFF',  // Primary: #298DFF
          600: '#2171CC',
          700: '#195599',
          800: '#103866',
          900: '#081C33',
        },
        secondary: {
          50: '#E9FEF4',
          100: '#D3FDE9',
          200: '#A7FBD3',
          300: '#7BF9BD',
          400: '#4FF7A7',
          500: '#23F48C',  // Secondary: #23F48C
          600: '#1CC370',
          700: '#159254',
          800: '#0E6238',
          900: '#07311C',
        },
        success: {
          50: '#E9FEF4',
          500: '#23F48C',  // Using secondary as success
          600: '#1CC370',
        },
        background: {
          light: '#FFFFFF',   // Background: #FFFFFF
          dark: '#121212',    // Dark mode uses text-color as bg
          secondary: '#E9EFFF', // Secondary-background: #E9EFFF
        },
        text: {
          light: '#121212',   // Text-color: #121212
          dark: '#FFFFFF',    // Inverted for dark mode
          muted: '#6B7280',
        },
        border: {
          light: '#E9EFFF',   // Using secondary-background
          dark: '#2D2D2D',
        },
      },
      fontFamily: {
        heading: ['Lexend', 'sans-serif'],
        body: ['Source Sans 3', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
