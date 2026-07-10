/**
 * Tailwind Configuration — Steel-Blue Token System
 *
 * @description Maps Tailwind's color utilities to CSS custom properties
 * from packages/ui/src/tokens.css. All colors reference tokens — no raw hex.
 *
 * Usage in components:
 *   bg-background → var(--background)
 *   text-text-primary → var(--text-primary)
 *   border-border → var(--border)
 *
 * @antipattern Do NOT use raw hex colors in Tailwind classes.
 * @antipattern Do NOT reference old Neural Observatory vars (--void, --abyss, etc.).
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: [
    "./index.html",
    "./apps/web/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // =====================================================================
      // COLORS — mapped to CSS custom properties from tokens.css
      // =====================================================================
      colors: {
        // Surface elevation — tokens.css steel-blue system
        background: 'var(--background)',
        surface: {
          DEFAULT: 'var(--surface)',
          raised: 'var(--surface-raised)',
        },

        // Depth (RGB triplet defined in apps/web/index.css :root; maps to --surface-raised value)
        depth: 'rgb(var(--depth))',

        // Primary accent — steel-blue
        accent: {
          DEFAULT: 'var(--accent)',
          light: 'var(--accent-light)',
        },

        // Border colors
        border: {
          DEFAULT: 'var(--border)',
          subtle: 'var(--border-subtle)',
        },

        // Text/content colors
        content: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },

        // Direct text-* mapping
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',

        // Semantic colors
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',

        // Per-meter colors
        meter: {
          aliveness: 'var(--meter-aliveness)',
          curiosity: 'var(--meter-curiosity)',
          connection: 'var(--meter-connection)',
          ease: 'var(--meter-ease)',
          delight: 'var(--meter-delight)',
          anxiety: 'var(--meter-anxiety)',
          activity: 'var(--meter-activity)',
        },
      },

      // Font families — Outfit primary, Instrument Serif for display
      fontFamily: {
        display: ['Instrument Serif', 'Georgia', 'serif'],
        body: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },

      // Border radius — from tokens
      borderRadius: {
        'sm': 'var(--radius-sm)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
      },

      // Shadows — steel-blue tinted
      boxShadow: {
        'sm': '0 1px 2px rgba(0, 0, 0, 0.3)',
        'md': '0 4px 6px rgba(0, 0, 0, 0.4)',
        'lg': '0 10px 15px rgba(0, 0, 0, 0.5)',
        'glow': '0 0 20px rgba(80, 120, 168, 0.15)',
      },

      // Transition durations — from tokens
      transitionDuration: {
        'fast': 'var(--duration-fast)',
        'normal': 'var(--duration-normal)',
        'slow': 'var(--duration-slow)',
      },

      // Keyframes
      keyframes: {
        breathe: {
          '0%, 100%': { opacity: '0.7', transform: 'scale(0.98)' },
          '50%': { opacity: '1', transform: 'scale(1.02)' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },

      // Named animations
      animation: {
        'breathe': 'breathe 3s ease-in-out infinite',
        'fade-in': 'fade-in 0.3s ease-out forwards',
        'pulse-subtle': 'pulse-subtle 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
