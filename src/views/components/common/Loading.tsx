import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';

interface LoadingProps {
  message?: string;
  showImage?: boolean;
}

export const Loading: React.FC<LoadingProps> = ({ message = 'Loading...', showImage = false }) => (
  <View style={styles.container}>
    <ActivityIndicator size="large" color="#2196F3" />
    {message && <Text style={styles.text}>{message}</Text>}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fff' },
  text: { marginTop: 15, textAlign: 'center', color: '#666', fontSize: 16 }
});
