import { MD3LightTheme } from 'react-native-paper';

export const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#1E88E5',
    secondary: '#26C6DA',
    tertiary: '#FFA726',
    error: '#EF5350',
    background: '#F8FAFC',
    surface: '#FFFFFF'
  }
};

export const colors = {
  primary: '#1E88E5',
  primaryDark: '#1565C0',
  primaryLight: '#E3F2FD',
  secondary: '#26C6DA',
  secondaryLight: '#E0F7FA',
  accent: '#FFA726',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  text: '#1A202C',
  textSecondary: '#64748B',
  textLight: '#94A3B8',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  error: '#EF5350',
  success: '#66BB6A',
  warning: '#FFA726',
  info: '#42A5F5'
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8
  }
};
