/**
 * Shared color palette for the app
 * Use these constants to maintain consistency across components
 */

export const COLORS = {
  // Primary brand colors
  primary: '#38bdf8',
  primaryLight: 'rgba(56,189,248,0.1)',
  primaryText: '#0f172a',

  // Background colors
  background: {
    screen: '#0f172a',
    card: '#1e293b',
    input: 'rgba(255,255,255,0.1)',
    modal: '#0f172a',
  },

  // Border colors
  border: {
    default: 'rgba(255,255,255,0.1)',
    focused: '#38bdf8',
    error: '#ef4444',
  },

  // Text colors
  text: {
    primary: '#fff',
    secondary: '#e2e8f0',
    tertiary: '#94a3b8',
    placeholder: '#64748b',
    disabled: '#475569',
    error: '#ef4444',
  },

  // Semantic colors
  error: '#ef4444',
  danger: '#ef4444',
  success: '#22c55e',

  // Overlay/modal
  overlay: 'rgba(0,0,0,0.7)',

  // Button variants
  button: {
    primary: '#38bdf8',
    primaryText: '#0f172a',
    secondary: 'rgba(255,255,255,0.1)',
    secondaryText: '#fff',
    outline: 'transparent',
    outlineText: '#38bdf8',
    outlineBorder: '#38bdf8',
    danger: '#ef4444',
    dangerText: '#fff',
  },
} as const;

// Opacity values
export const OPACITY = {
  disabled: 0.7,
  subtle: 0.1,
} as const;
