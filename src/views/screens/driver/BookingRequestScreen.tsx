import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

export const BookingRequestScreen = () => (
  <View style={styles.container}>
    <Text variant="headlineMedium">Booking Requests</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center' }
});
