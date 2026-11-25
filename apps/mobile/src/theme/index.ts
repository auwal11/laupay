export const colors = {
  midnight: '#071735',
  navy: '#101D40',
  navy2: '#1B2C57',
  gold: '#FBBF24',
  white: '#F8FAFC',
  background: '#F1F5F9',
  surface: '#FFFFFF',
  success: '#16A34A',
  error: '#DC2626',
  muted: '#64748B',
  border: '#E2E8F0',
  text: '#0F172A',
  subtext: '#64748B',
  softGold: '#FEF3C7',
  softGreen: '#DCFCE7',
  softRed: '#FEE2E2',
  softBlue: '#E0E7FF',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 36 } as const;
export const radius = { sm: 10, md: 16, lg: 22, pill: 999 } as const;
export const shadow = {
  card: {
    shadowColor: '#071735',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
} as const;
