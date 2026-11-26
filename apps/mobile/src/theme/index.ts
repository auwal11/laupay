export const colors = {
  // Keep the native app on the same brand tokens as the authenticated web
  // dashboard (web/src/index.css).
  midnight: '#171A4A',
  navy: '#12142E',
  navy2: '#2A2E6B',
  gold: '#F4B33F',
  white: '#FFFFFF',
  background: '#F6F7FB',
  surface: '#FFFFFF',
  success: '#1E8E5A',
  error: '#C4453A',
  muted: '#5B5E80',
  border: '#E4E6F1',
  text: '#12142E',
  subtext: '#5B5E80',
  softGold: '#FCE4B2',
  softGreen: '#DDF2E7',
  softRed: '#FDECEF',
  softBlue: '#EEF0FF',
  glassNavy: '#0B1220',
  glassNavyRaised: '#111B2D',
  glassSurface: 'rgba(255,255,255,0.075)',
  glassBorder: 'rgba(255,255,255,0.14)',
  glassText: '#F5F7FF',
  glassMuted: '#B7C0D3',
  glassTeal: '#58D6B3',
  glassBalance: '#17304D',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 36 } as const;
export const radius = { sm: 10, md: 16, lg: 22, pill: 999 } as const;
export const shadow = {
  card: {
    shadowColor: '#171A4A',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
} as const;
