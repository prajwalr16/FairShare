export const Theme = {
  colors: {
    // Canvas & Surfaces
    bg: '#06090F',             // Deep Obsidian Canvas
    bgSecondary: '#0A0E18',    // Deep Layered Surface
    card: '#0F1626',           // Luxury Cred Dark Card
    cardElevated: '#151F34',   // Elevated Interactive Card
    cardHover: '#1B2742',      // Hover / Press Surface
    cardGlass: 'rgba(15, 22, 38, 0.75)',

    // Borders
    border: 'rgba(255, 255, 255, 0.08)',
    borderLight: 'rgba(255, 255, 255, 0.14)',
    borderActive: 'rgba(0, 229, 255, 0.35)',

    // Neon Accents
    primary: '#00E5FF',        // Electric Cyan
    primaryGlow: 'rgba(0, 229, 255, 0.25)',
    teal: '#0EA5A4',           // Classic FairShare Teal
    gold: '#FFB800',           // Luxury Gold
    purple: '#A855F7',         // Royal Violet

    // Financial Semantics (Green = Get, Red/Coral = Owe)
    positive: '#00F5A0',       // Mint Neon Green (You Get / Settled)
    positiveBg: 'rgba(0, 245, 160, 0.12)',
    positiveBorder: 'rgba(0, 245, 160, 0.28)',
    positiveGlow: 'rgba(0, 245, 160, 0.25)',

    negative: '#FF4B72',       // Radiant Coral Red (You Owe / Borrowed)
    negativeBg: 'rgba(255, 75, 114, 0.12)',
    negativeBorder: 'rgba(255, 75, 114, 0.28)',
    negativeGlow: 'rgba(255, 75, 114, 0.25)',

    settled: '#94A3B8',
    settledBg: 'rgba(148, 163, 184, 0.08)',
    settledBorder: 'rgba(148, 163, 184, 0.20)',

    // Typography
    textPrimary: '#FFFFFF',
    textSecondary: '#E2E8F0',
    textMuted: '#94A3B8',
    textSubtle: '#64748B',
  },
  radius: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 20,
    xl: 28,
    full: 9999,
  },
};

export const Colors = {
  bg: Theme.colors.bg,
  card: Theme.colors.card,
  primary: Theme.colors.teal,
  text: Theme.colors.textPrimary,
  muted: Theme.colors.textMuted,
};

