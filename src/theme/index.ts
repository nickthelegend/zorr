/**
 * Zorr design system — ported from AlgoQuest's rich dark UI.
 * "Walk & Capture the Land" — GPS territory game on Solana + MagicBlock.
 */

export const colors = {
  // Base
  background: '#000000',
  surface: '#0A0A0F',
  surface2: '#0B0B13', // card interior over the gradient hairline
  card: 'rgba(255, 255, 255, 0.04)',
  border: 'rgba(255, 255, 255, 0.1)',
  hairline: 'rgba(255, 255, 255, 0.07)',

  // Brand accent (AlgoQuest violet)
  primary: '#7C3AED',
  primarySoft: 'rgba(124, 58, 237, 0.1)',
  primaryBorder: 'rgba(124, 58, 237, 0.3)',

  // Territory / capture accents
  territory: '#22D3A6', // emerald — captured land
  territorySoft: 'rgba(34, 211, 166, 0.12)',
  enemy: '#F43F5E', // rose — rival territory
  gold: '#FBBF24', // rewards / coins

  // Text
  text: '#FFFFFF',
  textMuted: 'rgba(255, 255, 255, 0.8)',
  textDim: 'rgba(255, 255, 255, 0.5)',
  textFaint: 'rgba(255, 255, 255, 0.3)',
} as const

export const fonts = {
  display: 'Audiowide', // gamey display font
  mono: 'SpaceMono',
  // Long case-sensitive data (wallet addresses, seeds) — same face as mono.
  data: 'SpaceMono',
  // Kickpact faces stay loaded for optional accents (currently unused).
  pixel: 'ZorrPixel',
  pixelDisplay: 'ZorrDisplay',
} as const

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const

export const gradients = {
  primary: ['#7C3AED', '#4C1D95'] as const,
  territory: ['#22D3A6', '#0F766E'] as const,
  cardGlow: ['rgba(124, 58, 237, 0.1)', 'rgba(0, 0, 0, 0)'] as const,
  fade: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.9)'] as const,
  // Glass hairline — the light-catching edge every premium card shares.
  hairline: ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0.10)'] as const,
}
