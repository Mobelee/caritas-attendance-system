/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Design tokens — Caritas identity, flat colors only, no gradients
        red: {
          DEFAULT: '#A6151F', // primary brand red (matches portal header)
          dark: '#7E0F17',    // pressed / hover state
          light: '#F6DEE0'    // subtle tints, badges, active-row backgrounds
        },
        ink: {
          DEFAULT: '#1C1C1E', // primary text
          soft: '#5B5B60',    // secondary text
          faint: '#8B8B90'    // placeholders, meta text
        },
        line: '#E7E5E4',      // hairline borders
        surface: '#FFFFFF',
        canvas: '#FAFAF9'     // page background, very slightly off-white
      },
      fontFamily: {
        display: ['"Source Serif 4"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace']
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        lg: '10px'
      },
      boxShadow: {
        card: '0 1px 2px rgba(28,28,30,0.06), 0 1px 0 rgba(28,28,30,0.04)'
      }
    }
  },
  plugins: []
}
