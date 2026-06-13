import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { Loading } from '@/views/components/common/Loading';

export const TripHistoryScreen = () => {
  const [loading] = useState(false);

  if (loading) return <Loading message="Loading trips..." />;

  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>Trip History</Text>
      <Text style={styles.empty}>No trips yet</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { marginBottom: 20, fontWeight: 'bold' },
  empty: { textAlign: 'center', color: '#666', marginTop: 50 }
});
