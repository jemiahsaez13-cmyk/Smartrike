import { MD3LightTheme } from 'react-native-paper';

export const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#1E90FF', // Dodger Blue
    secondary: '#00C9FF', // Light Cyan
    tertiary: '#FF6B6B', // Coral Red
    error: '#FF6B6B', // Coral Red
    background: '#F0F7FF', // Light Blue-White
    surface: '#FFFFFF',
    outline: '#D4E9FF', // Light Blue
  },
  roundness: 16,
};

export const colors = {
  primary: '#1E90FF', // Dodger Blue
  primaryDark: '#1873CC', // Darker Blue
  primaryLight: '#E3F2FD', // Very Light Blue
  secondary: '#00C9FF', // Light Cyan
  secondaryLight: '#E0F7FF', // Very Light Cyan
  accent: '#FF6B6B', // Coral Red
  accentLight: '#FFE5E5', // Light Coral
  background: '#F0F7FF', // Light Blue-White
  surface: '#FFFFFF',
  text: '#0D1B2A', // Dark Navy
  textSecondary: '#334E7E', // Medium Blue-Gray
  textLight: '#7E8FA3', // Light Blue-Gray
  border: '#D4E9FF', // Light Blue
  borderLight: '#E8F3FF', // Very Light Blue
  error: '#FF6B6B',
  success: '#10B981',
  warning: '#FFA500',
  info: '#1E90FF',
  glass: 'rgba(255, 255, 255, 0.9)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48
};

export const shadows = {
  sm: {
    shadowColor: '#1E90FF',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2
  },
  md: {
    shadowColor: '#1E90FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4
  },
  lg: {
    shadowColor: '#1E90FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8
  },
  xl: {
    shadowColor: '#1E90FF',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 40,
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
