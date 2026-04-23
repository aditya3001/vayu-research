/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  corePlugins: {
    preflight: false, // keep our own CSS reset & base styles
  },
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        sans:    ['Manrope', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        v: {
          bg:            'var(--bg)',
          surface:       'var(--bg-surface)',
          muted:         'var(--bg-muted)',
          border:        'var(--border)',
          'border-s':    'var(--border-strong)',
          accent:        'var(--accent)',
          'accent-dim':  'var(--accent-dim)',
          text:          'var(--text)',
          'text-m':      'var(--text-muted)',
          'text-f':      'var(--text-faint)',
          'text-inv':    'var(--text-inverse)',
          danger:        'var(--color-danger)',
          'danger-bg':   'var(--color-danger-bg)',
        },
      },
    },
  },
  plugins: [],
}
