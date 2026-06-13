import React, { useEffect, useState } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { PaperProvider } from 'react-native-paper';
import * as Font from 'expo-font';
import { store } from './src/controllers/store';
import { AppNavigator } from './src/views/navigation/AppNavigator';
import { theme } from './src/views/styles/theme';

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    const loadFonts = async () => {
      try {
        // Try to load custom fonts if available
        const fontAssets: { [key: string]: number } = {};
        try {
          fontAssets['Poppins_400Regular'] = require('./assets/fonts/Poppins-Regular.ttf');
          fontAssets['Poppins_500Medium'] = require('./assets/fonts/Poppins-Medium.ttf');
          fontAssets['Poppins_600SemiBold'] = require('./assets/fonts/Poppins-SemiBold.ttf');
          fontAssets['Poppins_700Bold'] = require('./assets/fonts/Poppins-Bold.ttf');
          fontAssets['Poppins_800ExtraBold'] = require('./assets/fonts/Poppins-ExtraBold.ttf');
          fontAssets['Questrial_400Regular'] = require('./assets/fonts/Questrial-Regular.ttf');
          await Font.loadAsync(fontAssets);
        } catch (e) {
          console.warn('Custom fonts not available, using system fonts');
        }
      } catch (error) {
        console.warn('Font loading error:', error);
      } finally {
        setFontsLoaded(true);
      }
    };

    loadFonts();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ReduxProvider store={store}>
      <PaperProvider theme={theme}>
        <AppNavigator />
      </PaperProvider>
    </ReduxProvider>
  );
}
