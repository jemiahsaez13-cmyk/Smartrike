import { MD3LightTheme } from 'react-native-paper';

// SaaS-Grade Palette
const palette = {
  primary: '#0F172A',      // Slate 900 (Main brand/text)
  primaryHover: '#1E293B', // Slate 800
  accent: '#2563EB',       // Blue 600 (Primary actions)
  accentHover: '#1D4ED8',  // Blue 700
  secondary: '#10B981',    // Emerald 500 (Success/Go)
  
  background: '#F8FAFC',   // Slate 50 (App background)
  surface: '#FFFFFF',      // White (Cards, modals)
  surfaceHover: '#F1F5F9', // Slate 100
  
  text: '#0F172A',         // Slate 900 (Headings)
  textSecondary: '#475569',// Slate 600 (Body)
  textMuted: '#94A3B8',    // Slate 400 (Placeholders, meta)
  
  border: '#E2E8F0',       // Slate 200 (Default borders)
  borderFocus: '#CBD5E1',  // Slate 300
  
  error: '#EF4444',        // Red 500
  errorLight: '#FEF2F2',   // Red 50
  success: '#10B981',      // Emerald 500
  successLight: '#ECFDF5', // Emerald 50
  warning: '#F59E0B',      // Amber 500
  warningLight: '#FFFBEB', // Amber 50
  info: '#3B82F6',         // Blue 500
  infoLight: '#EFF6FF',    // Blue 50
};

const paperFonts = {
  ...MD3LightTheme.fonts,
  displayLarge: { ...MD3LightTheme.fonts.displayLarge, fontFamily: 'Poppins_700Bold', fontWeight: '700' as const, letterSpacing: -0.5 },
  headlineLarge: { ...MD3LightTheme.fonts.headlineLarge, fontFamily: 'Poppins_700Bold', fontWeight: '700' as const, letterSpacing: -0.5 },
  titleLarge: { ...MD3LightTheme.fonts.titleLarge, fontFamily: 'Poppins_600SemiBold', fontWeight: '600' as const },
  labelLarge: { ...MD3LightTheme.fonts.labelLarge, fontFamily: 'Poppins_500Medium', fontWeight: '500' as const },
  bodyLarge: { ...MD3LightTheme.fonts.bodyLarge, fontFamily: 'Questrial_400Regular', fontWeight: '400' as const },
  bodyMedium: { ...MD3LightTheme.fonts.bodyMedium, fontFamily: 'Questrial_400Regular', fontWeight: '400' as const },
};

export const theme = {
  ...MD3LightTheme,
  fonts: paperFonts,
  colors: {
    ...MD3LightTheme.colors,
    primary: palette.primary,
    onPrimary: '#FFFFFF',
    primaryContainer: palette.surfaceHover,
    onPrimaryContainer: palette.primary,
    secondary: palette.accent,
    onSecondary: '#FFFFFF',
    error: palette.error,
    background: palette.background,
    surface: palette.surface,
    outline: palette.border,
  },
  roundness: 8, // Standardized SaaS border radius
};

export const colors = palette;

// Minimal gradients (used sparingly)
export const gradients = {
  brand: [palette.primary, palette.primaryHover] as [string, string],
  accent: [palette.accent, palette.accentHover] as [string, string],
};

// 8pt grid system spacing
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  screen: 24,
};

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 9999,
};

// Smooth, highly diffused SaaS shadows
export const shadows = {
  none: {
    elevation: 0,
    shadowOpacity: 0,
  },
  sm: {
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2
  },
  md: {
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4
  },
  lg: {
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8
  }
};

export const fonts = {
  poppins: {
    medium: { fontFamily: 'Poppins_500Medium', fontWeight: '500' as const },
    semibold: { fontFamily: 'Poppins_600SemiBold', fontWeight: '600' as const },
    bold: { fontFamily: 'Poppins_700Bold', fontWeight: '700' as const },
  },
  questrial: {
    regular: { fontFamily: 'Questrial_400Regular', fontWeight: '400' as const },
  },
};

// Strict SaaS Typography Scale
export const typography = {
  h1: { ...fonts.poppins.bold, fontSize: 32, lineHeight: 40, letterSpacing: -0.5, color: colors.text },
  h2: { ...fonts.poppins.bold, fontSize: 24, lineHeight: 32, letterSpacing: -0.3, color: colors.text },
  h3: { ...fonts.poppins.semibold, fontSize: 18, lineHeight: 28, color: colors.text },
  subtitle: { ...fonts.poppins.medium, fontSize: 16, lineHeight: 24, color: colors.textSecondary },
  body: { ...fonts.questrial.regular, fontSize: 15, lineHeight: 24, color: colors.textSecondary },
  bodySmall: { ...fonts.questrial.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary },
  label: { ...fonts.poppins.medium, fontSize: 14, lineHeight: 20, color: colors.text },
  labelSmall: { ...fonts.poppins.medium, fontSize: 12, lineHeight: 16, color: colors.textMuted },
  button: { ...fonts.poppins.semibold, fontSize: 15, lineHeight: 24 },
  number: { ...fonts.poppins.semibold, letterSpacing: 0, color: colors.text },
};


