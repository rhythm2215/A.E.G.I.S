/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Obsidian Aegis Design System — extracted from Stitch project
        'surface':                   '#0d1516',
        'surface-dim':               '#0d1516',
        'surface-bright':            '#333a3c',
        'surface-container-lowest':  '#080f11',
        'surface-container-low':     '#151d1e',
        'surface-container':         '#192122',
        'surface-container-high':    '#242b2d',
        'surface-container-highest': '#2e3638',
        'surface-charcoal':          '#121417',
        'surface-variant':           '#2e3638',
        'surface-tint':              '#00daf3',
        'tactical-obsidian':         '#0A0B0D',

        'on-surface':                '#dce4e5',
        'on-surface-variant':        '#bac9cc',
        'on-background':             '#dce4e5',

        'inverse-surface':           '#dce4e5',
        'inverse-on-surface':        '#2a3233',

        'outline':                   '#849396',
        'outline-variant':           '#3b494c',
        'border-glass':              'rgba(255, 255, 255, 0.08)',

        'background':                '#0d1516',

        // Primary — Electric Blue (Drone / Active / Interactive)
        'primary':                   '#c3f5ff',
        'primary-container':         '#00e5ff',
        'primary-fixed':             '#9cf0ff',
        'primary-fixed-dim':         '#00daf3',
        'on-primary':                '#00363d',
        'on-primary-container':      '#00626e',
        'on-primary-fixed':          '#001f24',
        'on-primary-fixed-variant':  '#004f58',
        'inverse-primary':           '#006875',

        // Secondary — Alert Red (Suspects / Critical / Threats)
        'secondary':                 '#ffb4a2',
        'secondary-container':       '#ff562c',
        'secondary-fixed':           '#ffdad2',
        'secondary-fixed-dim':       '#ffb4a2',
        'on-secondary':              '#621100',
        'on-secondary-container':    '#560e00',
        'on-secondary-fixed':        '#3c0700',
        'on-secondary-fixed-variant':'#8a1d00',

        // Tertiary — Amber (Warnings / Low Battery)
        'tertiary':                  '#ffeac0',
        'tertiary-container':        '#fec931',
        'tertiary-fixed':            '#ffdf96',
        'tertiary-fixed-dim':        '#f3bf26',
        'on-tertiary':               '#3e2e00',
        'on-tertiary-container':     '#6f5500',
        'on-tertiary-fixed':         '#251a00',
        'on-tertiary-fixed-variant': '#594400',

        // Error
        'error':                     '#ffb4ab',
        'error-container':           '#93000a',
        'on-error':                  '#690005',
        'on-error-container':        '#ffdad6',

        // Semantic
        'alert-amber':               '#FFC107',
        'health-emerald':            '#00E676',
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        sm:  '0.125rem',
        md:  '0.375rem',
        lg:  '0.5rem',
        xl:  '0.75rem',
        '2xl': '1rem',
        full: '9999px',
      },
      spacing: {
        'unit':               '4px',
        'panel-gap':          '12px',
        'container-padding':  '24px',
        'sidebar-width':      '320px',
        'top-bar-height':     '64px',
      },
      fontFamily: {
        'grotesk':   ['Hanken Grotesk', 'system-ui', 'sans-serif'],
        'inter':     ['Inter', 'system-ui', 'sans-serif'],
        'mono':      ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        'headline-lg': ['32px', { lineHeight: '1.2', fontWeight: '700', letterSpacing: '-0.02em' }],
        'headline-md': ['24px', { lineHeight: '1.2', fontWeight: '600' }],
        'headline-sm': ['18px', { lineHeight: '1.4', fontWeight: '600', letterSpacing: '0.05em' }],
        'body-lg':     ['16px', { lineHeight: '1.5', fontWeight: '400' }],
        'body-md':     ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        'data-mono':   ['13px', { lineHeight: '1.4', fontWeight: '500' }],
        'label-caps':  ['11px', { lineHeight: '1.2', fontWeight: '700', letterSpacing: '0.1em' }],
        'micro':       ['10px', { lineHeight: '1.2', fontWeight: '500' }],
      },
      boxShadow: {
        'hud-glow':      '0 0 30px rgba(0, 218, 243, 0.08)',
        'hud-top':       'inset 0 1px 0 rgba(0, 218, 243, 0.3)',
        'panel':         '0 4px 24px rgba(0, 0, 0, 0.4)',
        'ambient-red':   '0 0 20px rgba(255, 86, 44, 0.15)',
        'ambient-cyan':  '0 0 20px rgba(0, 218, 243, 0.15)',
        'ambient-amber': '0 0 16px rgba(255, 193, 7, 0.15)',
        'inner-glow':    'inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      },
      backdropBlur: {
        'xl': '24px',
        '2xl': '40px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'blink':      'blink 1.5s step-end infinite',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-in-left':  'slideInLeft 0.3s ease-out',
        'fade-in':        'fadeIn 0.2s ease-out',
        'scale-in':       'scaleIn 0.15s ease-out',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%':       { opacity: '0' },
        },
        slideInRight: {
          from: { transform: 'translateX(20px)', opacity: '0' },
          to:   { transform: 'translateX(0)',    opacity: '1' },
        },
        slideInLeft: {
          from: { transform: 'translateX(-20px)', opacity: '0' },
          to:   { transform: 'translateX(0)',     opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        scaleIn: {
          from: { transform: 'scale(0.95)', opacity: '0' },
          to:   { transform: 'scale(1)',    opacity: '1' },
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
