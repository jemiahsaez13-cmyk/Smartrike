import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/views/styles/theme';

export const AnalyticsScreen = () => (
  <View style={styles.container}>
    <MaterialCommunityIcons name="chart-box-outline" size={64} color={colors.textLight} style={{ marginBottom: 20 }} />
    <Text style={styles.title}>Analytics Engine</Text>
    <Text style={styles.subtitle}>Detailed historical charts and segmentation will appear here.</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 8 }
});
