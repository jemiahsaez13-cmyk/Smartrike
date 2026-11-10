export const BOAC_CENTER = {
  latitude: 13.4452,
  longitude: 121.8401,
};

export const MAP_DELTA = {
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

// Official Boac, Marinduque LGU tricycle fare matrix.
//   • ₱120 base fare for the first kilometer
//   • ₱10 for every succeeding kilometer
//   • Distance is rounded UP to the next whole kilometer
//   • No peak-hour surcharge (the published matrix has none)
// Formula:  fare = 120 + (ceil(distanceKm) - 1) × 10
export const FARE = {
  BASE: 120,
  PER_KM: 10,
  MINIMUM: 120,
  PEAK_MULTIPLIER: 1, // matrix has no peak surcharge
  PEAK_HOURS_ENABLED: false,
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
        body: 'Fares follow the official Boac LGU tricycle matrix: a ₱120 base fare for the first kilometer plus ₱10 for every succeeding kilometer, with the distance rounded up to the next whole kilometer. You agree to pay the correct fare for completed trips using cash or online payment.',
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
    a: 'Fares follow the official Boac LGU tricycle matrix: ₱120 for the first kilometer, plus ₱10 for every succeeding kilometer, with the distance rounded up to the next whole kilometer. For example, a 5 km trip is ₱160. There is no peak-hour surcharge.',
  },
  {
    q: 'What payment methods are accepted?',
    a: 'You can pay with Cash or Online payment. Choose your method before you confirm the ride.',
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

// A popular destination passengers can tap to book. These are now managed
// entirely by admins in the database (public.popular_places, migration 018) —
// there is no hardcoded list. This interface is the normalized shape the UI
// and PopularPlaceService work with.
export interface PopularPlace {
  id: string;
  name: string;
  address: string;
  category: string;
  icon: string;
  lat: number;
  lng: number;
  image: string;
  details?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export const PAYMENT_METHODS = ['cash', 'online'] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];

export const BOOKING_STATUSES = ['pending', 'accepted', 'in-transit', 'completed', 'cancelled'] as const;
export type BookingStatus = typeof BOOKING_STATUSES[number];

export const USER_TYPES = ['passenger', 'driver', 'admin'] as const;
export type UserType = typeof USER_TYPES[number];

export const DRIVER_GOAL_DAILY = 800;

// Each driver may set their own daily quota (users.daily_quota); fall back to
// the TODA default when they have not.
export const getDriverDailyGoal = (user: any): number => {
  const quota = Number(user?.daily_quota);
  return Number.isFinite(quota) && quota > 0 ? quota : DRIVER_GOAL_DAILY;
};

// Ride requests older than this are treated as stale (the rider has likely
// given up or closed the app) and are hidden from drivers' incoming queue.
export const REQUEST_FRESHNESS_MINUTES = 20;
export const DRIVER_RATING_DEFAULT = 4.8;

// Reasons a passenger picks when cancelling. The server decides validity from
// the same list (migration 077 is_valid_cancellation_reason); anything else,
// including "Other", counts as a cancellation without a valid reason.
export const CANCELLATION_REASONS = [
  { label: 'Driver is taking too long', valid: true },
  { label: 'Driver asked me to cancel', valid: true },
  { label: 'Emergency', valid: true },
  { label: 'Wrong pickup or drop-off location', valid: true },
  { label: 'Changed my mind', valid: false },
  { label: 'Found another ride', valid: false },
  { label: 'Other', valid: false },
] as const;

/** Reason the app records when it closes a search nobody accepted in time. */
export const NO_DRIVER_CANCELLATION_REASON = 'No driver accepted in time';

// Three confirmed violations (or invalid cancellations) within a rolling
// 7-day window flag the user for admin review. Nothing is restricted
// automatically; the admin decides.
export const CONDUCT_FLAG_THRESHOLD = 3;
export const CONDUCT_WINDOW_DAYS = 7;

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
  VIOLATION: 'violation',
} as const;

// ─── Passenger fare discounts (D4, migration 080) ─────────────────────────────
// 20% off one passenger's share of the fare: senior citizens (RA 9994), PWD
// (RA 10754) and students (RA 11314). The driver checks the ID at pickup.
// Keep in step with enforce_booking_insert in migration 080.
export type BookingPassengerType = 'regular' | 'senior' | 'pwd' | 'student';

export const PASSENGER_DISCOUNT_PCT: Record<BookingPassengerType, number> = {
  regular: 0,
  senior: 20,
  pwd: 20,
  student: 20,
};

export const PASSENGER_TYPE_LABEL: Record<BookingPassengerType, string> = {
  regular: 'Regular',
  senior: 'Senior Citizen',
  pwd: 'PWD',
  student: 'Student',
};

// Migration 089: senior citizen, PWD and student show the physical ID at
// pickup (no photo is uploaded), and the discount only comes off once the
// driver who accepted the ride approves it. Until then the regular fare applies.
export const DISCOUNT_NEEDS_DRIVER_APPROVAL: BookingPassengerType[] = ['senior', 'pwd', 'student'];

/** What the passenger's ID is called: "senior citizen ID", "PWD ID", "school ID". */
export const DISCOUNT_ID_NAME: Record<BookingPassengerType, string> = {
  regular: 'ID',
  senior: 'senior citizen ID',
  pwd: 'PWD ID',
  student: 'school ID',
};

export const discountNeedsApproval = (type: BookingPassengerType | null | undefined): boolean =>
  !!type && DISCOUNT_NEEDS_DRIVER_APPROVAL.includes(type);

export type DiscountStatus = 'pending' | 'approved' | 'rejected';

// ─── Baggage declaration (D3, migration 088) ──────────────────────────────────
// The passenger declares how many bags and the size of the biggest one so the
// driver knows before accepting. Information only: no extra charge.
export type BaggageSize = 'small' | 'medium' | 'large';

export const MAX_BAGGAGE_COUNT = 10;

export const BAGGAGE_SIZES: BaggageSize[] = ['small', 'medium', 'large'];

export const BAGGAGE_SIZE_LABEL: Record<BaggageSize, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
};

export const BAGGAGE_SIZE_HINT: Record<BaggageSize, string> = {
  small: 'Backpack or handbag. Fits on your lap.',
  medium: 'Box, grocery bags or a small suitcase. Fits at your feet.',
  large: 'Rice sack, big box or luggage. Needs space at the back or on top.',
};

/** "2 bags · biggest is Large", or null when nothing was declared. */
export const baggageSummary = (
  booking: { baggage_count?: number | null; baggage_size?: BaggageSize | string | null } | null | undefined
): string | null => {
  const count = Math.floor(Number(booking?.baggage_count ?? 0));
  const size = booking?.baggage_size as BaggageSize | null | undefined;
  if (!(count > 0) || !size || !BAGGAGE_SIZE_LABEL[size]) return null;
  return `${count} bag${count === 1 ? '' : 's'} · ${count === 1 ? '' : 'biggest is '}${BAGGAGE_SIZE_LABEL[size]}`;
};
