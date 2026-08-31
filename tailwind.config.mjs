/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        darwin: {
          blue: '#1976d2',
          darkBlue: '#1565c0',
          navy: '#0d47a1',
          accent: '#1e88e5',
          lightBg: '#f0f4f9',
          card: '#ffffff',
          tickerBg: '#e8f4fd',
          tickerBorder: '#b9e2fe',
        },
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc7fb',
          400: '#38aaf6',
          500: '#0e8fe5',
          600: '#0271c3',
          700: '#035a9e',
          800: '#074c82',
          900: '#0b406d',
          950: '#072949',
        },
        iso: {
          blue: '#1f4ea3',
          dark: '#1e293b',
          light: '#f8fafc',
          accent: '#2563eb',
          emerald: '#10b981',
          amber: '#f59e0b',
          rose: '#ef4444',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      boxShadow: {
        'darwin-card': '0 2px 8px -1px rgba(0, 0, 0, 0.05), 0 1px 3px -1px rgba(0, 0, 0, 0.03)',
        'darwin-hover': '0 10px 25px -4px rgba(30, 136, 229, 0.12), 0 4px 10px -2px rgba(0, 0, 0, 0.04)',
        'glow-brand': '0 4px 14px 0 rgba(25, 118, 210, 0.35)',
        'glow-emerald': '0 4px 14px 0 rgba(16, 185, 129, 0.35)',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(15px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        }
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scale-in': 'scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'float': 'float 3s ease-in-out infinite',
        'pulse-soft': 'pulseSoft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
};
