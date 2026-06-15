export const BOAC_CENTER = {
  latitude: 13.4452,
  longitude: 121.8401,
};

export const MAP_DELTA = {
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export const FARE = {
  BASE: 50,
  PER_KM: 15,
  MINIMUM: 50,
  PEAK_MULTIPLIER: 1.5,
  PEAK_START_HOUR: 6.5,
  PEAK_END_HOUR: 9,
  PEAK_START_HOUR_PM: 17,
  PEAK_END_HOUR_PM: 19,
};

export const DRIVER_SEARCH_RADIUS_KM = 5;
export const DRIVER_ARRIVAL_THRESHOLD_METERS = 50;
export const BOOKING_TIMEOUT_SECONDS = 30;
export const LOCATION_UPDATE_INTERVAL_MS = 5000;
export const ETA_UPDATE_INTERVAL_MS = 30000;

export const TODA_NAME = 'FEDTODAB';
export const SERVICE_AREA = 'Boac, Marinduque';

export const POPULAR_PLACES = [
  { id: '1', name: 'Boac Public Market', address: 'Boac town center', lat: 13.4452, lng: 121.8401 },
  { id: '2', name: 'Marinduque State College', address: 'Tanza, Boac', lat: 13.4101, lng: 121.8456 },
  { id: '3', name: 'Boac Cathedral', address: 'National Highway, Boac', lat: 13.4477, lng: 121.8389 },
  { id: '4', name: 'Provincial Hospital', address: 'Emergency & outpatient', lat: 13.4419, lng: 121.8442 },
  { id: '5', name: 'Cawit Port', address: 'Cawit, Boac', lat: 13.5247, lng: 121.8665 },
];

export const PAYMENT_METHODS = ['cash', 'gcash', 'paymaya'] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];

export const BOOKING_STATUSES = ['pending', 'accepted', 'in-transit', 'completed', 'cancelled'] as const;
export type BookingStatus = typeof BOOKING_STATUSES[number];

export const USER_TYPES = ['passenger', 'driver', 'admin'] as const;
export type UserType = typeof USER_TYPES[number];

export const DRIVER_GOAL_DAILY = 800;
export const DRIVER_RATING_DEFAULT = 4.8;

export const NOTIFICATION_TYPES = {
  BOOKING_REQUEST: 'booking_request',
  BOOKING_ACCEPTED: 'booking_accepted',
  BOOKING_COMPLETED: 'booking_completed',
  BOOKING_CANCELLED: 'booking_cancelled',
  DRIVER_ARRIVED: 'driver_arrived',
  TRIP_STARTED: 'trip_started',
  PAYMENT_RECEIVED: 'payment_received',
  FRANCHISE_STATUS: 'franchise_status',
  SYSTEM_ALERT: 'system_alert',
} as const;
