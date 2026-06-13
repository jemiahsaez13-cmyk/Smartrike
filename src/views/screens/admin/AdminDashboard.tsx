import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { Button } from '@/views/components/common/Button';
import { useNavigation } from '@react-navigation/native';
import { Loading } from '@/views/components/common/Loading';

export const AdminDashboard = () => {
  const navigation = useNavigation<any>();
  const [loading] = React.useState(false);

  if (loading) return <Loading message="Loading admin panel..." />;

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>Admin Dashboard</Text>
      <Card style={styles.card}>
        <Card.Title title="User Management" />
        <Card.Content><Text>Manage all users</Text></Card.Content>
        <Card.Actions><Button onPress={() => navigation.navigate('UserManagement')}>View</Button></Card.Actions>
      </Card>
      <Card style={styles.card}>
        <Card.Title title="Booking Monitor" />
        <Card.Content><Text>Monitor active bookings</Text></Card.Content>
        <Card.Actions><Button onPress={() => navigation.navigate('BookingMonitor')}>View</Button></Card.Actions>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  title: { marginBottom: 20, fontWeight: 'bold' },
  card: { marginBottom: 15 }
});
