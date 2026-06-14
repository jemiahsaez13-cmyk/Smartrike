import { MD3LightTheme } from 'react-native-paper';

const palette = {
  ink: '#102027',
  inkMuted: '#334155',
  slate700: '#364152',
  slate600: '#4B5565',
  slate500: '#697586',
  slate300: '#CDD5DF',
  slate200: '#E3E8EF',
  slate100: '#F1F5F9',
  white: '#FFFFFF',
  fog: '#F6F8F5',
  mist: '#EAF3EF',
  primary900: '#073B3A',
  primary800: '#075E54',
  primary700: '#0E7C66',
  primary100: '#DDF7EF',
  primary50: '#F0FCF8',
  cyan700: '#137C8B',
  cyan50: '#E8F8FA',
  saffron600: '#D38B00',
  saffron500: '#F4B740',
  saffron50: '#FFF7E3',
  coral600: '#D94836',
  coral50: '#FFF1EE',
  violet700: '#6750A4',
  violet50: '#F2EEFF',
  red600: '#C9362C',
  red50: '#FFF1F0',
  green700: '#167A4A',
  green50: '#EAF8EF',
};

const paperFonts = {
  ...MD3LightTheme.fonts,
  displayLarge: { ...MD3LightTheme.fonts.displayLarge, fontFamily: 'Poppins_800ExtraBold', fontWeight: '800' as const },
  displayMedium: { ...MD3LightTheme.fonts.displayMedium, fontFamily: 'Poppins_800ExtraBold', fontWeight: '800' as const },
  displaySmall: { ...MD3LightTheme.fonts.displaySmall, fontFamily: 'Poppins_700Bold', fontWeight: '700' as const },
  headlineLarge: { ...MD3LightTheme.fonts.headlineLarge, fontFamily: 'Poppins_700Bold', fontWeight: '700' as const },
  headlineMedium: { ...MD3LightTheme.fonts.headlineMedium, fontFamily: 'Poppins_700Bold', fontWeight: '700' as const },
  headlineSmall: { ...MD3LightTheme.fonts.headlineSmall, fontFamily: 'Poppins_600SemiBold', fontWeight: '600' as const },
  titleLarge: { ...MD3LightTheme.fonts.titleLarge, fontFamily: 'Poppins_600SemiBold', fontWeight: '600' as const },
  titleMedium: { ...MD3LightTheme.fonts.titleMedium, fontFamily: 'Poppins_600SemiBold', fontWeight: '600' as const },
  titleSmall: { ...MD3LightTheme.fonts.titleSmall, fontFamily: 'Poppins_600SemiBold', fontWeight: '600' as const },
  labelLarge: { ...MD3LightTheme.fonts.labelLarge, fontFamily: 'Poppins_600SemiBold', fontWeight: '600' as const },
  labelMedium: { ...MD3LightTheme.fonts.labelMedium, fontFamily: 'Poppins_600SemiBold', fontWeight: '600' as const },
  labelSmall: { ...MD3LightTheme.fonts.labelSmall, fontFamily: 'Poppins_600SemiBold', fontWeight: '600' as const },
  bodyLarge: { ...MD3LightTheme.fonts.bodyLarge, fontFamily: 'Questrial_400Regular', fontWeight: '400' as const },
  bodyMedium: { ...MD3LightTheme.fonts.bodyMedium, fontFamily: 'Questrial_400Regular', fontWeight: '400' as const },
  bodySmall: { ...MD3LightTheme.fonts.bodySmall, fontFamily: 'Questrial_400Regular', fontWeight: '400' as const },
};

export const theme = {
  ...MD3LightTheme,
  fonts: paperFonts,
  colors: {
    ...MD3LightTheme.colors,
    primary: palette.primary700,
    onPrimary: palette.white,
    primaryContainer: palette.primary100,
    onPrimaryContainer: palette.primary900,
    secondary: palette.cyan700,
    onSecondary: palette.white,
    secondaryContainer: palette.cyan50,
    tertiary: palette.saffron500,
    error: palette.red600,
    errorContainer: palette.red50,
    background: palette.fog,
    surface: palette.white,
    surfaceVariant: palette.slate100,
    outline: palette.slate200,
    onSurface: palette.ink,
    onSurfaceVariant: palette.slate600,
  },
  roundness: 10,
};

export const colors = {
  primary: palette.primary700,
  primaryDark: palette.primary900,
  primaryMid: palette.primary800,
  primaryLight: palette.primary100,
  primarySoft: palette.primary50,
  secondary: palette.cyan700,
  secondaryLight: palette.cyan50,
  accent: palette.saffron500,
  accentDark: palette.saffron600,
  accentLight: palette.saffron50,
  violet: palette.violet700,
  violetLight: palette.violet50,
  coral: palette.coral600,
  coralLight: palette.coral50,
  background: palette.fog,
  surface: palette.white,
  surfaceRaised: '#FBFCFB',
  surfaceAlt: palette.slate100,
  text: palette.ink,
  textSecondary: palette.slate600,
  textLight: palette.slate500,
  border: palette.slate200,
  borderStrong: palette.slate300,
  borderLight: palette.slate100,
  error: palette.red600,
  errorLight: palette.red50,
  success: palette.green700,
  successLight: palette.green50,
  warning: palette.saffron600,
  warningLight: palette.saffron50,
  info: palette.cyan700,
  infoLight: palette.cyan50,
  glass: 'rgba(255, 255, 255, 0.94)',
  scrim: 'rgba(16, 32, 39, 0.54)',
};

export const gradients = {
  brand: [colors.primaryDark, colors.primary, colors.accent] as [string, string, string],
  action: [colors.primary, colors.secondary] as [string, string],
  calm: [colors.primarySoft, colors.secondaryLight] as [string, string],
  admin: [colors.text, colors.violet, colors.secondary] as [string, string, string],
  warning: [colors.warningLight, '#FFE8B3'] as [string, string],
  emergency: [colors.coral, colors.error] as [string, string],
  offline: [palette.slate700, colors.text] as [string, string],
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48
};

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
};

export const shadows = {
  sm: {
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2
  },
  md: {
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4
  },
  lg: {
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 20,
    elevation: 8
  },
  xl: {
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 12
  }
};

export const fonts = {
  poppins: {
    light: { fontFamily: 'Poppins_400Regular', fontWeight: '400' as const },
    medium: { fontFamily: 'Poppins_500Medium', fontWeight: '500' as const },
    semibold: { fontFamily: 'Poppins_600SemiBold', fontWeight: '600' as const },
    bold: { fontFamily: 'Poppins_700Bold', fontWeight: '700' as const },
    extrabold: { fontFamily: 'Poppins_800ExtraBold', fontWeight: '800' as const },
  },
  questrial: {
    regular: { fontFamily: 'Questrial_400Regular', fontWeight: '400' as const },
  },
};

export const typography = {
  display: { ...fonts.poppins.extrabold, letterSpacing: 0 },
  title: { ...fonts.poppins.bold, letterSpacing: 0 },
  subtitle: { ...fonts.poppins.semibold, letterSpacing: 0 },
  body: { ...fonts.questrial.regular, letterSpacing: 0 },
  label: { ...fonts.poppins.semibold, letterSpacing: 0 },
  number: { ...fonts.poppins.bold, letterSpacing: 0 },
};

export const motion = {
  fast: 160,
  base: 260,
  slow: 380,
  easeOut: 'ease-out',
};

export const layout = {
  headerTop: 60,
  tabBarHeight: 76,
  contentBottom: 108,
};
