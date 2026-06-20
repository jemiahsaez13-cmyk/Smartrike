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

// ── Support / contact details (FEDTODAB dispatch office) ─────────────────────
export const SUPPORT = {
  hotline: '+63 912 345 6789',
  hotlineDial: '+639123456789',
  email: 'support@smarttrike.ph',
  office: 'FEDTODAB Dispatch Office',
  address: 'Boac Public Market, Boac, Marinduque',
  hours: 'Mon–Sun · 5:00 AM – 10:00 PM',
};

// Full legal documents shown in the Legal & Support section.
export const LEGAL = {
  privacy: {
    title: 'Privacy Policy',
    updated: 'Last updated: January 2026',
    sections: [
      {
        heading: 'Information We Collect',
        body: 'Smart Trike collects the information you provide when you create an account (name, email, phone, and—for drivers—license, vehicle, TODA, and payout details), along with your location while booking or driving, your trip history, and the documents you submit for an MTOP franchise.',
      },
      {
        heading: 'How We Use Your Information',
        body: 'We use your information to match passengers with nearby drivers, calculate fares, process franchise applications, keep trips accountable through ratings and records, and contact you about your bookings or account.',
      },
      {
        heading: 'Location Data',
        body: 'Your location is used only while the app is providing a service—matching you with a driver, navigating a trip, or showing nearby tricycles. You can stop sharing location by signing out, though core booking features require it.',
      },
      {
        heading: 'Data Sharing',
        body: 'We share only the details needed to complete a trip—for example, a driver sees a passenger’s pickup point. FEDTODAB administrators can review franchise documents. We never sell your personal data to third parties.',
      },
      {
        heading: 'Data Security & Retention',
        body: 'Your data is stored securely and kept only as long as needed to provide the service and meet local transport requirements. You may request correction or deletion of your account data by contacting support.',
      },
      {
        heading: 'Contact',
        body: 'For privacy questions or data requests, reach the FEDTODAB Dispatch Office or email support@smarttrike.ph.',
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    updated: 'Last updated: January 2026',
    sections: [
      {
        heading: 'Acceptance of Terms',
        body: 'By creating an account or using Smart Trike, you agree to these Terms and to follow FEDTODAB and local government (LGU) transport rules in Boac, Marinduque.',
      },
      {
        heading: 'Using the Service',
        body: 'Smart Trike connects passengers with FEDTODAB tricycle drivers. You agree to provide accurate account information, ride or drive responsibly, and not misuse the app, harass other users, or attempt to defraud the fare system.',
      },
      {
        heading: 'Fares & Payments',
        body: 'Fares follow the published computation: a base fare plus a per-kilometer rate, with a peak-hour multiplier where applicable. You agree to pay the correct fare for completed trips using cash, GCash, or PayMaya.',
      },
      {
        heading: 'Driver Franchises (MTOP)',
        body: 'Drivers are responsible for submitting genuine, valid documents for franchise applications and renewals. Submitting false documents may result in rejection and account suspension. Approval and issuance remain at the discretion of the LGU and FEDTODAB administrators.',
      },
      {
        heading: 'Cancellations & Conduct',
        body: 'Bookings may be cancelled while pending or before pickup. Repeated last-minute cancellations, no-shows, or unsafe conduct may lead to warnings or account suspension.',
      },
      {
        heading: 'Limitation of Liability',
        body: 'Smart Trike is a booking platform for the FEDTODAB community. While we work to keep rides safe and accountable, trips are carried out by independent drivers, and we are not liable for events beyond our reasonable control.',
      },
      {
        heading: 'Changes to These Terms',
        body: 'We may update these Terms as the service evolves. Continued use of Smart Trike after an update means you accept the revised Terms.',
      },
    ],
  },
};

// Frequently asked questions shown in Help & Support.
export const FAQS = [
  {
    q: 'How do I book a tricycle ride?',
    a: 'Open the Home tab, set your pickup and destination, then tap Book Ride. The nearest available FEDTODAB driver will be matched to you and you can track them on the map.',
  },
  {
    q: 'How is my fare calculated?',
    a: 'Fares start at a ₱50 base plus ₱15 per kilometer. During peak hours (6:30–9:00 AM and 5:00–7:00 PM) a 1.5× multiplier applies. The minimum fare is ₱50.',
  },
  {
    q: 'What payment methods are accepted?',
    a: 'You can pay with Cash, GCash, or PayMaya. Choose your method on the confirmation screen before the trip starts.',
  },
  {
    q: 'How do I cancel a booking?',
    a: 'While a request is still pending or your driver is on the way, open the trip and tap Cancel. Frequent last-minute cancellations may affect your account.',
  },
  {
    q: 'I think I was overcharged. What do I do?',
    a: 'Open the trip in your Activity tab to see the fare breakdown. If something looks wrong, tap “Report a Problem” below or contact the dispatch office with your trip details.',
  },
  {
    q: 'How do drivers apply for an MTOP franchise?',
    a: 'Drivers can open the MTOP tab, upload the required documents, and submit. The FEDTODAB admin reviews each document before approving and issuing the franchise.',
  },
  {
    q: 'How do I update my profile or payout account?',
    a: 'Go to the Account tab and tap Edit Profile. There you can change your photo, name, phone, and—if you are a driver—your vehicle and payout account details.',
  },
];

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
