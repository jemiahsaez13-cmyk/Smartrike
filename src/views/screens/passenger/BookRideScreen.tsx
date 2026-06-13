import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Alert, ScrollView, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Text, Surface, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/controllers/hooks/useAuth';
import { useBooking } from '@/controllers/hooks/useBooking';
import { useLocation } from '@/controllers/hooks/useLocation';
import { useNavigation } from '@react-navigation/native';
import { Button } from '@/views/components/common/Button';
import { Input } from '@/views/components/common/Input';
import { Loading } from '@/views/components/common/Loading';
import { colors, spacing, shadows } from '@/views/styles/theme';
import { LinearGradient } from 'expo-linear-gradient';

const { height } = Dimensions.get('window');

export const BookRideScreen = () => {
  const { user } = useAuth();
  const { bookRide, loading } = useBooking();
  const { currentLocation, getLocation } = useLocation();
  const navigation = useNavigation<any>();
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [loadingLocation, setLoadingLocation] = useState(true);

  // Animations
  const sheetAnim = useRef(new Animated.Value(height * 0.4)).current;

  useEffect(() => {
    getLocation().then(() => {
      setLoadingLocation(false);
      Animated.spring(sheetAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }).start();
    });
  }, []);

  useEffect(() => {
    if (currentLocation) setPickupAddress(currentLocation.address || 'Current Location');
  }, [currentLocation]);

  const handleBooking = async () => {
    if (!currentLocation || !dropoffAddress) {
      Alert.alert('Error', 'Please enter destination');
      return;
    }
    try {
      await bookRide(user!.id, currentLocation, {
        latitude: 13.45, longitude: 121.85, address: dropoffAddress
      });
      navigation.navigate('ConfirmBooking');
    } catch (error) {
      Alert.alert('Failed', 'Unable to create booking');
    }
  };

  if (loadingLocation) return <Loading message="Finding your location..." />;

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        <LinearGradient colors={['rgba(0,0,0,0.1)', 'transparent']} style={styles.mapTopGradient} />
        <View style={styles.mapPlaceholder}>
          <MaterialCommunityIcons name="map-outline" size={80} color={colors.textLight} style={{ opacity: 0.5 }} />
          <Text style={styles.mapHint}>Interactive Map View</Text>
        </View>
        
        <IconButton 
          icon="chevron-left" 
          mode="contained"
          containerColor={colors.surface}
          iconColor={colors.text}
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        />

        <View style={styles.centerPinContainer}>
          <Surface style={styles.pinShadow} elevation={4} />
          <View style={styles.pinContainer}>
            <View style={styles.pinCircle}>
              <View style={styles.pinInner} />
            </View>
            <View style={styles.pinTail} />
          </View>
        </View>
      </View>

      <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetAnim }] }]}>
        <View style={styles.handle} />
        
        <Text style={styles.sheetTitle}>Where are you going?</Text>

        <View style={styles.locationContainer}>
          <View style={styles.pathGraphic}>
            <View style={[styles.pathDot, { backgroundColor: colors.primary }]} />
            <View style={styles.pathLine} />
            <View style={[styles.pathDot, { backgroundColor: colors.accent }]} />
          </View>
          
          <View style={styles.inputs}>
            <TouchableOpacity style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>PICKUP FROM</Text>
              <Text style={styles.inputValue} numberOfLines={1}>{pickupAddress}</Text>
            </TouchableOpacity>

            <View style={styles.inputDivider} />

            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>DROP OFF TO</Text>
              <Input
                value={dropoffAddress}
                onChangeText={setDropoffAddress}
                placeholder="Search destination..."
                mode="flat"
                style={styles.actualInput}
                containerStyle={styles.inputContainerStyle}
                placeholderTextColor={colors.textLight}
              />
            </View>
          </View>
        </View>

        <Surface style={styles.fareCard} elevation={1}>
          <View style={styles.fareInfo}>
            <View style={styles.fareIconBox}>
              <MaterialCommunityIcons name="motorbike" size={28} color="#fff" />
            </View>
            <View>
              <Text style={styles.fareType}>Standard Tricycle</Text>
              <Text style={styles.fareEta}>~8 min away</Text>
            </View>
          </View>
          <Text style={styles.farePrice}>₱45.00</Text>
        </Surface>

        <Button
          variant="primary"
          onPress={handleBooking}
          disabled={!dropoffAddress || loading}
          loading={loading}
          style={styles.bookBtn}
        >
          Confirm Trip
        </Button>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  mapContainer: { flex: 1, backgroundColor: '#E2E8F0', position: 'relative' },
  mapTopGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 100, zIndex: 1 },
  mapPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  mapHint: { fontSize: 14, color: colors.textLight, marginTop: 8, fontWeight: '600' },
  backBtn: { position: 'absolute', top: 50, left: 20, zIndex: 2, ...shadows.md },
  centerPinContainer: { position: 'absolute', top: '45%', left: '50%', marginLeft: -15, marginTop: -40, alignItems: 'center' },
  pinContainer: { alignItems: 'center' },
  pinCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary, borderWidth: 4, borderColor: '#fff', justifyContent: 'center', alignItems: 'center', ...shadows.md },
  pinInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  pinTail: { width: 4, height: 15, backgroundColor: colors.primary, marginTop: -2 },
  pinShadow: { width: 10, height: 4, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.2)', marginTop: 2 },
  sheet: { 
    position: 'absolute', 
    bottom: 0, 
    width: '100%', 
    backgroundColor: colors.surface, 
    borderTopLeftRadius: 32, 
    borderTopRightRadius: 32, 
    padding: spacing.lg, 
    paddingTop: spacing.md,
    ...shadows.xl
  },
  handle: { width: 40, height: 5, backgroundColor: colors.borderLight, borderRadius: 3, alignSelf: 'center', marginBottom: spacing.lg },
  sheetTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: spacing.lg },
  locationContainer: { 
    flexDirection: 'row', 
    backgroundColor: colors.background, 
    borderRadius: 20, 
    padding: spacing.md, 
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight
  },
  pathGraphic: { alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, marginRight: spacing.md },
  pathDot: { width: 10, height: 10, borderRadius: 5 },
  pathLine: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 4 },
  inputs: { flex: 1 },
  inputWrapper: { paddingVertical: 4 },
  inputLabel: { fontSize: 10, fontWeight: '800', color: colors.textLight, letterSpacing: 1, marginBottom: 4 },
  inputValue: { fontSize: 15, fontWeight: '600', color: colors.text },
  inputDivider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 8 },
  actualInput: { backgroundColor: 'transparent', height: 40, paddingHorizontal: 0, margin: 0, fontSize: 15, fontWeight: '600' },
  inputContainerStyle: { marginBottom: 0 },
  fareCard: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: spacing.md, 
    backgroundColor: '#F0FDF4', 
    borderRadius: 16, 
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: '#DCFCE7'
  },
  fareInfo: { flexDirection: 'row', alignItems: 'center' },
  fareIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  fareType: { fontSize: 16, fontWeight: '700', color: colors.text },
  fareEta: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  farePrice: { fontSize: 20, fontWeight: '800', color: colors.text },
  bookBtn: { borderRadius: 16 }
});
