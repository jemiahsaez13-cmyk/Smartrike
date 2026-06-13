# Smart Trike: A Mobile TODA Booking System
## System Features & Breakdown

### Project Overview
**System Name:** Smart Trike: A Mobile TODA Booking System for Students and Commuters in Boac, Marinduque

**Purpose:** Develop a digital platform to enable passengers to book tricycle rides via smartphones, while allowing registered FEDTODAB drivers to receive and manage booking requests in real time.

**Target Users:** Students, commuters, tricycle drivers, and FEDTODAB administrators in Boac, Marinduque

---

## Core System Modules

### Module 1: Passenger Booking Module
Manages the booking and dispatching of tricycle rides, addressing long waiting times, lack of available drivers, and unorganized queuing system.

#### Sub-modules:
1. **User Registration and Authentication Module**
   - Users can register with email or phone number
   - Secure login and authentication
   - Social media login options
   - Account management and profile updates
   - Password recovery functionality

2. **Booking Request Module**
   - Passengers input pick-up location
   - Passengers input drop-off destination
   - Request immediate or scheduled rides
   - Real-time booking submission
   - Booking history and tracking

3. **GPS Location Tracking Module**
   - Real-time detection of user location
   - Display current position on interactive map
   - Show nearby available drivers
   - Track driver's real-time movement to pickup point
   - Accurate navigation for both passenger and driver

4. **Driver Notification and Response Module**
   - Real-time notification alerts to drivers
   - Display passenger details and pickup location
   - Allow drivers to accept or reject requests
   - Notify multiple drivers and assign to first acceptor
   - Push notifications for booking updates

5. **Driver Assignment and Dispatch Module**
   - Automatic assignment based on proximity
   - Respect TODA queuing system for fair distribution
   - Optimize driver allocation to reduce waiting time
   - Balance trip distribution among drivers
   - Handle alternative driver assignment if primary declines

6. **Booking Confirmation Module**
   - Send confirmation to both passenger and driver
   - Display trip details (date, time, route)
   - Show driver information (name, contact, photo)
   - Display vehicle details (plate number, type)
   - Estimated arrival time and fare

7. **Fare Calculation Module**
   - Compute fare based on LGU-approved fare matrix
   - Display estimated fare before confirming booking
   - Transparent pricing structure
   - Account for distance and base fare
   - Show fare breakdown to passengers

8. **Trip Monitoring and Completion Module**
   - Real-time tracking of trip progress
   - Driver's current location display
   - Estimated time to arrival
   - Mark rides as completed
   - Allow feedback and ratings after trip completion

---

### Module 2: Driver Module
Enables drivers to efficiently manage incoming booking requests and provide transportation services.

#### Features:
- **Real-time Booking Notifications**
  - Instant alerts for new passenger requests
  - Sound and vibration notifications
  - Booking request details display

- **Request Management**
  - Accept or reject booking requests
  - View passenger details and destination
  - Track passenger location in real-time

- **GPS-Based Navigation**
  - Route guidance to passenger pickup
  - Turn-by-turn navigation
  - Estimated travel time calculations
  - Traffic awareness features

- **Driver Income Tracking**
  - Daily earnings summary
  - Trip-by-trip earnings breakdown
  - Weekly and monthly reports
  - Payment history

- **Driver Status Management**
  - Online/offline status toggle
  - Availability indicator
  - Current ride status

- **Communication Features**
  - Direct messaging with passengers
  - Call integration
  - Ride sharing updates

---

### Module 3: Administrator Module
Responsible for overseeing and managing the overall operation of the Smart Trike system.

#### Features:
1. **User Account Management**
   - Register new users (passengers, drivers, admins)
   - Update user information
   - Remove inactive users
   - Manage user roles and permissions
   - Activate/deactivate accounts

2. **Driver Management**
   - View registered driver profiles
   - Monitor driver activity and ratings
   - Manage driver status
   - Handle driver complaints and disputes

3. **Booking Monitoring and Transaction Tracking**
   - View all active and completed bookings
   - Track transaction details
   - Monitor payment status
   - Generate transaction reports

4. **System Records and Reporting**
   - Maintain comprehensive data records
   - Generate system usage reports
   - View booking statistics
   - Track system performance metrics
   - Export data for analysis

5. **System Maintenance**
   - Monitor system performance
   - Check for errors or issues
   - Manage system updates
   - Handle bug reports

---

### Module 4: Securing Franchise (MTOP - Motorized Tricycle Operator's Permit)
Digitizes and manages the tricycle franchise application process based on LGU procedures.

#### Sub-modules:

1. **Requirement Submission Module**
   - Upload Barangay Clearance
   - Upload Cedula
   - Upload OR/CR (Official Receipt/Certificate of Registration)
   - Upload proof of vehicle ownership
   - Upload other required credentials
   - Track submission status

2. **Application Management Module**
   - Provide application form
   - Auto-check completeness of requirements
   - Validate document format and size
   - Send notifications for incomplete submissions
   - Allow resubmission of documents

3. **Document Verification Module**
   - Review uploaded documents
   - Validate authenticity of credentials
   - Check eligibility requirements
   - Request additional documents if needed
   - Verify applicant identity

4. **Inspection and Payment Module**
   - Record vehicle inspection results
   - Capture inspection details and photos
   - Manage payment collection for filing fees
   - Process franchise fees
   - Handle other charges and transactions
   - Generate payment receipts

5. **Evaluation and Approval Module**
   - Support application evaluation process
   - Track approval workflow
   - Notify applicants of status changes
   - Coordinate with LGU authorities
   - Document decision-making process

6. **Franchise Issuance Module**
   - Generate MTOP certificates
   - Generate franchise documents
   - Issue digital permits
   - Provide printable certificates
   - Record issuance details

7. **Renewal Management Module**
   - Allow operators to renew franchise
   - Submit updated documents
   - Track renewal deadlines
   - Send renewal reminder notifications
   - Process renewal applications
   - Prevent operation of expired permits

8. **Franchise Update and Monitoring Module**
   - Handle change of vehicle unit
   - Process franchise cancellation requests
   - Maintain franchise compliance records
   - Monitor franchise validity
   - Prevent illegal operations
   - Update operator information

---

## Key System Features

### 1. GPS-Based Tracking System
- **Real-time Location Detection**
  - Accurate GPS positioning for users and drivers
  - Continuous location updates during active rides
  - Map display with real-time markers

- **Navigation Assistance**
  - Route optimization for efficient travel
  - Turn-by-turn directions
  - Distance calculation
  - Estimated time of arrival

### 2. Real-Time Notification System
- Instant booking confirmations
- Driver acceptance/rejection alerts
- Trip updates and reminders
- Pickup location arrival notifications
- Completion confirmations
- Rating and feedback requests

### 3. User-Friendly Interface
- Simple and intuitive design
- Minimal technical knowledge required
- Easy navigation between features
- Clear instructions and labels
- Responsive design for various screen sizes

### 4. Messaging and Communication
- Direct passenger-driver chat
- Trip-related communications
- Notification delivery system
- Call integration options
- Message history

### 5. Rating and Review System
- Post-ride rating options
- Driver performance feedback
- Service quality comments
- Historical rating tracking
- Quality assurance through feedback

### 6. Payment Processing
- Multiple payment method support
- Transaction history tracking
- Receipt generation
- Fare transparency
- Payment confirmation

### 7. Booking History and Records
- Past booking details
- Favorite routes and drivers
- Booking patterns analysis
- Transaction receipts
- Trip duration and distance records

### 8. Driver Queue Management
- Fair distribution based on TODA system
- Queue position tracking
- Automatic queue rotation
- Priority handling for specific routes
- Queue visibility for transparency

---

## Non-Functional Requirements

### 1. **Usability**
- User-friendly interface suitable for users with minimal technical knowledge
- Intuitive navigation and clear menu structures
- Consistent design patterns
- Accessible text sizes and contrast
- Support for multiple languages (optional)

### 2. **Performance**
- Fast response time for booking requests (< 5 seconds)
- Minimal lag in real-time tracking
- Efficient database queries
- Optimized app loading time
- Smooth map interactions

### 3. **Security and Privacy**
- Secure login with authentication
- Data encryption for sensitive information
- Protection against unauthorized access
- Privacy policy compliance
- User data protection
- Secure password handling

### 4. **Compatibility**
- Android platform support (Android 8.0 and above)
- Minimum API Level 26 (Android 8.0)
- Compatible with various Android devices
- Responsive design for different screen sizes (4.5" to 6.7")
- Support for both portrait and landscape orientations

### 5. **Reliability and Stability**
- Consistent performance during operation
- Minimal system errors or crashes
- Proper error handling and recovery
- Data backup mechanisms
- System uptime monitoring

### 6. **Connectivity Requirements**
- Requires stable internet connection
- Supports both WiFi and mobile data
- Handles intermittent connectivity gracefully
- Offline mode for basic features
- Background sync capabilities

---

## Technology Stack

### Development Environment
- **React Native** - Cross-platform development framework
- **Expo** - Development platform and SDK
- **Node.js** - Runtime environment for build tools
- **npm/yarn** - Package managers
- **Visual Studio Code** - Code editor

### Frontend
- **React Native CLI** - Command-line interface
- **React Navigation** - Navigation and routing
- **Redux** or **Context API** - State management
- **Axios** - HTTP client for API calls
- **React Native Maps** - Google Maps integration

### Backend
- **Supabase** - PostgreSQL database and authentication
- **Supabase Auth** - User authentication management
- **Supabase Storage** - File/document storage
- **Supabase Realtime** - Real-time subscriptions
- **PostgreSQL** - Relational database (via Supabase)

### APIs and Services
- **Google Maps API** - Location services, routes, directions
- **Geolocation API** - GPS tracking
- **Notifications API** - Real-time alerts (Supabase Realtime)

### Build and Development
- **Android Studio** - Emulator and testing
- **Android SDK** - Development kit (API Level 26+)
- **Gradle** - Build automation
- **ADB** - Direct device deployment (APK sideload)

### Additional Libraries
- **Socket.io** - Real-time communication (driver-passenger messaging)
- **Moment.js** - Date and time handling
- **Formik** - Form validation
- **React Native Vector Icons** - Icon library
- **React Native Paper** - Material Design UI components

---

## Detailed System Flow Architecture

### User Registration Flow
1. **Passenger Registration Flow**
   - User opens app → Splash screen → Authentication screen
   - Select "Register as Passenger"
   - Enter email/phone number with verification
   - Create password and confirm
   - Fill profile: name, profile photo (optional)
   - Select default payment method
   - Firebase Authentication validates credentials
   - User data stored in Firebase Realtime Database
   - Login credentials secured with encryption
   - User redirected to main passenger dashboard

2. **Driver Registration Flow**
   - Driver opens app → Select "Register as Driver"
   - Enter basic information: name, contact, license
   - Upload driver's license photo (React Native Image Picker)
   - Upload vehicle registration and proof of ownership
   - Enter vehicle details: make, model, plate number, capacity
   - Select TODA affiliation
   - Upload vehicle inspection documents
   - Admin approval required before account activation
   - Driver receives notification upon approval
   - Driver can then accept booking requests

### Booking Request System Flow (Passenger)
1. **Initiation Phase**
   - Passenger opens app and logs in
   - Navigate to "Book Ride" screen
   - System requests location permissions (Geolocation API)
   - Current location automatically populated as pickup point
   - Display map with current position marker

2. **Destination Selection Phase**
   - Passenger enters destination address
   - React Native Maps displays search results
   - Passenger selects destination from dropdown or map
   - Route preview shows estimated distance and time
   - Fare estimation displayed based on fare matrix

3. **Booking Confirmation Phase**
   - Display booking summary: pickup, destination, estimated fare, ETA
   - Passenger confirms booking
   - Booking request sent to Firebase with status: "PENDING"
   - Redux state updates to show "Searching for Driver"
   - Booking data includes: passenger ID, pickup coordinates, destination coordinates, timestamp, estimated fare

4. **Driver Notification Phase**
   - Firebase Cloud Messaging triggers push notification
   - Multiple nearby drivers notified based on proximity (within 2km radius)
   - Driver receives notification with: passenger location, destination, estimated fare, rating
   - Notification sound and vibration alert activated

5. **Driver Response Phase**
   - Driver accepts notification (within 30 seconds optimal)
   - Firebase updates booking status to "DRIVER_ACCEPTED"
   - Passenger receives immediate notification: driver name, vehicle details, driver photo, current location
   - Driver's real-time location streamed to passenger via Socket.io
   - ETA calculated and displayed to passenger

6. **Pickup Phase**
   - Driver navigates to pickup using Google Maps
   - Passenger tracks driver in real-time on map
   - Geolocation API updates driver coordinates every 5 seconds
   - When driver arrives (within 50 meters), system alerts passenger
   - Passenger can call or message driver through app

7. **Trip Completion Phase**
   - Driver confirms passenger pickup in app
   - Booking status changes to "IN_TRANSIT"
   - Route displayed on both driver and passenger screens
   - Trip duration and distance monitored real-time
   - Driver navigates to destination

8. **Drop-off Phase**
   - Driver confirms arrival at destination
   - Booking status changes to "COMPLETED"
   - Fare finalized and displayed
   - Trip details saved to Firebase
   - Payment screen presented (if not prepaid)

### Driver Management System Flow
1. **Driver Status Management**
   - Driver logs in → "Driver Dashboard" screen
   - Toggle "Online/Offline" status
   - When online, driver becomes available in system queue
   - Status synchronized in real-time with Firebase
   - Notification service alerts when booking requests arrive

2. **Booking Request Reception**
   - Firebase Cloud Messaging sends push notification
   - Notification includes: passenger name, pickup location, destination, distance, estimated fare, passenger rating
   - Driver can: Accept, Reject, or ignore (15-second timeout)
   - If accepted, booking locked to driver
   - If rejected or timeout, request sent to next available driver in queue

3. **Trip Navigation**
   - After acceptance, driver sees passenger details screen
   - Google Maps directions to pickup location
   - Real-time route optimization
   - Navigation commands (turn-by-turn)
   - Traffic information integrated

4. **Earnings Tracking**
   - Daily earnings displayed in real-time
   - Breakdown per trip: pickup time, destination, distance, fare, payment method
   - Weekly/monthly summary accessible
   - Total earnings, completed trips, cancellations tracked
   - Data synced to Firebase and Redux state

### Administrator Monitoring Flow
1. **Admin Dashboard Access**
   - Admin logs in with credentials
   - Redux authentication validates permissions
   - Access to admin-only screens verified

2. **Real-time Monitoring**
   - Live map display of all active drivers (with permission)
   - Active booking transactions list
   - Driver status indicators (online/offline/on-trip)
   - Booking status: pending, accepted, in-transit, completed
   - Firebase listeners subscribed to changes

3. **User Management**
   - View all registered passengers and drivers
   - Search and filter users by name, status, registration date
   - Activate/deactivate accounts
   - View user details and trip history
   - Handle user complaints and disputes

4. **Booking Transaction Tracking**
   - Filter by date range, driver, passenger, status
   - View trip details: time, distance, fare, payment
   - Export reports to CSV/PDF
   - Analyze patterns: peak hours, popular routes, driver performance

5. **System Reports Generation**
   - Daily/weekly/monthly booking statistics
   - Revenue reports
   - Driver performance metrics
   - User satisfaction ratings
   - System uptime logs

### GPS Tracking System Flow
1. **Initialization**
   - Geolocation permission requested at app startup
   - GPS service initialized in background
   - Initial location captured

2. **Real-time Position Updates**
   - Driver location updates every 5 seconds during active trip
   - Passenger location tracked during booking search
   - Coordinates: latitude, longitude, accuracy, altitude
   - Data sent to Firebase database in batches

3. **Map Display**
   - React Native Maps component renders map
   - User marker shows current position
   - Polyline shows route from current location to destination
   - Driver marker displayed to passenger (when driver accepted)
   - Real-time marker updates as location changes

4. **Distance & ETA Calculation**
   - Google Maps Distance Matrix API calculates distance
   - Google Maps Directions API calculates ETA
   - ETA updated every 30 seconds as trip progresses
   - Distance remaining to destination calculated

### Notification System Flow
1. **Notification Generation**
   - Event triggers notification: booking request, driver accepted, arrived, trip completed, etc.
   - Redux action dispatches notification event
   - Firebase Cloud Messaging receives notification request

2. **Delivery**
   - FCM sends push notification to device
   - Notification includes title, body, and data payload
   - Sound and vibration alert activated (based on user settings)

3. **Notification Display**
   - In-app notification banner displayed at top of screen
   - Notification center stores notifications (accessible via history)
   - User can tap notification to navigate to relevant screen
   - Notifications persist for 5 seconds then auto-dismiss

### Fare Calculation System Flow
1. **Fare Matrix Configuration**
   - Admin configures fare matrix in Firebase
   - Base fare: ₱50
   - Per kilometer: ₱15
   - Surge pricing multiplier for peak hours: 1.5x

2. **Calculation Process**
   - When passenger enters destination, distance calculated via Google Maps
   - Formula: Base Fare + (Distance km × Per km rate × Peak hour multiplier)
   - Estimated fare displayed to passenger before confirming
   - Final fare calculated after trip completion
   - Any discrepancies logged for admin review

### Message and Communication Flow
1. **In-app Messaging**
   - Passenger initiates chat from trip screen
   - Socket.io establishes real-time connection
   - Messages sent to Firebase messages collection
   - Both parties receive notification of new messages
   - Message history stored for reference

2. **Call Integration**
   - Phone call button in trip details screen
   - Click-to-call opens native phone dialer
   - Driver number passed to Linking API
   - Call duration tracked (optional)

### Payment Flow
1. **Payment Method Selection**
   - During registration, passenger selects default method: Cash, GCash, PayMaya
   - Before trip completion, payment option confirmed
   - Firebase transaction initiated

2. **Payment Processing**
   - Final fare displayed with breakdown
   - Receipt generated with: date, time, distance, fare, driver name
   - For cash: driver confirms payment received
   - For digital: payment gateway processes (future integration)
   - Transaction record stored in Firebase

3. **Receipt Generation**
   - Receipt displayed on screen: trip date, time, distance, fare, driver details
   - Option to share receipt via email or message
   - Receipt stored in user's trip history
   - PDF export available (future feature)

---

## Component Architecture (React Native)

### Screen Components
- **SplashScreen** - App startup and initialization
- **AuthScreen** - Login/Registration selector
- **SignInScreen** - User authentication
- **PassengerDashboard** - Main passenger interface
- **BookRideScreen** - Booking initiation and destination selection
- **ConfirmBookingScreen** - Booking summary and confirmation
- **ActiveTripScreen** - Real-time trip tracking with driver location
- **RatingScreen** - Post-trip rating and feedback
- **DriverDashboard** - Driver main interface
- **DriverNotificationScreen** - Booking request notification handler
- **DriverTripScreen** - Trip navigation and passenger tracking
- **AdminDashboard** - Admin monitoring interface
- **UserProfileScreen** - User account and settings
- **PaymentScreen** - Payment method selection and processing

### State Management (Redux)
- **authSlice** - User authentication state
- **bookingSlice** - Current booking state
- **userSlice** - User profile information
- **locationSlice** - GPS coordinates and tracking
- **notificationSlice** - App notifications
- **paymentSlice** - Payment processing state
- **driverSlice** - Driver-specific state (earnings, status)

### Services
- **authService** - Supabase authentication functions
- **bookingService** - Booking CRUD operations via Supabase
- **locationService** - Geolocation and GPS handling
- **realtimeService** - Supabase Realtime subscriptions
- **mapService** - Google Maps API integration
- **paymentService** - Payment processing
- **databaseService** - Supabase PostgreSQL operations

---

## Supabase PostgreSQL Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID NOT NULL UNIQUE REFERENCES auth.users(id),
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('passenger', 'driver', 'admin')),
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  name VARCHAR(255) NOT NULL,
  profile_photo_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  rating DECIMAL(3,2) DEFAULT 0,
  total_trips INTEGER DEFAULT 0,
  
  -- Passenger specific
  saved_addresses JSONB,
  payment_methods JSONB,
  
  -- Driver specific
  license_number VARCHAR(50),
  license_expiry DATE,
  verification_status VARCHAR(20) CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  vehicle_details JSONB,
  toda_membership VARCHAR(50),
  bank_account JSONB,
  total_earnings DECIMAL(10,2) DEFAULT 0,
  completed_trips INTEGER DEFAULT 0,
  current_status VARCHAR(20) DEFAULT 'offline' CHECK (current_status IN ('online', 'offline', 'on-trip')),
  last_location_update TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_user_type ON users(user_type);
CREATE INDEX idx_users_status ON users(status);
```

### Bookings Table
```sql
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id UUID NOT NULL REFERENCES users(id),
  driver_id UUID REFERENCES users(id),
  pickup_location JSONB NOT NULL,
  dropoff_location JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'in-transit', 'completed', 'cancelled')),
  scheduled_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  accepted_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  distance DECIMAL(8,2),
  estimated_duration INTEGER,
  actual_duration INTEGER,
  base_fare DECIMAL(8,2),
  per_km_rate DECIMAL(8,2),
  total_fare DECIMAL(10,2),
  peak_hour_multiplier DECIMAL(3,2) DEFAULT 1.0,
  payment_method VARCHAR(20) CHECK (payment_method IN ('cash', 'gcash', 'paymaya')),
  payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed')),
  passenger_rating JSONB,
  driver_rating JSONB,
  notes TEXT
);

CREATE INDEX idx_bookings_passenger ON bookings(passenger_id);
CREATE INDEX idx_bookings_driver ON bookings(driver_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_created_at ON bookings(created_at DESC);
```

### Driver Locations Table (Real-time tracking)
```sql
CREATE TABLE driver_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL UNIQUE REFERENCES users(id),
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  accuracy DECIMAL(5,2),
  timestamp TIMESTAMP DEFAULT NOW(),
  altitude DECIMAL(8,2),
  bearing DECIMAL(5,2),
  
  FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_driver_locations_driver_id ON driver_locations(driver_id);
CREATE INDEX idx_driver_locations_timestamp ON driver_locations(timestamp DESC);
```

### Messages Table
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id),
  sender_id UUID NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  read BOOLEAN DEFAULT FALSE,
  sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('passenger', 'driver'))
);

CREATE INDEX idx_messages_booking_id ON messages(booking_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp DESC);
```

### Transactions Table
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id),
  passenger_id UUID NOT NULL REFERENCES users(id),
  driver_id UUID NOT NULL REFERENCES users(id),
  amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'gcash', 'paymaya')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  receipt_url TEXT,
  notes TEXT
);

CREATE INDEX idx_transactions_booking_id ON transactions(booking_id);
CREATE INDEX idx_transactions_passenger_id ON transactions(passenger_id);
CREATE INDEX idx_transactions_driver_id ON transactions(driver_id);
```

### Franchise Applications Table
```sql
CREATE TABLE franchise_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL REFERENCES users(id),
  applicant_name VARCHAR(255) NOT NULL,
  applicant_contact VARCHAR(20),
  vehicle_details JSONB NOT NULL,
  submitted_documents JSONB,
  inspection_result JSONB,
  payments JSONB,
  approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  mtop_issue_date DATE,
  mtop_expiry_date DATE,
  mtop_number VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  approved_by UUID REFERENCES users(id),
  renewal_status VARCHAR(20) CHECK (renewal_status IN ('active', 'expiring', 'expired')),
  last_renewal_date DATE
);

CREATE INDEX idx_franchise_operator_id ON franchise_applications(operator_id);
CREATE INDEX idx_franchise_approval_status ON franchise_applications(approval_status);
CREATE INDEX idx_franchise_renewal_status ON franchise_applications(renewal_status);
```

### Fare Matrix Table
```sql
CREATE TABLE fare_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_fare DECIMAL(8,2) NOT NULL DEFAULT 50.00,
  per_km_rate DECIMAL(8,2) NOT NULL DEFAULT 15.00,
  peak_hours_enabled BOOLEAN DEFAULT TRUE,
  peak_hour_multiplier DECIMAL(3,2) DEFAULT 1.5,
  peak_hour_start TIME DEFAULT '06:30:00',
  peak_hour_end TIME DEFAULT '09:00:00',
  minimum_fare DECIMAL(8,2) DEFAULT 50.00,
  last_updated TIMESTAMP DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);
```

### Notifications Table
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  booking_id UUID REFERENCES bookings(id),
  driver_id UUID REFERENCES users(id),
  passenger_id UUID REFERENCES users(id),
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
```

### Supabase Storage Buckets
```
- users_profiles/ - User profile photos
- driver_documents/ - License, vehicle registration
- franchise_documents/ - Franchise application documents
- receipts/ - Payment receipts
```

---

## Supabase API Integration

### Authentication
```javascript
// Supabase Auth endpoints
POST /auth/v1/signup - User registration
POST /auth/v1/token?grant_type=password - User login
POST /auth/v1/logout - User logout
POST /auth/v1/recovery - Password reset
POST /auth/v1/verify - Email verification
```

### REST API Endpoints (Supabase)
```
GET /rest/v1/users?select=* - Get all users (admin only)
GET /rest/v1/users?id=eq.{userId} - Get user by ID
PATCH /rest/v1/users?id=eq.{userId} - Update user profile

GET /rest/v1/bookings?select=* - Get all bookings
GET /rest/v1/bookings?id=eq.{bookingId} - Get booking details
POST /rest/v1/bookings - Create new booking
PATCH /rest/v1/bookings?id=eq.{bookingId} - Update booking

POST /rest/v1/driver_locations - Insert/update driver location
GET /rest/v1/driver_locations?driver_id=eq.{driverId} - Get driver location

POST /rest/v1/messages - Send message
GET /rest/v1/messages?booking_id=eq.{bookingId} - Get booking messages

POST /rest/v1/transactions - Create transaction
GET /rest/v1/transactions?booking_id=eq.{bookingId} - Get transaction

POST /rest/v1/franchise_applications - Submit franchise application
PATCH /rest/v1/franchise_applications?id=eq.{appId} - Update application
GET /rest/v1/fare_matrix - Get current fare configuration
```

### Supabase Realtime Subscriptions (PostgreSQL Listen/Notify)
```javascript
// Subscribe to bookings changes
supabase
  .channel('bookings')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'bookings' },
    (payload) => { /* handle updates */ }
  )
  .subscribe();

// Subscribe to driver location updates
supabase
  .channel('driver-locations')
  .on('postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'driver_locations' },
    (payload) => { /* handle location updates */ }
  )
  .subscribe();

// Subscribe to messages
supabase
  .channel(`booking-${bookingId}`)
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'messages', filter: `booking_id=eq.${bookingId}` },
    (payload) => { /* handle new messages */ }
  )
  .subscribe();
```

### Encryption
- Firebase Authentication handles password hashing
- Sensitive data encrypted at rest (Firebase default)
- HTTPS/TLS for all API communication
- JWT tokens for session management
- API keys restricted to Android package name

---

## Performance Optimization

### React Native Optimizations
- FlatList with `removeClippedSubviews` for map marker rendering
- React.memo for expensive components
- useMemo and useCallback hooks to prevent re-renders
- Code splitting with react-native-code-push for OTA updates
- Image optimization: compress images before upload

### Supabase Optimization
- Batch reads/writes to reduce API calls
- Indexed queries on frequently accessed columns (email, user_type, status)
- Connection pooling for database queries
- Realtime subscriptions only on active screens
- Pagination for large result sets

### Battery and Network
- GPS tracking intervals adjusted based on battery level
- Background location updates only when on active trip
- Compression for real-time location data
- Local caching of maps and routes
- Offline mode stores last known locations

---

## Security Implementation

### Supabase Row Level Security (RLS)
```sql
-- Users table - authenticated users access own data
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = auth_id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = auth_id);

CREATE POLICY "Admins can view all users"
  ON users FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users WHERE auth.uid() = auth_id AND user_type = 'admin'
  ));

-- Bookings table - passengers/drivers access own bookings
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Passengers view own bookings"
  ON bookings FOR SELECT
  USING (passenger_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Drivers view assigned bookings"
  ON bookings FOR SELECT
  USING (driver_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Admins view all bookings"
  ON bookings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users WHERE auth.uid() = auth_id AND user_type = 'admin'
  ));

-- Driver locations - drivers can update own, all can read
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers update own location"
  ON driver_locations FOR UPDATE
  USING (driver_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "All users can read driver locations"
  ON driver_locations FOR SELECT
  USING (true);

-- Messages - only booking participants can access
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Booking participants can access messages"
  ON messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM bookings
    WHERE bookings.id = messages.booking_id
    AND (bookings.passenger_id = (SELECT id FROM users WHERE auth_id = auth.uid())
         OR bookings.driver_id = (SELECT id FROM users WHERE auth_id = auth.uid()))
  ));
```

### Encryption & Authentication
- Supabase Auth: Email/password authentication with JWT tokens
- PostgreSQL SSL/TLS: All connections encrypted
- Supabase Storage: Files encrypted at rest
- API Keys: Public (anon) and Service roles with proper scoping
- Sensitive fields: Hashed passwords, encrypted tokens

### Access Control
- JWT tokens in Authorization headers
- Short-lived session tokens (1 hour)
- Refresh tokens for extended sessions
- Role-based access (passenger, driver, admin)
- Row-level security enforced at database level

---

## Testing Strategy

### Unit Tests (Jest)
- Service functions: booking creation, fare calculation, location tracking
- Redux reducers and actions
- Utility functions for data formatting

### Integration Tests
- Firebase integration with Redux store
- Authentication flow end-to-end
- Booking creation to completion flow
- Location tracking updates

### UI Tests (React Native Testing Library)
- Navigation between screens
- Form input validation
- Button interactions
- Map interactions

### Performance Tests
- App startup time < 3 seconds
- Booking request response < 2 seconds
- Location update frequency (5-second intervals)
- Memory usage monitoring

---

## Implementation Scope

### Coverage
- Tricycle services within Boac municipality
- Primary focus on daily commuters and students
- Selected high-traffic areas:
  - Schools
  - Markets
  - Transport terminals
  - Commercial centers
  - Residential areas

### What's Included
- Mobile application development
- GPS tracking functionality
- Real-time notification system
- User training and documentation
- System testing and validation
- Implementation plan and deployment

### What's NOT Included
- Other transportation modes (buses, jeepneys)
- Automated fare computation (manual configuration)
- Cashless payment integration (basic payment only)
- Advanced features for future release
- Inter-municipal routes
- External payment system integration

---

## Expected System Benefits

### For Commuters/Students
- Reduced waiting time (15-45 minutes down to minimal wait)
- Convenient mobile booking
- Real-time driver tracking
- Fare transparency
- Improved accessibility to transportation
- Better service reliability

### For Tricycle Drivers
- Increased passenger opportunities
- Reduced idle/waiting time
- Real-time booking requests
- Income tracking and management
- Better ride organization
- Professional service platform

### For FEDTODAB Organization
- Improved operational monitoring
- Better coordination among drivers
- Organized dispatch system
- Enhanced service delivery tracking
- Data-driven decision making
- Reduced operational inefficiencies

### For Local Community
- Modernized transportation services
- Digital solution adoption
- Better traffic management
- Economic improvement through efficiency
- Enhanced mobility for all citizens
- Model for replication in other municipalities

---

## Quality Evaluation Criteria (ISO 25010)

1. **Functional Suitability** - System performs intended functions correctly
2. **Usability** - Application is easy to use and learn
3. **Reliability** - System performs consistently without errors
4. **Performance Efficiency** - Fast response times and optimal resource usage
5. **Portability** - Compatible across Android and iOS platforms

---

## Project Timeline Overview

The project follows an Agile development methodology with iterative refinement and includes:
- Requirements analysis and data gathering
- System design and UI/UX design
- Prototype development
- Core feature implementation
- Testing and improvements
- Implementation and deployment
- User training and support

---

## Success Metrics

- **User Adoption Rate** - Percentage of target users adopting the system
- **Waiting Time Reduction** - Reduction from current 15-45 minutes average
- **System Uptime** - Availability of the system
- **User Satisfaction** - Feedback ratings and surveys
- **Driver Income Increase** - Improved earnings through better ride opportunities
- **Booking Success Rate** - Percentage of successful bookings vs. cancellations
- **Response Time** - Average time for drivers to accept booking requests

---

## Document Information
**System:** Smart Trike Mobile TODA Booking System
**Location:** Boac, Marinduque, Philippines
**Target Users:** Students, Commuters, Tricycle Drivers, Administrators
**Document Type:** System Features & Requirements Breakdown
**Created:** 2026
