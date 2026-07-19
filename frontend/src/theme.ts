import { createTheme } from '@mui/material/styles'

// Dark "living brain" palette shared across all views.
export const synapse = {
  bg: '#05070f',
  bgElevated: 'rgba(13, 18, 36, 0.85)',
  cyan: '#22d3ee',
  violet: '#a78bfa',
  amber: '#f59e0b',
  textDim: 'rgba(226, 232, 240, 0.6)',
  line: 'rgba(34, 211, 238, 0.15)',
}

export const confidenceColor: Record<string, string> = {
  high: synapse.cyan,
  medium: synapse.violet,
  low: '#94a3b8',
  verify_offline: synapse.amber,
}

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: synapse.cyan },
    secondary: { main: synapse.violet },
    warning: { main: synapse.amber },
    background: { default: synapse.bg, paper: '#0d1224' },
    text: { primary: '#e2e8f0', secondary: synapse.textDim },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: '"Inter", "Segoe UI", sans-serif',
    // Larger, more confident base scale for a professional feel.
    fontSize: 16,
    h1: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: '3.6rem', letterSpacing: '-0.02em' },
    h2: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: '2.8rem', letterSpacing: '-0.015em' },
    h3: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: '2.3rem', letterSpacing: '-0.01em' },
    h4: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: '1.95rem' },
    h5: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 600, fontSize: '1.6rem' },
    h6: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 600, fontSize: '1.3rem', letterSpacing: '0.02em' },
    subtitle1: { fontSize: '1.15rem', lineHeight: 1.6 },
    subtitle2: { fontSize: '1rem', fontWeight: 600 },
    body1: { fontSize: '1.08rem', lineHeight: 1.65 },
    body2: { fontSize: '0.98rem', lineHeight: 1.6 },
    button: { fontSize: '1rem', fontWeight: 600 },
    caption: { fontSize: '0.85rem', letterSpacing: '0.01em' },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: `1px solid ${synapse.line}`,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 12,
          paddingInline: 20,
          paddingBlock: 10,
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: { fontSize: '1.15rem' },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontSize: '0.85rem', height: 30 },
      },
    },
  },
})
