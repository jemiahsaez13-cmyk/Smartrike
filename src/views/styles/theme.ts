import { MD3LightTheme } from 'react-native-paper';

// ────────────────────────────────────────────────────────────────
// Uber-inspired design system
// Monochrome base (black / white / gray) with minimal, purposeful
// accent color. Bold geometric type, tight radii, whisper-soft shadows.
// ────────────────────────────────────────────────────────────────
const palette = {
  primary: '#000000',      // Uber Black (brand, primary CTAs, headings)
  primaryHover: '#1A1A1A', // Near-black pressed state
  primaryDark: '#000000',  // Deepest brand
  primary500: '#545454',   // Mid gray (secondary icons, gradient mid)
  primary700: '#1F1F1F',   // Charcoal (gradient start)
  primaryLight: '#F2F2F2', // Soft gray tint (icon backgrounds)
  primarySoft: '#F6F6F6',  // Soft fills

  accent: '#276EF1',       // Uber Blue (links, interactive accents)
  accentHover: '#1E54C9',  // Blue pressed
  secondary: '#06C167',    // Uber Green (go / success / confirm)
  secondaryLight: '#E6F8EF',// Green tint
  coral: '#E11900',        // Uber Red (alerts / destructive)

  background: '#FFFFFF',   // App background (Uber is white-first)
  surface: '#FFFFFF',      // Cards, sheets, modals
  surfaceHover: '#F6F6F6', // Pressed / hovered surfaces
  surfaceAlt: '#F6F6F6',   // Tracks, alternate surfaces, filled inputs

  text: '#000000',         // Primary text / headings
  textSecondary: '#6B6B6B',// Body / secondary
  textMuted: '#AFAFAF',    // Placeholders, meta
  textLight: '#AFAFAF',    // Meta, chevrons

  border: '#E2E2E2',       // Default borders
  borderLight: '#EEEEEE',  // Subtle dividers
  borderFocus: '#000000',  // Focused / active border

  error: '#E11900',        // Uber Red
  errorLight: '#FFEFED',
  success: '#06C167',      // Uber Green
  successLight: '#E6F8EF',
  warning: '#FFC043',      // Uber Yellow
  warningLight: '#FFF6E0',
  info: '#276EF1',         // Uber Blue
  infoLight: '#EBF1FE',
};

const paperFonts = {
  ...MD3LightTheme.fonts,
  displayLarge: { ...MD3LightTheme.fonts.displayLarge, fontFamily: 'Poppins_800ExtraBold', fontWeight: '800' as const, letterSpacing: -0.6 },
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
  roundness: 8, // Uber-tight default radius
};

export const colors = palette;

// Minimal gradients (used sparingly — Uber leans on flat black)
export const gradients = {
  brand: [palette.primary700, palette.primary] as [string, string],
  accent: [palette.accent, palette.accentHover] as [string, string],
  admin: [palette.primary700, palette.primary] as [string, string],
};

// 8pt grid spacing
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  screen: 24,
};

// Tight, Uber-style radii
export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 9999,
};

// Whisper-soft, neutral shadows (Uber favors borders over heavy elevation)
export const shadows = {
  none: {
    elevation: 0,
    shadowOpacity: 0,
  },
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6
  },
  xl: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.1,
    shadowRadius: 36,
    elevation: 10
  }
};

export const fonts = {
  poppins: {
    medium: { fontFamily: 'Poppins_500Medium', fontWeight: '500' as const },
    semibold: { fontFamily: 'Poppins_600SemiBold', fontWeight: '600' as const },
    bold: { fontFamily: 'Poppins_700Bold', fontWeight: '700' as const },
    extrabold: { fontFamily: 'Poppins_800ExtraBold', fontWeight: '800' as const },
  },
  questrial: {
    regular: { fontFamily: 'Questrial_400Regular', fontWeight: '400' as const },
  },
};

// Shared layout metrics (safe-area offsets, nav bar sizing)
export const layout = {
  headerTop: 60,
  tabBarHeight: 76,
  contentBottom: 108,
};

// Uber-style typography scale — bold, tight, confident
export const typography = {
  display: { ...fonts.poppins.extrabold, fontSize: 34, lineHeight: 40, letterSpacing: -0.8, color: colors.text },
  title: { ...fonts.poppins.bold, fontSize: 18, lineHeight: 26, letterSpacing: -0.3, color: colors.text },
  h1: { ...fonts.poppins.extrabold, fontSize: 30, lineHeight: 38, letterSpacing: -0.7, color: colors.text },
  h2: { ...fonts.poppins.bold, fontSize: 24, lineHeight: 32, letterSpacing: -0.4, color: colors.text },
  h3: { ...fonts.poppins.semibold, fontSize: 18, lineHeight: 26, letterSpacing: -0.2, color: colors.text },
  subtitle: { ...fonts.poppins.medium, fontSize: 16, lineHeight: 24, color: colors.textSecondary },
  body: { ...fonts.questrial.regular, fontSize: 15, lineHeight: 23, color: colors.textSecondary },
  bodySmall: { ...fonts.questrial.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary },
  label: { ...fonts.poppins.medium, fontSize: 14, lineHeight: 20, color: colors.text },
  labelSmall: { ...fonts.poppins.medium, fontSize: 12, lineHeight: 16, color: colors.textMuted },
  button: { ...fonts.poppins.semibold, fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  number: { ...fonts.poppins.bold, letterSpacing: -0.5, color: colors.text },
};
