/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink:   '#0A0B0C',
        deep:  '#1C4357',
        steel: '#2C5A72',
        sky:   '#7FB3C7',
        mist:  '#E8EEF1',
        paper: '#F6F8F9',
        didial: {
          red:   '#E73C32',
          rojo:  '#E73C32',
          amber: '#F9C847',
          dark:  '#0E0F12',
          carbon:'#15171C'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}
