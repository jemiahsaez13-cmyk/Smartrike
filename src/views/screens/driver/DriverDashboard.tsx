import React from 'react';
import { View, StyleSheet, Switch } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { useAppSelector, useAppDispatch } from '@/controllers/store';
import { updateDriverStatus } from '@/controllers/slices/driverSlice';
import { useNavigation } from '@react-navigation/native';
import { Button } from '@/views/components/common/Button';
import { Loading } from '@/views/components/common/Loading';

export const DriverDashboard = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<any>();
  const { user } = useAppSelector(state => state.auth);
  const { currentStatus, dailyEarnings, incomingRequests, loading } = useAppSelector(state => state.driver);
  const isOnline = currentStatus === 'online' || currentStatus === 'on-trip';

  const toggleStatus = async () => {
    const newStatus = isOnline ? 'offline' : 'online';
    await dispatch(updateDriverStatus({ driverId: user!.id, status: newStatus }));
  };

  if (loading) return <Loading message="Loading dashboard..." />;

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>Driver Dashboard</Text>
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.row}>
            <Text variant="titleMedium">Status:</Text>
            <View style={styles.statusControl}>
              <Text style={styles.statusText}>{isOnline ? 'Online' : 'Offline'}</Text>
              <Switch value={isOnline} onValueChange={toggleStatus} />
            </View>
          </View>
        </Card.Content>
      </Card>
      <Card style={styles.card}>
        <Card.Title title="Today's Earnings" />
        <Card.Content>
          <Text variant="displaySmall" style={styles.earnings}>₱{dailyEarnings.toFixed(2)}</Text>
        </Card.Content>
      </Card>
      {incomingRequests.length > 0 && (
        <Card style={styles.card}>
          <Card.Title title="Incoming Requests" />
          <Card.Content><Text>{incomingRequests.length} pending</Text></Card.Content>
          <Card.Actions><Button onPress={() => navigation.navigate('BookingRequests')}>View</Button></Card.Actions>
        </Card>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  title: { marginBottom: 20, fontWeight: 'bold' },
  card: { marginBottom: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusControl: { flexDirection: 'row', alignItems: 'center' },
  statusText: { marginRight: 10, fontWeight: 'bold' },
  earnings: { color: '#4CAF50', fontWeight: 'bold', textAlign: 'center' }
});
