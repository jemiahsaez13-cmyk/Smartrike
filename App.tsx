import React from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { PaperProvider } from 'react-native-paper';
import { store } from './src/controllers/store';
import { AppNavigator } from './src/views/navigation/AppNavigator';
import { theme } from './src/views/styles/theme';

export default function App() {
  return (
    <ReduxProvider store={store}>
      <PaperProvider theme={theme}>
        <AppNavigator />
      </PaperProvider>
    </ReduxProvider>
  );
}
