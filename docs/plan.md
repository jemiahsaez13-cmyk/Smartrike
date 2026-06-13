# Smart Trike Mobile TODA Booking System - Implementation Plan

## Project Overview

**System Name:** Smart Trike: A Mobile TODA Booking System for Students and Commuters in Boac, Marinduque

**Architecture:** Model-View-Controller (MVC) Pattern with React Native + Supabase

**Development Approach:** Modular, scalable, test-driven development with clear separation of concerns

**Target Platform:** Android (API Level 26+), future iOS support

---

## MVC Architecture Design

### Model Layer (Data & Business Logic)
The Model layer handles all data structures, business logic, database interactions, and API communications. This layer is completely independent of the UI.

**Components:**
- Data Models (TypeScript interfaces and types)
- Supabase Database Schema
- Business Logic Services
- Data Access Layer (DAL)
- Validation Logic
- API Integration Services

**Technology Stack:**
- Supabase PostgreSQL (primary database)
- Supabase Auth (authentication)
- Supabase Storage (file storage)
- Supabase Realtime (live updates)
- TypeScript interfaces for type safety

**Responsibilities:**
- Define data structures and relationships
- Execute database queries via Supabase client
- Implement business rules and validation
- Handle data transformations
- Manage external API calls (Google Maps, etc.)
- Enforce data integrity constraints

---

### View Layer (User Interface)
The View layer presents data to users and captures user interactions. This layer is purely presentational and contains no business logic.

**Components:**
- React Native Screen Components
- Reusable UI Components
- Navigation Structure
- Styling and Theming
- Map Visualizations
- Forms and Input Controls

**Technology Stack:**
- React Native (UI framework)
- React Navigation (routing)
- React Native Maps (mapping)
- React Native Paper (Material Design components)
- React Native Vector Icons
- StyleSheet for styling

**Responsibilities:**
- Render UI based on state and props
- Display data received from Controllers
- Capture user input events
- Handle screen navigation
- Maintain responsive layouts
- Provide visual feedback

---

### Controller Layer (Application Logic)
The Controller layer acts as an intermediary between Models and Views, handling user actions, coordinating data flow, and managing application state.

**Components:**
- Redux Store (state management)
- Redux Slices (state reducers)
- Action Creators
- Middleware (logging, async operations)
- Navigation Controllers
- Event Handlers

**Technology Stack:**
- Redux Toolkit (state management)
- Redux Thunk (async actions)
- React hooks (useSelector, useDispatch)
- Custom hooks for business logic

**Responsibilities:**
- Process user interactions from Views
- Dispatch actions to update state
- Coordinate between multiple Models
- Transform Model data for View consumption
- Handle asynchronous operations
- Manage application flow and navigation
- Implement use case logic

---

## Project Structure

```
smart-trike/
├── src/
│   ├── models/                      # MODEL LAYER
│   │   ├── entities/                # Data entity definitions
│   │   │   ├── User.ts
│   │   │   ├── Booking.ts
│   │   │   ├── Driver.ts
│   │   │   ├── Transaction.ts
│   │   │   ├── Message.ts
│   │   │   ├── Franchise.ts
│   │   │   └── Location.ts
│   │   ├── repositories/            # Data access layer
│   │   │   ├── UserRepository.ts
│   │   │   ├── BookingRepository.ts
│   │   │   ├── DriverRepository.ts
│   │   │   ├── TransactionRepository.ts
│   │   │   ├── MessageRepository.ts
│   │   │   └── FranchiseRepository.ts
│   │   ├── services/                # Business logic services
│   │   │   ├── AuthService.ts
│   │   │   ├── BookingService.ts
│   │   │   ├── FareCalculationService.ts
│   │   │   ├── LocationService.ts
│   │   │   ├── NotificationService.ts
│   │   │   ├── PaymentService.ts
│   │   │   ├── DriverMatchingService.ts
│   │   │   └── RealtimeService.ts
│   │   ├── validators/              # Data validation
│   │   │   ├── UserValidator.ts
│   │   │   ├── BookingValidator.ts
│   │   │   └── FranchiseValidator.ts
│   │   └── types/                   # TypeScript type definitions
│   │       ├── index.ts
│   │       ├── user.types.ts
│   │       ├── booking.types.ts
│   │       └── common.types.ts
│   │
│   ├── controllers/                 # CONTROLLER LAYER
│   │   ├── store/                   # Redux store configuration
│   │   │   ├── index.ts
│   │   │   └── rootReducer.ts
│   │   ├── slices/                  # Redux slices
│   │   │   ├── authSlice.ts
│   │   │   ├── bookingSlice.ts
│   │   │   ├── userSlice.ts
│   │   │   ├── locationSlice.ts
│   │   │   ├── driverSlice.ts
│   │   │   ├── notificationSlice.ts
│   │   │   └── paymentSlice.ts
│   │   ├── actions/                 # Action creators
│   │   │   ├── authActions.ts
│   │   │   ├── bookingActions.ts
│   │   │   └── driverActions.ts
│   │   ├── middleware/              # Redux middleware
│   │   │   ├── realtimeMiddleware.ts
│   │   │   └── locationMiddleware.ts
│   │   └── hooks/                   # Custom React hooks
│   │       ├── useAuth.ts
│   │       ├── useBooking.ts
│   │       ├── useLocation.ts
│   │       └── useRealtime.ts
│   │
│   ├── views/                       # VIEW LAYER
│   │   ├── screens/                 # Full screen components
│   │   │   ├── auth/
│   │   │   │   ├── SplashScreen.tsx
│   │   │   │   ├── LoginScreen.tsx
│   │   │   │   ├── RegisterScreen.tsx
│   │   │   │   └── ForgotPasswordScreen.tsx
│   │   │   ├── passenger/
│   │   │   │   ├── PassengerDashboard.tsx
│   │   │   │   ├── BookRideScreen.tsx
│   │   │   │   ├── ConfirmBookingScreen.tsx
│   │   │   │   ├── ActiveTripScreen.tsx
│   │   │   │   ├── TripHistoryScreen.tsx
│   │   │   │   └── RatingScreen.tsx
│   │   │   ├── driver/
│   │   │   │   ├── DriverDashboard.tsx
│   │   │   │   ├── BookingRequestScreen.tsx
│   │   │   │   ├── DriverTripScreen.tsx
│   │   │   │   ├── EarningsScreen.tsx
│   │   │   │   └── DriverProfileScreen.tsx
│   │   │   ├── admin/
│   │   │   │   ├── AdminDashboard.tsx
│   │   │   │   ├── UserManagementScreen.tsx
│   │   │   │   ├── BookingMonitorScreen.tsx
│   │   │   │   ├── ReportsScreen.tsx
│   │   │   │   └── FranchiseManagementScreen.tsx
│   │   │   └── shared/
│   │   │       ├── ProfileScreen.tsx
│   │   │       ├── SettingsScreen.tsx
│   │   │       ├── NotificationsScreen.tsx
│   │   │       └── PaymentScreen.tsx
│   │   ├── components/              # Reusable UI components
│   │   │   ├── common/
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   ├── Loading.tsx
│   │   │   │   └── ErrorMessage.tsx
│   │   │   ├── map/
│   │   │   │   ├── MapView.tsx
│   │   │   │   ├── MarkerComponent.tsx
│   │   │   │   └── RoutePolyline.tsx
│   │   │   ├── booking/
│   │   │   │   ├── BookingCard.tsx
│   │   │   │   ├── DriverInfo.tsx
│   │   │   │   └── FareBreakdown.tsx
│   │   │   └── forms/
│   │   │       ├── LoginForm.tsx
│   │   │       ├── RegisterForm.tsx
│   │   │       └── BookingForm.tsx
│   │   ├── navigation/              # Navigation configuration
│   │   │   ├── AppNavigator.tsx
│   │   │   ├── AuthNavigator.tsx
│   │   │   ├── PassengerNavigator.tsx
│   │   │   ├── DriverNavigator.tsx
│   │   │   └── AdminNavigator.tsx
│   │   └── styles/                  # Styling and theming
│   │       ├── theme.ts
│   │       ├── colors.ts
│   │       └── typography.ts
│   │
│   ├── config/                      # Configuration files
│   │   ├── supabase.ts
│   │   ├── maps.ts
│   │   └── constants.ts
│   │
│   └── utils/                       # Utility functions
│       ├── dateUtils.ts
│       ├── locationUtils.ts
│       └── validationUtils.ts
│
├── supabase/                        # Supabase backend
│   ├── migrations/                  # Database migrations
│   │   ├── 001_create_users_table.sql
│   │   ├── 002_create_bookings_table.sql
│   │   ├── 003_create_locations_table.sql
│   │   └── 004_create_rls_policies.sql
│   └── functions/                   # Edge functions (if needed)
│
├── android/                         # Android native code
├── ios/                            # iOS native code (future)
├── assets/                         # Static assets
│   ├── images/
│   ├── icons/
│   └── fonts/
│       ├── Poppins-Regular.ttf
│       ├── Poppins-Medium.ttf
│       ├── Poppins-SemiBold.ttf
│       ├── Poppins-Bold.ttf
│       └── Questrial-Regular.ttf
├── __tests__/                      # Test files
│   ├── models/
│   ├── controllers/
│   └── views/
├── docs/                           # Documentation
│   ├── Smart_Trike_Features.md
│   └── plan.md
├── package.json
├── tsconfig.json
└── README.md
```

---

## Data Flow Architecture

### Booking Creation Flow (MVC Pattern)

**User Action (View):**
```
User taps "Book Ride" button → BookRideScreen.tsx
```

**Controller Processing:**
```
1. BookRideScreen dispatches action: dispatch(createBooking(bookingData))
2. Redux middleware intercepts action
3. bookingActions.ts processes the request
4. Validation performed via BookingValidator
```

**Model Interaction:**
```
5. BookingService.createBooking(data) executes business logic
6. FareCalculationService.calculateFare(distance) computes fare
7. BookingRepository.insert(booking) saves to Supabase
8. DriverMatchingService.findNearbyDrivers(location) queries available drivers
9. NotificationService.notifyDrivers(drivers, booking) sends push notifications
```

**State Update (Controller):**
```
10. Supabase returns created booking
11. bookingSlice reducer updates Redux state
12. State change triggers View re-render
```

**View Update:**
```
13. ConfirmBookingScreen receives updated state via useSelector
14. Component displays booking confirmation
15. Real-time subscription established for booking updates
```

---

## MVC Implementation Strategy

### Phase 1: Model Layer Setup
1. Define TypeScript interfaces and types
2. Set up Supabase project and database schema
3. Create repository classes for data access
4. Implement core business logic services
5. Build validation layer
6. Write unit tests for models and services

### Phase 2: Controller Layer Development
1. Configure Redux store and slices
2. Create action creators and thunks
3. Implement custom hooks for state management
4. Build middleware for real-time updates
5. Set up navigation controllers
6. Write integration tests

### Phase 3: View Layer Construction
1. Design UI component library
2. Build screen components
3. Implement navigation structure
4. Connect views to controllers via hooks
5. Apply styling and theming
6. Conduct UI/UX testing

### Phase 4: Integration and Testing
1. Connect all three layers
2. End-to-end testing
3. Performance optimization
4. Security hardening
5. Bug fixes and refinements

---

## PART 1: MODEL LAYER SPECIFICATION

### 1.1 Entity Definitions

#### User Entity (models/entities/User.ts)
```typescript
export interface User {
  id: string;
  auth_id: string;
  user_type: 'passenger' | 'driver' | 'admin';
  email: string;
  phone: string | null;
  name: string;
  profile_photo_url: string | null;
  created_at: Date;
  status: 'active' | 'inactive' | 'suspended';
  rating: number;
  total_trips: number;
}

export interface Passenger extends User {
  user_type: 'passenger';
  saved_addresses: SavedAddress[];
  payment_methods: PaymentMethod[];
}

export interface Driver extends User {
  user_type: 'driver';
  license_number: string;
  license_expiry: Date;
  verification_status: 'pending' | 'verified' | 'rejected';
  vehicle_details: VehicleDetails;
  toda_membership: string;
  bank_account: BankAccount | null;
  total_earnings: number;
  completed_trips: number;
  current_status: 'online' | 'offline' | 'on-trip';
  last_location_update: Date;
}

export interface VehicleDetails {
  plate_number: string;
  make: string;
  model: string;
  year: number;
  color: string;
  capacity: number;
}
```

#### Booking Entity (models/entities/Booking.ts)
```typescript
export interface Booking {
  id: string;
  passenger_id: string;
  driver_id: string | null;
  pickup_location: Location;
  dropoff_location: Location;
  status: BookingStatus;
  scheduled_time: Date | null;
  created_at: Date;
  accepted_at: Date | null;
  started_at: Date | null;
  completed_at: Date | null;
  distance: number;
  estimated_duration: number;
  actual_duration: number | null;
  base_fare: number;
  per_km_rate: number;
  total_fare: number;
  peak_hour_multiplier: number;
  payment_method: PaymentMethod;
  payment_status: 'pending' | 'completed';
  passenger_rating: Rating | null;
  driver_rating: Rating | null;
  notes: string | null;
}

export type BookingStatus = 
  | 'pending' 
  | 'accepted' 
  | 'in-transit' 
  | 'completed' 
  | 'cancelled';

export interface Location {
  latitude: number;
  longitude: number;
  address: string;
  place_id?: string;
}

export interface Rating {
  stars: number;
  comment: string;
  created_at: Date;
}
```

#### Transaction Entity (models/entities/Transaction.ts)
```typescript
export interface Transaction {
  id: string;
  booking_id: string;
  passenger_id: string;
  driver_id: string;
  amount: number;
  payment_method: 'cash' | 'gcash' | 'paymaya';
  status: 'pending' | 'completed' | 'failed';
  created_at: Date;
  completed_at: Date | null;
  receipt_url: string | null;
  notes: string | null;
}
```

---

### 1.2 Repository Layer (Data Access)

#### UserRepository (models/repositories/UserRepository.ts)
```typescript
import { supabase } from '@/config/supabase';
import { User, Driver, Passenger } from '@/models/entities/User';

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }

  async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (error) return null;
    return data;
  }

  async create(user: Omit<User, 'id' | 'created_at'>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .insert(user)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async update(id: string, updates: Partial<User>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async findAvailableDrivers(location: Location, radius: number): Promise<Driver[]> {
    const { data, error } = await supabase
      .rpc('find_nearby_drivers', {
        lat: location.latitude,
        lng: location.longitude,
        radius_km: radius
      });
    
    if (error) throw error;
    return data;
  }

  async updateDriverStatus(driverId: string, status: Driver['current_status']): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({ current_status: status })
      .eq('id', driverId);
    
    if (error) throw error;
  }
}
```

#### BookingRepository (models/repositories/BookingRepository.ts)
```typescript
import { supabase } from '@/config/supabase';
import { Booking } from '@/models/entities/Booking';

export class BookingRepository {
  async create(booking: Omit<Booking, 'id' | 'created_at'>): Promise<Booking> {
    const { data, error } = await supabase
      .from('bookings')
      .insert(booking)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async findById(id: string): Promise<Booking | null> {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) return null;
    return data;
  }

  async updateStatus(id: string, status: BookingStatus): Promise<Booking> {
    const { data, error } = await supabase
      .from('bookings')
      .update({ 
        status,
        accepted_at: status === 'accepted' ? new Date().toISOString() : undefined,
        started_at: status === 'in-transit' ? new Date().toISOString() : undefined,
        completed_at: status === 'completed' ? new Date().toISOString() : undefined
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async assignDriver(bookingId: string, driverId: string): Promise<Booking> {
    const { data, error } = await supabase
      .from('bookings')
      .update({ 
        driver_id: driverId,
        status: 'accepted',
        accepted_at: new Date().toISOString()
      })
      .eq('id', bookingId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async findByPassenger(passengerId: string, limit: number = 50): Promise<Booking[]> {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('passenger_id', passengerId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data;
  }

  async findByDriver(driverId: string, limit: number = 50): Promise<Booking[]> {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data;
  }

  async findActiveBookings(): Promise<Booking[]> {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .in('status', ['pending', 'accepted', 'in-transit'])
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  }
}
```

---

### 1.3 Service Layer (Business Logic)

#### AuthService (models/services/AuthService.ts)
```typescript
import { supabase } from '@/config/supabase';
import { UserRepository } from '@/models/repositories/UserRepository';

export class AuthService {
  private userRepo: UserRepository;

  constructor() {
    this.userRepo = new UserRepository();
  }

  async signUp(email: string, password: string, userData: any) {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('User creation failed');

    const user = await this.userRepo.create({
      auth_id: authData.user.id,
      email,
      ...userData,
      status: 'active',
      rating: 0,
      total_trips: 0
    });

    return { user, session: authData.session };
  }

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    
    const user = await this.userRepo.findByEmail(email);
    if (!user) throw new Error('User not found');
    if (user.status !== 'active') throw new Error('Account is inactive');

    return { user, session: data.session };
  }

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  }

  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    return await this.userRepo.findById(user.id);
  }
}
```

#### BookingService (models/services/BookingService.ts)
```typescript
import { BookingRepository } from '@/models/repositories/BookingRepository';
import { UserRepository } from '@/models/repositories/UserRepository';
import { FareCalculationService } from './FareCalculationService';
import { DriverMatchingService } from './DriverMatchingService';
import { NotificationService } from './NotificationService';
import { Booking, Location } from '@/models/entities/Booking';

export class BookingService {
  private bookingRepo: BookingRepository;
  private userRepo: UserRepository;
  private fareService: FareCalculationService;
  private matchingService: DriverMatchingService;
  private notificationService: NotificationService;

  constructor() {
    this.bookingRepo = new BookingRepository();
    this.userRepo = new UserRepository();
    this.fareService = new FareCalculationService();
    this.matchingService = new DriverMatchingService();
    this.notificationService = new NotificationService();
  }

  async createBooking(
    passengerId: string,
    pickup: Location,
    dropoff: Location,
    scheduledTime?: Date
  ): Promise<Booking> {
    const distance = await this.fareService.calculateDistance(pickup, dropoff);
    const { baseFare, perKmRate, multiplier } = await this.fareService.getFareConfig();
    const totalFare = this.fareService.calculateFare(distance, baseFare, perKmRate, multiplier);
    const estimatedDuration = Math.ceil(distance / 30 * 60);

    const booking = await this.bookingRepo.create({
      passenger_id: passengerId,
      driver_id: null,
      pickup_location: pickup,
      dropoff_location: dropoff,
      status: 'pending',
      scheduled_time: scheduledTime || null,
      distance,
      estimated_duration: estimatedDuration,
      actual_duration: null,
      base_fare: baseFare,
      per_km_rate: perKmRate,
      total_fare: totalFare,
      peak_hour_multiplier: multiplier,
      payment_method: 'cash',
      payment_status: 'pending',
      passenger_rating: null,
      driver_rating: null,
      notes: null,
      accepted_at: null,
      started_at: null,
      completed_at: null
    });

    const nearbyDrivers = await this.matchingService.findNearbyDrivers(pickup, 5);
    await this.notificationService.notifyDrivers(nearbyDrivers, booking);

    return booking;
  }

  async acceptBooking(bookingId: string, driverId: string): Promise<Booking> {
    await this.userRepo.updateDriverStatus(driverId, 'on-trip');
    const booking = await this.bookingRepo.assignDriver(bookingId, driverId);
    await this.notificationService.notifyPassenger(
      booking.passenger_id,
      'Driver Accepted',
      'Your driver is on the way!'
    );
    return booking;
  }

  async startTrip(bookingId: string): Promise<Booking> {
    return await this.bookingRepo.updateStatus(bookingId, 'in-transit');
  }

  async completeTrip(bookingId: string): Promise<Booking> {
    const booking = await this.bookingRepo.updateStatus(bookingId, 'completed');
    if (booking.driver_id) {
      await this.userRepo.updateDriverStatus(booking.driver_id, 'online');
    }
    return booking;
  }

  async cancelBooking(bookingId: string): Promise<Booking> {
    const booking = await this.bookingRepo.findById(bookingId);
    if (!booking) throw new Error('Booking not found');
    
    if (booking.driver_id) {
      await this.userRepo.updateDriverStatus(booking.driver_id, 'online');
    }
    
    return await this.bookingRepo.updateStatus(bookingId, 'cancelled');
  }
}
```



#### FareCalculationService (models/services/FareCalculationService.ts)
```typescript
import { supabase } from '@/config/supabase';
import { Location } from '@/models/entities/Booking';

export class FareCalculationService {
  async getFareConfig() {
    const { data, error } = await supabase
      .from('fare_matrix')
      .select('*')
      .single();
    
    if (error) throw error;

    const now = new Date();
    const currentHour = now.getHours();
    const peakStart = 6.5;
    const peakEnd = 9;
    const isPeakHour = currentHour >= peakStart && currentHour < peakEnd;

    return {
      baseFare: data.base_fare,
      perKmRate: data.per_km_rate,
      multiplier: isPeakHour && data.peak_hours_enabled ? data.peak_hour_multiplier : 1.0
    };
  }

  calculateFare(distance: number, baseFare: number, perKmRate: number, multiplier: number): number {
    const fare = baseFare + (distance * perKmRate);
    return Math.round(fare * multiplier * 100) / 100;
  }

  async calculateDistance(pickup: Location, dropoff: Location): Promise<number> {
    const R = 6371;
    const lat1 = pickup.latitude * Math.PI / 180;
    const lat2 = dropoff.latitude * Math.PI / 180;
    const deltaLat = (dropoff.latitude - pickup.latitude) * Math.PI / 180;
    const deltaLng = (dropoff.longitude - pickup.longitude) * Math.PI / 180;

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
```

#### DriverMatchingService (models/services/DriverMatchingService.ts)
```typescript
import { UserRepository } from '@/models/repositories/UserRepository';
import { Location } from '@/models/entities/Booking';
import { Driver } from '@/models/entities/User';

export class DriverMatchingService {
  private userRepo: UserRepository;

  constructor() {
    this.userRepo = new UserRepository();
  }

  async findNearbyDrivers(location: Location, radiusKm: number): Promise<Driver[]> {
    const drivers = await this.userRepo.findAvailableDrivers(location, radiusKm);
    return drivers.filter(d => d.current_status === 'online');
  }

  async findBestDriver(location: Location): Promise<Driver | null> {
    const drivers = await this.findNearbyDrivers(location, 5);
    if (drivers.length === 0) return null;

    drivers.sort((a, b) => {
      if (a.rating !== b.rating) return b.rating - a.rating;
      return a.total_trips - b.total_trips;
    });

    return drivers[0];
  }
}
```

#### LocationService (models/services/LocationService.ts)
```typescript
import { supabase } from '@/config/supabase';
import Geolocation from '@react-native-community/geolocation';
import { Location } from '@/models/entities/Booking';

export class LocationService {
  async getCurrentPosition(): Promise<Location> {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        position => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            address: ''
          });
        },
        error => reject(error),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    });
  }

  async updateDriverLocation(driverId: string, location: Location): Promise<void> {
    const { error } = await supabase
      .from('driver_locations')
      .upsert({
        driver_id: driverId,
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: new Date().toISOString()
      });
    
    if (error) throw error;
  }

  async getDriverLocation(driverId: string): Promise<Location | null> {
    const { data, error } = await supabase
      .from('driver_locations')
      .select('*')
      .eq('driver_id', driverId)
      .single();
    
    if (error) return null;

    return {
      latitude: data.latitude,
      longitude: data.longitude,
      address: ''
    };
  }

  watchPosition(callback: (location: Location) => void): number {
    return Geolocation.watchPosition(
      position => {
        callback({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          address: ''
        });
      },
      error => console.error(error),
      { enableHighAccuracy: true, distanceFilter: 10, interval: 5000 }
    );
  }

  clearWatch(watchId: number): void {
    Geolocation.clearWatch(watchId);
  }
}
```

#### NotificationService (models/services/NotificationService.ts)
```typescript
import { supabase } from '@/config/supabase';
import { Driver } from '@/models/entities/User';
import { Booking } from '@/models/entities/Booking';

export class NotificationService {
  async notifyDrivers(drivers: Driver[], booking: Booking): Promise<void> {
    const notifications = drivers.map(driver => ({
      user_id: driver.id,
      type: 'booking_request',
      title: 'New Booking Request',
      body: `Pickup at ${booking.pickup_location.address}`,
      booking_id: booking.id,
      read: false
    }));

    const { error } = await supabase
      .from('notifications')
      .insert(notifications);
    
    if (error) throw error;
  }

  async notifyPassenger(passengerId: string, title: string, body: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: passengerId,
        type: 'booking_update',
        title,
        body,
        read: false
      });
    
    if (error) throw error;
  }

  async markAsRead(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);
    
    if (error) throw error;
  }

  async getUserNotifications(userId: string, limit: number = 20) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data;
  }
}
```

#### RealtimeService (models/services/RealtimeService.ts)
```typescript
import { supabase } from '@/config/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export class RealtimeService {
  private channels: Map<string, RealtimeChannel> = new Map();

  subscribeToBooking(bookingId: string, callback: (payload: any) => void): string {
    const channel = supabase
      .channel(`booking-${bookingId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `id=eq.${bookingId}`
        },
        payload => callback(payload)
      )
      .subscribe();

    this.channels.set(bookingId, channel);
    return bookingId;
  }

  subscribeToDriverLocation(driverId: string, callback: (payload: any) => void): string {
    const channel = supabase
      .channel(`driver-location-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'driver_locations',
          filter: `driver_id=eq.${driverId}`
        },
        payload => callback(payload)
      )
      .subscribe();

    this.channels.set(`driver-${driverId}`, channel);
    return `driver-${driverId}`;
  }

  subscribeToMessages(bookingId: string, callback: (payload: any) => void): string {
    const channel = supabase
      .channel(`messages-${bookingId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `booking_id=eq.${bookingId}`
        },
        payload => callback(payload)
      )
      .subscribe();

    this.channels.set(`messages-${bookingId}`, channel);
    return `messages-${bookingId}`;
  }

  unsubscribe(channelKey: string): void {
    const channel = this.channels.get(channelKey);
    if (channel) {
      supabase.removeChannel(channel);
      this.channels.delete(channelKey);
    }
  }

  unsubscribeAll(): void {
    this.channels.forEach(channel => {
      supabase.removeChannel(channel);
    });
    this.channels.clear();
  }
}
```

---

### 1.4 Validation Layer

#### BookingValidator (models/validators/BookingValidator.ts)
```typescript
import { Location } from '@/models/entities/Booking';

export class BookingValidator {
  static validateLocation(location: Location): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!location.latitude || location.latitude < -90 || location.latitude > 90) {
      errors.push('Invalid latitude');
    }

    if (!location.longitude || location.longitude < -180 || location.longitude > 180) {
      errors.push('Invalid longitude');
    }

    if (!location.address || location.address.trim().length === 0) {
      errors.push('Address is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  static validateBookingRequest(pickup: Location, dropoff: Location): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    const pickupValidation = this.validateLocation(pickup);
    if (!pickupValidation.valid) {
      errors.push(...pickupValidation.errors.map(e => `Pickup: ${e}`));
    }

    const dropoffValidation = this.validateLocation(dropoff);
    if (!dropoffValidation.valid) {
      errors.push(...dropoffValidation.errors.map(e => `Dropoff: ${e}`));
    }

    if (pickup.latitude === dropoff.latitude && pickup.longitude === dropoff.longitude) {
      errors.push('Pickup and dropoff locations cannot be the same');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
```

#### UserValidator (models/validators/UserValidator.ts)
```typescript
export class UserValidator {
  static validateEmail(email: string): boolean {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  static validatePhone(phone: string): boolean {
    const regex = /^(09|\+639)\d{9}$/;
    return regex.test(phone);
  }

  static validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  static validateDriverRegistration(data: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.license_number || data.license_number.trim().length === 0) {
      errors.push('License number is required');
    }

    if (!data.license_expiry || new Date(data.license_expiry) < new Date()) {
      errors.push('Valid license expiry date is required');
    }

    if (!data.vehicle_details?.plate_number) {
      errors.push('Vehicle plate number is required');
    }

    if (!data.toda_membership) {
      errors.push('TODA membership is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
```

---

## PART 2: CONTROLLER LAYER SPECIFICATION

### 2.1 Redux Store Configuration

#### Store Setup (controllers/store/index.ts)
```typescript
import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import rootReducer from './rootReducer';
import realtimeMiddleware from '../middleware/realtimeMiddleware';
import locationMiddleware from '../middleware/locationMiddleware';

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['location/updatePosition'],
        ignoredPaths: ['location.lastUpdate']
      }
    }).concat(realtimeMiddleware, locationMiddleware)
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

#### Root Reducer (controllers/store/rootReducer.ts)
```typescript
import { combineReducers } from '@reduxjs/toolkit';
import authReducer from '../slices/authSlice';
import bookingReducer from '../slices/bookingSlice';
import userReducer from '../slices/userSlice';
import locationReducer from '../slices/locationSlice';
import driverReducer from '../slices/driverSlice';
import notificationReducer from '../slices/notificationSlice';
import paymentReducer from '../slices/paymentSlice';

const rootReducer = combineReducers({
  auth: authReducer,
  booking: bookingReducer,
  user: userReducer,
  location: locationReducer,
  driver: driverReducer,
  notification: notificationReducer,
  payment: paymentReducer
});

export default rootReducer;
```

---

### 2.2 Redux Slices

#### Auth Slice (controllers/slices/authSlice.ts)
```typescript
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { AuthService } from '@/models/services/AuthService';
import { User } from '@/models/entities/User';

const authService = new AuthService();

interface AuthState {
  user: User | null;
  session: any | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  session: null,
  isAuthenticated: false,
  loading: false,
  error: null
};

export const signUp = createAsyncThunk(
  'auth/signUp',
  async (payload: { email: string; password: string; userData: any }, { rejectWithValue }) => {
    try {
      return await authService.signUp(payload.email, payload.password, payload.userData);
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const signIn = createAsyncThunk(
  'auth/signIn',
  async (payload: { email: string; password: string }, { rejectWithValue }) => {
    try {
      return await authService.signIn(payload.email, payload.password);
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const signOut = createAsyncThunk(
  'auth/signOut',
  async (_, { rejectWithValue }) => {
    try {
      await authService.signOut();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const checkSession = createAsyncThunk(
  'auth/checkSession',
  async (_, { rejectWithValue }) => {
    try {
      const user = await authService.getCurrentUser();
      return user;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(signUp.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signUp.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.session = action.payload.session;
        state.isAuthenticated = true;
      })
      .addCase(signUp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(signIn.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signIn.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.session = action.payload.session;
        state.isAuthenticated = true;
      })
      .addCase(signIn.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(signOut.fulfilled, (state) => {
        state.user = null;
        state.session = null;
        state.isAuthenticated = false;
      })
      .addCase(checkSession.fulfilled, (state, action) => {
        if (action.payload) {
          state.user = action.payload;
          state.isAuthenticated = true;
        }
      });
  }
});

export const { clearError, setUser } = authSlice.actions;
export default authSlice.reducer;
```

#### Booking Slice (controllers/slices/bookingSlice.ts)
```typescript
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { BookingService } from '@/models/services/BookingService';
import { Booking, Location } from '@/models/entities/Booking';

const bookingService = new BookingService();

interface BookingState {
  currentBooking: Booking | null;
  bookingHistory: Booking[];
  activeBookings: Booking[];
  loading: boolean;
  error: string | null;
  searchingForDriver: boolean;
}

const initialState: BookingState = {
  currentBooking: null,
  bookingHistory: [],
  activeBookings: [],
  loading: false,
  error: null,
  searchingForDriver: false
};

export const createBooking = createAsyncThunk(
  'booking/create',
  async (
    payload: { passengerId: string; pickup: Location; dropoff: Location; scheduledTime?: Date },
    { rejectWithValue }
  ) => {
    try {
      return await bookingService.createBooking(
        payload.passengerId,
        payload.pickup,
        payload.dropoff,
        payload.scheduledTime
      );
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const acceptBooking = createAsyncThunk(
  'booking/accept',
  async (payload: { bookingId: string; driverId: string }, { rejectWithValue }) => {
    try {
      return await bookingService.acceptBooking(payload.bookingId, payload.driverId);
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const startTrip = createAsyncThunk(
  'booking/startTrip',
  async (bookingId: string, { rejectWithValue }) => {
    try {
      return await bookingService.startTrip(bookingId);
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const completeTrip = createAsyncThunk(
  'booking/completeTrip',
  async (bookingId: string, { rejectWithValue }) => {
    try {
      return await bookingService.completeTrip(bookingId);
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const cancelBooking = createAsyncThunk(
  'booking/cancel',
  async (bookingId: string, { rejectWithValue }) => {
    try {
      return await bookingService.cancelBooking(bookingId);
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const bookingSlice = createSlice({
  name: 'booking',
  initialState,
  reducers: {
    clearCurrentBooking: (state) => {
      state.currentBooking = null;
      state.searchingForDriver = false;
    },
    updateBookingStatus: (state, action: PayloadAction<Booking>) => {
      state.currentBooking = action.payload;
      if (action.payload.status === 'accepted') {
        state.searchingForDriver = false;
      }
    },
    setSearchingForDriver: (state, action: PayloadAction<boolean>) => {
      state.searchingForDriver = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(createBooking.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.searchingForDriver = true;
      })
      .addCase(createBooking.fulfilled, (state, action) => {
        state.loading = false;
        state.currentBooking = action.payload;
      })
      .addCase(createBooking.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.searchingForDriver = false;
      })
      .addCase(acceptBooking.fulfilled, (state, action) => {
        state.currentBooking = action.payload;
        state.searchingForDriver = false;
      })
      .addCase(startTrip.fulfilled, (state, action) => {
        state.currentBooking = action.payload;
      })
      .addCase(completeTrip.fulfilled, (state, action) => {
        state.bookingHistory.unshift(action.payload);
        state.currentBooking = null;
      })
      .addCase(cancelBooking.fulfilled, (state) => {
        state.currentBooking = null;
        state.searchingForDriver = false;
      });
  }
});

export const { clearCurrentBooking, updateBookingStatus, setSearchingForDriver } = bookingSlice.actions;
export default bookingSlice.reducer;
```

#### Location Slice (controllers/slices/locationSlice.ts)
```typescript
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { LocationService } from '@/models/services/LocationService';
import { Location } from '@/models/entities/Booking';

const locationService = new LocationService();

interface LocationState {
  currentLocation: Location | null;
  driverLocation: Location | null;
  watchId: number | null;
  loading: boolean;
  error: string | null;
  permissionGranted: boolean;
}

const initialState: LocationState = {
  currentLocation: null,
  driverLocation: null,
  watchId: null,
  loading: false,
  error: null,
  permissionGranted: false
};

export const getCurrentLocation = createAsyncThunk(
  'location/getCurrent',
  async (_, { rejectWithValue }) => {
    try {
      return await locationService.getCurrentPosition();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateDriverLocation = createAsyncThunk(
  'location/updateDriver',
  async (payload: { driverId: string; location: Location }, { rejectWithValue }) => {
    try {
      await locationService.updateDriverLocation(payload.driverId, payload.location);
      return payload.location;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchDriverLocation = createAsyncThunk(
  'location/fetchDriver',
  async (driverId: string, { rejectWithValue }) => {
    try {
      return await locationService.getDriverLocation(driverId);
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const locationSlice = createSlice({
  name: 'location',
  initialState,
  reducers: {
    setCurrentLocation: (state, action: PayloadAction<Location>) => {
      state.currentLocation = action.payload;
    },
    setDriverLocation: (state, action: PayloadAction<Location>) => {
      state.driverLocation = action.payload;
    },
    setWatchId: (state, action: PayloadAction<number>) => {
      state.watchId = action.payload;
    },
    clearWatchId: (state) => {
      if (state.watchId !== null) {
        locationService.clearWatch(state.watchId);
        state.watchId = null;
      }
    },
    setPermissionGranted: (state, action: PayloadAction<boolean>) => {
      state.permissionGranted = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(getCurrentLocation.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getCurrentLocation.fulfilled, (state, action) => {
        state.loading = false;
        state.currentLocation = action.payload;
      })
      .addCase(getCurrentLocation.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(updateDriverLocation.fulfilled, (state, action) => {
        state.currentLocation = action.payload;
      })
      .addCase(fetchDriverLocation.fulfilled, (state, action) => {
        state.driverLocation = action.payload;
      });
  }
});

export const { 
  setCurrentLocation, 
  setDriverLocation, 
  setWatchId, 
  clearWatchId, 
  setPermissionGranted 
} = locationSlice.actions;
export default locationSlice.reducer;
```

#### Driver Slice (controllers/slices/driverSlice.ts)
```typescript
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { UserRepository } from '@/models/repositories/UserRepository';
import { BookingRepository } from '@/models/repositories/BookingRepository';
import { Driver } from '@/models/entities/User';
import { Booking } from '@/models/entities/Booking';

const userRepo = new UserRepository();
const bookingRepo = new BookingRepository();

interface DriverState {
  driverInfo: Driver | null;
  currentStatus: 'online' | 'offline' | 'on-trip';
  incomingRequests: Booking[];
  completedTrips: Booking[];
  totalEarnings: number;
  dailyEarnings: number;
  loading: boolean;
  error: string | null;
}

const initialState: DriverState = {
  driverInfo: null,
  currentStatus: 'offline',
  incomingRequests: [],
  completedTrips: [],
  totalEarnings: 0,
  dailyEarnings: 0,
  loading: false,
  error: null
};

export const updateDriverStatus = createAsyncThunk(
  'driver/updateStatus',
  async (payload: { driverId: string; status: Driver['current_status'] }, { rejectWithValue }) => {
    try {
      await userRepo.updateDriverStatus(payload.driverId, payload.status);
      return payload.status;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchCompletedTrips = createAsyncThunk(
  'driver/fetchCompletedTrips',
  async (driverId: string, { rejectWithValue }) => {
    try {
      return await bookingRepo.findByDriver(driverId);
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const driverSlice = createSlice({
  name: 'driver',
  initialState,
  reducers: {
    setDriverInfo: (state, action: PayloadAction<Driver>) => {
      state.driverInfo = action.payload;
      state.currentStatus = action.payload.current_status;
      state.totalEarnings = action.payload.total_earnings;
    },
    addIncomingRequest: (state, action: PayloadAction<Booking>) => {
      state.incomingRequests.push(action.payload);
    },
    removeIncomingRequest: (state, action: PayloadAction<string>) => {
      state.incomingRequests = state.incomingRequests.filter(r => r.id !== action.payload);
    },
    updateDailyEarnings: (state, action: PayloadAction<number>) => {
      state.dailyEarnings += action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(updateDriverStatus.fulfilled, (state, action) => {
        state.currentStatus = action.payload;
      })
      .addCase(fetchCompletedTrips.fulfilled, (state, action) => {
        state.completedTrips = action.payload.filter(b => b.status === 'completed');
        const today = new Date().toDateString();
        state.dailyEarnings = action.payload
          .filter(b => new Date(b.completed_at!).toDateString() === today)
          .reduce((sum, b) => sum + b.total_fare, 0);
      });
  }
});

export const { 
  setDriverInfo, 
  addIncomingRequest, 
  removeIncomingRequest, 
  updateDailyEarnings 
} = driverSlice.actions;
export default driverSlice.reducer;
```

---

### 2.3 Custom Hooks

#### useAuth Hook (controllers/hooks/useAuth.ts)
```typescript
import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { signUp, signIn, signOut, checkSession } from '../slices/authSlice';

export const useAuth = () => {
  const dispatch = useAppDispatch();
  const { user, isAuthenticated, loading, error } = useAppSelector(state => state.auth);

  const register = useCallback(
    async (email: string, password: string, userData: any) => {
      return dispatch(signUp({ email, password, userData })).unwrap();
    },
    [dispatch]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      return dispatch(signIn({ email, password })).unwrap();
    },
    [dispatch]
  );

  const logout = useCallback(async () => {
    return dispatch(signOut()).unwrap();
  }, [dispatch]);

  const checkAuth = useCallback(async () => {
    return dispatch(checkSession()).unwrap();
  }, [dispatch]);

  return {
    user,
    isAuthenticated,
    loading,
    error,
    register,
    login,
    logout,
    checkAuth
  };
};
```

#### useBooking Hook (controllers/hooks/useBooking.ts)
```typescript
import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { 
  createBooking, 
  acceptBooking, 
  startTrip, 
  completeTrip, 
  cancelBooking 
} from '../slices/bookingSlice';
import { Location } from '@/models/entities/Booking';

export const useBooking = () => {
  const dispatch = useAppDispatch();
  const { currentBooking, loading, error, searchingForDriver } = useAppSelector(
    state => state.booking
  );

  const bookRide = useCallback(
    async (passengerId: string, pickup: Location, dropoff: Location) => {
      return dispatch(createBooking({ passengerId, pickup, dropoff })).unwrap();
    },
    [dispatch]
  );

  const acceptRequest = useCallback(
    async (bookingId: string, driverId: string) => {
      return dispatch(acceptBooking({ bookingId, driverId })).unwrap();
    },
    [dispatch]
  );

  const beginTrip = useCallback(
    async (bookingId: string) => {
      return dispatch(startTrip(bookingId)).unwrap();
    },
    [dispatch]
  );

  const finishTrip = useCallback(
    async (bookingId: string) => {
      return dispatch(completeTrip(bookingId)).unwrap();
    },
    [dispatch]
  );

  const cancel = useCallback(
    async (bookingId: string) => {
      return dispatch(cancelBooking(bookingId)).unwrap();
    },
    [dispatch]
  );

  return {
    currentBooking,
    loading,
    error,
    searchingForDriver,
    bookRide,
    acceptRequest,
    beginTrip,
    finishTrip,
    cancel
  };
};
```

#### useLocation Hook (controllers/hooks/useLocation.ts)
```typescript
import { useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { 
  getCurrentLocation, 
  updateDriverLocation, 
  setWatchId, 
  clearWatchId 
} from '../slices/locationSlice';
import { LocationService } from '@/models/services/LocationService';

const locationService = new LocationService();

export const useLocation = () => {
  const dispatch = useAppDispatch();
  const { currentLocation, driverLocation, loading, error } = useAppSelector(
    state => state.location
  );

  const getLocation = useCallback(async () => {
    return dispatch(getCurrentLocation()).unwrap();
  }, [dispatch]);

  const startWatchingLocation = useCallback(
    (driverId: string) => {
      const watchId = locationService.watchPosition((location) => {
        dispatch(updateDriverLocation({ driverId, location }));
      });
      dispatch(setWatchId(watchId));
    },
    [dispatch]
  );

  const stopWatchingLocation = useCallback(() => {
    dispatch(clearWatchId());
  }, [dispatch]);

  return {
    currentLocation,
    driverLocation,
    loading,
    error,
    getLocation,
    startWatchingLocation,
    stopWatchingLocation
  };
};
```

---

## PART 3: VIEW LAYER SPECIFICATION

### 3.1 Screen Components

#### Login Screen (views/screens/auth/LoginScreen.tsx)
```typescript
import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, Button, TextInput } from 'react-native-paper';
import { useAuth } from '@/controllers/hooks/useAuth';
import { useNavigation } from '@react-navigation/native';

export const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, loading, error } = useAuth();
  const navigation = useNavigation();

  const handleLogin = async () => {
    try {
      const result = await login(email, password);
      if (result.user.user_type === 'passenger') {
        navigation.navigate('PassengerDashboard');
      } else if (result.user.user_type === 'driver') {
        navigation.navigate('DriverDashboard');
      } else {
        navigation.navigate('AdminDashboard');
      }
    } catch (err) {
      Alert.alert('Login Failed', error || 'Invalid credentials');
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="headlineLarge" style={styles.title}>Smart Trike</Text>
      <Text variant="bodyLarge" style={styles.subtitle}>Login to continue</Text>
      
      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        style={styles.input}
      />
      
      <TextInput
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />
      
      <Button 
        mode="contained" 
        onPress={handleLogin} 
        loading={loading}
        disabled={loading}
        style={styles.button}
      >
        Login
      </Button>
      
      <Button 
        mode="text" 
        onPress={() => navigation.navigate('Register')}
        style={styles.linkButton}
      >
        Don't have an account? Register
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#fff'
  },
  title: {
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: 'bold'
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 30,
    color: '#666'
  },
  input: {
    marginBottom: 15
  },
  button: {
    marginTop: 10,
    paddingVertical: 5
  },
  linkButton: {
    marginTop: 10
  }
});
```

#### Passenger Dashboard (views/screens/passenger/PassengerDashboard.tsx)
```typescript
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, Card } from 'react-native-paper';
import { useAuth } from '@/controllers/hooks/useAuth';
import { useBooking } from '@/controllers/hooks/useBooking';
import { useNavigation } from '@react-navigation/native';

export const PassengerDashboard = () => {
  const { user } = useAuth();
  const { currentBooking } = useBooking();
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.greeting}>
        Hello, {user?.name}
      </Text>

      {currentBooking ? (
        <Card style={styles.card}>
          <Card.Title title="Active Booking" />
          <Card.Content>
            <Text>Status: {currentBooking.status}</Text>
            <Text>Pickup: {currentBooking.pickup_location.address}</Text>
            <Text>Dropoff: {currentBooking.dropoff_location.address}</Text>
            <Text>Fare: ₱{currentBooking.total_fare}</Text>
          </Card.Content>
          <Card.Actions>
            <Button onPress={() => navigation.navigate('ActiveTrip')}>
              View Details
            </Button>
          </Card.Actions>
        </Card>
      ) : (
        <Card style={styles.card}>
          <Card.Title title="Book a Ride" />
          <Card.Content>
            <Text>Where do you want to go?</Text>
          </Card.Content>
          <Card.Actions>
            <Button 
              mode="contained" 
              onPress={() => navigation.navigate('BookRide')}
            >
              Book Now
            </Button>
          </Card.Actions>
        </Card>
      )}

      <View style={styles.quickActions}>
        <Button 
          mode="outlined" 
          onPress={() => navigation.navigate('TripHistory')}
          style={styles.actionButton}
        >
          Trip History
        </Button>
        <Button 
          mode="outlined" 
          onPress={() => navigation.navigate('Profile')}
          style={styles.actionButton}
        >
          Profile
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5'
  },
  greeting: {
    marginBottom: 20,
    fontWeight: 'bold'
  },
  card: {
    marginBottom: 20
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 5
  }
});
```

#### Book Ride Screen (views/screens/passenger/BookRideScreen.tsx)
```typescript
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, Button, TextInput } from 'react-native-paper';
import MapView, { Marker } from 'react-native-maps';
import { useAuth } from '@/controllers/hooks/useAuth';
import { useBooking } from '@/controllers/hooks/useBooking';
import { useLocation } from '@/controllers/hooks/useLocation';
import { useNavigation } from '@react-navigation/native';

export const BookRideScreen = () => {
  const { user } = useAuth();
  const { bookRide, loading } = useBooking();
  const { currentLocation, getLocation } = useLocation();
  const navigation = useNavigation();

  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [dropoffCoords, setDropoffCoords] = useState(null);

  useEffect(() => {
    getLocation();
  }, []);

  useEffect(() => {
    if (currentLocation) {
      setPickupAddress(currentLocation.address || 'Current Location');
    }
  }, [currentLocation]);

  const handleBooking = async () => {
    if (!currentLocation || !dropoffCoords) {
      Alert.alert('Error', 'Please select pickup and dropoff locations');
      return;
    }

    try {
      await bookRide(
        user!.id,
        currentLocation,
        { ...dropoffCoords, address: dropoffAddress }
      );
      navigation.navigate('ConfirmBooking');
    } catch (error) {
      Alert.alert('Booking Failed', 'Unable to create booking');
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        region={{
          latitude: currentLocation?.latitude || 13.4,
          longitude: currentLocation?.longitude || 121.8,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05
        }}
      >
        {currentLocation && (
          <Marker
            coordinate={{
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude
            }}
            title="Pickup Location"
            pinColor="green"
          />
        )}
        {dropoffCoords && (
          <Marker
            coordinate={dropoffCoords}
            title="Dropoff Location"
            pinColor="red"
          />
        )}
      </MapView>

      <View style={styles.formContainer}>
        <TextInput
          label="Pickup Location"
          value={pickupAddress}
          disabled
          style={styles.input}
        />
        
        <TextInput
          label="Dropoff Location"
          value={dropoffAddress}
          onChangeText={setDropoffAddress}
          placeholder="Enter destination"
          style={styles.input}
        />

        <Button
          mode="contained"
          onPress={handleBooking}
          loading={loading}
          disabled={loading || !dropoffAddress}
          style={styles.button}
        >
          Book Ride
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  map: {
    flex: 1
  },
  formContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5
  },
  input: {
    marginBottom: 10
  },
  button: {
    marginTop: 10,
    paddingVertical: 5
  }
});
```

#### Driver Dashboard (views/screens/driver/DriverDashboard.tsx)
```typescript
import React, { useEffect } from 'react';
import { View, StyleSheet, Switch } from 'react-native';
import { Text, Card, Button } from 'react-native-paper';
import { useAppSelector, useAppDispatch } from '@/controllers/store';
import { updateDriverStatus } from '@/controllers/slices/driverSlice';
import { useLocation } from '@/controllers/hooks/useLocation';
import { useNavigation } from '@react-navigation/native';

export const DriverDashboard = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  const { user } = useAppSelector(state => state.auth);
  const { currentStatus, dailyEarnings, incomingRequests } = useAppSelector(
    state => state.driver
  );
  const { startWatchingLocation, stopWatchingLocation } = useLocation();

  const isOnline = currentStatus === 'online' || currentStatus === 'on-trip';

  const toggleStatus = async () => {
    const newStatus = isOnline ? 'offline' : 'online';
    await dispatch(updateDriverStatus({ 
      driverId: user!.id, 
      status: newStatus 
    }));

    if (newStatus === 'online') {
      startWatchingLocation(user!.id);
    } else {
      stopWatchingLocation();
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        Driver Dashboard
      </Text>

      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.statusRow}>
            <Text variant="titleMedium">Status:</Text>
            <View style={styles.statusControl}>
              <Text style={styles.statusText}>
                {isOnline ? 'Online' : 'Offline'}
              </Text>
              <Switch value={isOnline} onValueChange={toggleStatus} />
            </View>
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="Today's Earnings" />
        <Card.Content>
          <Text variant="displaySmall" style={styles.earnings}>
            ₱{dailyEarnings.toFixed(2)}
          </Text>
        </Card.Content>
      </Card>

      {incomingRequests.length > 0 && (
        <Card style={styles.card}>
          <Card.Title title="Incoming Requests" />
          <Card.Content>
            <Text>{incomingRequests.length} pending request(s)</Text>
          </Card.Content>
          <Card.Actions>
            <Button onPress={() => navigation.navigate('BookingRequests')}>
              View Requests
            </Button>
          </Card.Actions>
        </Card>
      )}

      <View style={styles.actions}>
        <Button 
          mode="outlined" 
          onPress={() => navigation.navigate('Earnings')}
          style={styles.actionButton}
        >
          Earnings History
        </Button>
        <Button 
          mode="outlined" 
          onPress={() => navigation.navigate('DriverProfile')}
          style={styles.actionButton}
        >
          Profile
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5'
  },
  title: {
    marginBottom: 20,
    fontWeight: 'bold'
  },
  card: {
    marginBottom: 15
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  statusControl: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  statusText: {
    marginRight: 10,
    fontWeight: 'bold'
  },
  earnings: {
    color: '#4CAF50',
    fontWeight: 'bold',
    textAlign: 'center'
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 5
  }
});
```

---

### 3.2 Reusable Components

#### Button Component (views/components/common/Button.tsx)
```typescript
import React from 'react';
import { Button as PaperButton, ButtonProps } from 'react-native-paper';
import { StyleSheet } from 'react-native';

interface CustomButtonProps extends ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline';
}

export const Button: React.FC<CustomButtonProps> = ({ 
  variant = 'primary', 
  style,
  ...props 
}) => {
  const getMode = () => {
    switch (variant) {
      case 'primary':
        return 'contained';
      case 'secondary':
        return 'contained-tonal';
      case 'outline':
        return 'outlined';
      default:
        return 'contained';
    }
  };

  return (
    <PaperButton
      mode={getMode()}
      style={[styles.button, style]}
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 5
  }
});
```

#### Loading Component (views/components/common/Loading.tsx)
```typescript
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';

interface LoadingProps {
  message?: string;
  size?: 'small' | 'large';
}

export const Loading: React.FC<LoadingProps> = ({ 
  message = 'Loading...', 
  size = 'large' 
}) => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} />
      {message && <Text style={styles.text}>{message}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  text: {
    marginTop: 15,
    textAlign: 'center',
    color: '#666'
  }
});
```

#### Booking Card Component (views/components/booking/BookingCard.tsx)
```typescript
import React from 'react';
import { StyleSheet } from 'react-native';
import { Card, Text, Button } from 'react-native-paper';
import { Booking } from '@/models/entities/Booking';

interface BookingCardProps {
  booking: Booking;
  onPress?: () => void;
}

export const BookingCard: React.FC<BookingCardProps> = ({ booking, onPress }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#FFA500';
      case 'accepted':
        return '#2196F3';
      case 'in-transit':
        return '#4CAF50';
      case 'completed':
        return '#757575';
      case 'cancelled':
        return '#F44336';
      default:
        return '#000';
    }
  };

  return (
    <Card style={styles.card} onPress={onPress}>
      <Card.Content>
        <Text variant="labelSmall" style={styles.date}>
          {new Date(booking.created_at).toLocaleDateString()}
        </Text>
        <Text 
          variant="labelMedium" 
          style={[styles.status, { color: getStatusColor(booking.status) }]}
        >
          {booking.status.toUpperCase()}
        </Text>
        <Text variant="bodyMedium" style={styles.location}>
          From: {booking.pickup_location.address}
        </Text>
        <Text variant="bodyMedium" style={styles.location}>
          To: {booking.dropoff_location.address}
        </Text>
        <Text variant="titleMedium" style={styles.fare}>
          ₱{booking.total_fare.toFixed(2)}
        </Text>
      </Card.Content>
      {onPress && (
        <Card.Actions>
          <Button onPress={onPress}>View Details</Button>
        </Card.Actions>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 10
  },
  date: {
    color: '#999',
    marginBottom: 5
  },
  status: {
    fontWeight: 'bold',
    marginBottom: 10
  },
  location: {
    marginBottom: 5
  },
  fare: {
    marginTop: 10,
    fontWeight: 'bold',
    color: '#4CAF50'
  }
});
```

---

### 3.3 Navigation Structure

#### App Navigator (views/navigation/AppNavigator.tsx)
```typescript
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@/controllers/hooks/useAuth';
import { AuthNavigator } from './AuthNavigator';
import { PassengerNavigator } from './PassengerNavigator';
import { DriverNavigator } from './DriverNavigator';
import { AdminNavigator } from './AdminNavigator';

const Stack = createNativeStackNavigator();

export const AppNavigator = () => {
  const { isAuthenticated, user } = useAuth();

  return (
    <NavigationContainer>
      {!isAuthenticated ? (
        <AuthNavigator />
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {user?.user_type === 'passenger' && (
            <Stack.Screen name="Passenger" component={PassengerNavigator} />
          )}
          {user?.user_type === 'driver' && (
            <Stack.Screen name="Driver" component={DriverNavigator} />
          )}
          {user?.user_type === 'admin' && (
            <Stack.Screen name="Admin" component={AdminNavigator} />
          )}
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
};
```

#### Auth Navigator (views/navigation/AuthNavigator.tsx)
```typescript
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '@/views/screens/auth/LoginScreen';
import { RegisterScreen } from '@/views/screens/auth/RegisterScreen';
import { ForgotPasswordScreen } from '@/views/screens/auth/ForgotPasswordScreen';

const Stack = createNativeStackNavigator();

export const AuthNavigator = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="Login" 
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="Register" 
        component={RegisterScreen}
        options={{ title: 'Create Account' }}
      />
      <Stack.Screen 
        name="ForgotPassword" 
        component={ForgotPasswordScreen}
        options={{ title: 'Reset Password' }}
      />
    </Stack.Navigator>
  );
};
```

#### Passenger Navigator (views/navigation/PassengerNavigator.tsx)
```typescript
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PassengerDashboard } from '@/views/screens/passenger/PassengerDashboard';
import { BookRideScreen } from '@/views/screens/passenger/BookRideScreen';
import { ConfirmBookingScreen } from '@/views/screens/passenger/ConfirmBookingScreen';
import { ActiveTripScreen } from '@/views/screens/passenger/ActiveTripScreen';
import { TripHistoryScreen } from '@/views/screens/passenger/TripHistoryScreen';
import { RatingScreen } from '@/views/screens/passenger/RatingScreen';
import { ProfileScreen } from '@/views/screens/shared/ProfileScreen';

const Stack = createNativeStackNavigator();

export const PassengerNavigator = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="PassengerDashboard" 
        component={PassengerDashboard}
        options={{ title: 'Home' }}
      />
      <Stack.Screen 
        name="BookRide" 
        component={BookRideScreen}
        options={{ title: 'Book a Ride' }}
      />
      <Stack.Screen 
        name="ConfirmBooking" 
        component={ConfirmBookingScreen}
        options={{ title: 'Confirm Booking' }}
      />
      <Stack.Screen 
        name="ActiveTrip" 
        component={ActiveTripScreen}
        options={{ title: 'Your Trip' }}
      />
      <Stack.Screen 
        name="TripHistory" 
        component={TripHistoryScreen}
        options={{ title: 'Trip History' }}
      />
      <Stack.Screen 
        name="Rating" 
        component={RatingScreen}
        options={{ title: 'Rate Your Trip' }}
      />
      <Stack.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Stack.Navigator>
  );
};
```

---

### 3.4 Theme Configuration

#### Theme (views/styles/theme.ts)
```typescript
import { MD3LightTheme } from 'react-native-paper';

export const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#2196F3',
    secondary: '#4CAF50',
    tertiary: '#FFA000',
    error: '#F44336',
    background: '#FFFFFF',
    surface: '#F5F5F5',
    onPrimary: '#FFFFFF',
    onSecondary: '#FFFFFF',
    onBackground: '#000000',
    onSurface: '#000000'
  },
  fonts: {
    regular: {
      fontFamily: 'Questrial',
      fontWeight: '400'
    },
    medium: {
      fontFamily: 'Poppins',
      fontWeight: '500'
    },
    bold: {
      fontFamily: 'Poppins',
      fontWeight: '700'
    },
    headlineLarge: {
      fontFamily: 'Poppins',
      fontWeight: '700',
      fontSize: 32
    },
    headlineMedium: {
      fontFamily: 'Poppins',
      fontWeight: '600',
      fontSize: 28
    },
    titleLarge: {
      fontFamily: 'Poppins',
      fontWeight: '600',
      fontSize: 22
    },
    titleMedium: {
      fontFamily: 'Poppins',
      fontWeight: '500',
      fontSize: 16
    },
    bodyLarge: {
      fontFamily: 'Questrial',
      fontWeight: '400',
      fontSize: 16
    },
    bodyMedium: {
      fontFamily: 'Questrial',
      fontWeight: '400',
      fontSize: 14
    },
    labelLarge: {
      fontFamily: 'Poppins',
      fontWeight: '500',
      fontSize: 14
    }
  },
  roundness: 8
};

export const colors = {
  primary: '#2196F3',
  secondary: '#4CAF50',
  accent: '#FFA000',
  background: '#FFFFFF',
  surface: '#F5F5F5',
  text: '#000000',
  textSecondary: '#666666',
  border: '#E0E0E0',
  error: '#F44336',
  success: '#4CAF50',
  warning: '#FFA000',
  info: '#2196F3'
};

export const typography = {
  heading: 'Poppins',
  body: 'Questrial'
};
```

---

## PART 4: DATABASE & BACKEND SPECIFICATION

### 4.1 Supabase Database Schema

#### Users Table Migration (supabase/migrations/001_create_users_table.sql)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('passenger', 'driver', 'admin')),
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  name VARCHAR(255) NOT NULL,
  profile_photo_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  rating DECIMAL(3,2) DEFAULT 0.00,
  total_trips INTEGER DEFAULT 0,
  
  saved_addresses JSONB DEFAULT '[]',
  payment_methods JSONB DEFAULT '[]',
  
  license_number VARCHAR(50),
  license_expiry DATE,
  verification_status VARCHAR(20) CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  vehicle_details JSONB,
  toda_membership VARCHAR(50),
  bank_account JSONB,
  total_earnings DECIMAL(10,2) DEFAULT 0.00,
  completed_trips INTEGER DEFAULT 0,
  current_status VARCHAR(20) DEFAULT 'offline' CHECK (current_status IN ('online', 'offline', 'on-trip')),
  last_location_update TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_user_type ON users(user_type);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_auth_id ON users(auth_id);
CREATE INDEX idx_drivers_current_status ON users(current_status) WHERE user_type = 'driver';
```

#### Bookings Table Migration (supabase/migrations/002_create_bookings_table.sql)
```sql
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES users(id) ON DELETE SET NULL,
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
  base_fare DECIMAL(8,2) NOT NULL,
  per_km_rate DECIMAL(8,2) NOT NULL,
  total_fare DECIMAL(10,2) NOT NULL,
  peak_hour_multiplier DECIMAL(3,2) DEFAULT 1.00,
  payment_method VARCHAR(20) DEFAULT 'cash' CHECK (payment_method IN ('cash', 'gcash', 'paymaya')),
  payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed')),
  passenger_rating JSONB,
  driver_rating JSONB,
  notes TEXT
);

CREATE INDEX idx_bookings_passenger ON bookings(passenger_id);
CREATE INDEX idx_bookings_driver ON bookings(driver_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_created_at ON bookings(created_at DESC);
CREATE INDEX idx_bookings_active ON bookings(status) WHERE status IN ('pending', 'accepted', 'in-transit');
```

#### Driver Locations Table Migration (supabase/migrations/003_create_locations_table.sql)
```sql
CREATE TABLE driver_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  accuracy DECIMAL(5,2),
  timestamp TIMESTAMP DEFAULT NOW(),
  altitude DECIMAL(8,2),
  bearing DECIMAL(5,2)
);

CREATE INDEX idx_driver_locations_driver_id ON driver_locations(driver_id);
CREATE INDEX idx_driver_locations_timestamp ON driver_locations(timestamp DESC);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  read BOOLEAN DEFAULT FALSE,
  sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('passenger', 'driver'))
);

CREATE INDEX idx_messages_booking_id ON messages(booking_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp DESC);

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  passenger_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES users(id) ON DELETE SET NULL,
  passenger_id UUID REFERENCES users(id) ON DELETE SET NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id, read) WHERE read = FALSE;
```

#### Row Level Security Policies (supabase/migrations/004_create_rls_policies.sql)
```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = auth_id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = auth_id);

CREATE POLICY "Admins can view all users"
  ON users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE auth.uid() = auth_id AND user_type = 'admin'
    )
  );

CREATE POLICY "Passengers view own bookings"
  ON bookings FOR SELECT
  USING (
    passenger_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Drivers view assigned bookings"
  ON bookings FOR SELECT
  USING (
    driver_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Passengers create bookings"
  ON bookings FOR INSERT
  WITH CHECK (
    passenger_id IN (SELECT id FROM users WHERE auth_id = auth.uid() AND user_type = 'passenger')
  );

CREATE POLICY "Drivers update assigned bookings"
  ON bookings FOR UPDATE
  USING (
    driver_id IN (SELECT id FROM users WHERE auth_id = auth.uid() AND user_type = 'driver')
  );

CREATE POLICY "Admins view all bookings"
  ON bookings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE auth.uid() = auth_id AND user_type = 'admin'
    )
  );

CREATE POLICY "Drivers update own location"
  ON driver_locations FOR ALL
  USING (
    driver_id IN (SELECT id FROM users WHERE auth_id = auth.uid() AND user_type = 'driver')
  );

CREATE POLICY "All authenticated users view driver locations"
  ON driver_locations FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Booking participants access messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = messages.booking_id
      AND (
        bookings.passenger_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
        OR bookings.driver_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
      )
    )
  );

CREATE POLICY "Booking participants send messages"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = booking_id
      AND (
        bookings.passenger_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
        OR bookings.driver_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
      )
    )
  );

CREATE POLICY "Users view own transactions"
  ON transactions FOR SELECT
  USING (
    passenger_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    OR driver_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Users view own notifications"
  ON notifications FOR SELECT
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));
```

#### Database Functions (supabase/migrations/005_create_functions.sql)
```sql
CREATE OR REPLACE FUNCTION find_nearby_drivers(
  lat DECIMAL,
  lng DECIMAL,
  radius_km DECIMAL
)
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  rating DECIMAL,
  vehicle_details JSONB,
  latitude DECIMAL,
  longitude DECIMAL,
  distance_km DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.name,
    u.rating,
    u.vehicle_details,
    dl.latitude,
    dl.longitude,
    (
      6371 * acos(
        cos(radians(lat)) * 
        cos(radians(dl.latitude)) * 
        cos(radians(dl.longitude) - radians(lng)) + 
        sin(radians(lat)) * 
        sin(radians(dl.latitude))
      )
    ) AS distance_km
  FROM users u
  INNER JOIN driver_locations dl ON u.id = dl.driver_id
  WHERE 
    u.user_type = 'driver'
    AND u.current_status = 'online'
    AND u.verification_status = 'verified'
    AND (
      6371 * acos(
        cos(radians(lat)) * 
        cos(radians(dl.latitude)) * 
        cos(radians(dl.longitude) - radians(lng)) + 
        sin(radians(lat)) * 
        sin(radians(dl.latitude))
      )
    ) <= radius_km
  ORDER BY distance_km ASC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_driver_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE users
    SET 
      completed_trips = completed_trips + 1,
      total_earnings = total_earnings + NEW.total_fare,
      total_trips = total_trips + 1
    WHERE id = NEW.driver_id;

    UPDATE users
    SET total_trips = total_trips + 1
    WHERE id = NEW.passenger_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_driver_stats
AFTER UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION update_driver_stats();
```

---

### 4.2 Supabase Configuration

#### Supabase Client (config/supabase.ts)
```typescript
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});
```

#### Environment Variables (.env)
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
GOOGLE_MAPS_API_KEY=your-google-maps-key
```

---

## PART 5: IMPLEMENTATION TIMELINE

### Phase 1: Foundation Setup (Weeks 1-2)

**Week 1: Development Environment**
- Set up React Native project with TypeScript
- Configure Expo development environment
- Install and configure core dependencies
  - @supabase/supabase-js
  - @react-navigation/native
  - @reduxjs/toolkit
  - react-native-maps
  - react-native-paper
  - expo-font (for custom fonts)
- Install custom fonts
  - Poppins (Regular, Medium, SemiBold, Bold)
  - Questrial (Regular)
- Set up Supabase project
- Configure Android Studio and emulator
- Create project folder structure (MVC pattern)
- Set up version control (Git)
- Configure ESLint and Prettier

**Week 2: Database & Authentication**
- Create Supabase database tables
- Run all migrations (users, bookings, locations, etc.)
- Configure Row Level Security policies
- Set up database functions and triggers
- Implement authentication flow
  - Create AuthService (Model)
  - Create authSlice (Controller)
  - Build Login/Register screens (View)
- Test authentication end-to-end
- Configure Supabase Storage buckets

---

### Phase 2: Core Model Layer (Weeks 3-4)

**Week 3: Entity & Repository Layer**
- Define all TypeScript interfaces
  - User, Passenger, Driver entities
  - Booking, Transaction, Message entities
  - Location and related types
- Implement Repository classes
  - UserRepository with CRUD operations
  - BookingRepository with query methods
  - TransactionRepository
  - MessageRepository
- Write unit tests for repositories
- Implement data validation layer
  - UserValidator
  - BookingValidator
  - FranchiseValidator

**Week 4: Business Logic Services**
- Implement core services
  - BookingService (create, accept, start, complete)
  - FareCalculationService
  - DriverMatchingService
  - LocationService
  - NotificationService
  - RealtimeService
- Write unit tests for all services
- Test service integration with Supabase
- Implement error handling and logging

---

### Phase 3: Controller Layer (Weeks 5-6)

**Week 5: Redux Store Configuration**
- Configure Redux store with middleware
- Create all Redux slices
  - authSlice with async thunks
  - bookingSlice
  - locationSlice
  - driverSlice
  - userSlice
  - notificationSlice
- Implement action creators
- Configure middleware
  - realtimeMiddleware for Supabase subscriptions
  - locationMiddleware for GPS tracking
- Write integration tests for Redux flow

**Week 6: Custom Hooks & Logic**
- Implement custom hooks
  - useAuth
  - useBooking
  - useLocation
  - useRealtime
- Connect hooks to Redux store
- Implement navigation controllers
- Test state management flow
- Optimize performance and memoization

---

### Phase 4: View Layer - Passenger Features (Weeks 7-8)

**Week 7: Passenger Screens**
- Build UI component library
  - Button, Input, Card components
  - Loading, ErrorMessage components
- Implement authentication screens
  - SplashScreen
  - LoginScreen
  - RegisterScreen
- Create passenger screens
  - PassengerDashboard
  - BookRideScreen with map integration
  - ConfirmBookingScreen
- Implement navigation structure
- Apply Material Design theme

**Week 8: Booking Flow Completion**
- Build ActiveTripScreen with real-time tracking
- Implement TripHistoryScreen
- Create RatingScreen
- Build ProfileScreen
- Integrate Google Maps
  - Display markers for pickup/dropoff
  - Show route polylines
  - Real-time driver tracking
- Connect all screens to controllers
- Test end-to-end passenger booking flow

---

### Phase 5: View Layer - Driver Features (Weeks 9-10)

**Week 9: Driver Dashboard & Requests**
- Build DriverDashboard
  - Online/offline status toggle
  - Daily earnings display
  - Incoming requests counter
- Implement BookingRequestScreen
  - Display request details
  - Accept/reject functionality
  - Countdown timer
- Create DriverTripScreen
  - Navigation to pickup
  - Trip tracking
  - Complete trip action
- Implement GPS location tracking
- Test driver notification system

**Week 10: Driver Earnings & Profile**
- Build EarningsScreen
  - Daily/weekly/monthly breakdown
  - Trip history with earnings
  - Charts and statistics
- Create DriverProfileScreen
  - Vehicle information
  - License details
  - Rating and reviews
- Implement real-time location updates
- Test driver workflow end-to-end
- Optimize battery usage for GPS tracking

---

### Phase 6: Admin & Franchise Module (Weeks 11-12)

**Week 11: Admin Dashboard**
- Build AdminDashboard
  - Real-time booking monitor
  - Active drivers map view
  - System statistics
- Create UserManagementScreen
  - View all users
  - Search and filter
  - Activate/deactivate accounts
- Implement BookingMonitorScreen
  - Live booking tracking
  - Transaction details
- Build ReportsScreen
  - Generate reports
  - Export data
- Add admin-specific RLS policies

**Week 12: Franchise Management**
- Define franchise entity and types
- Create FranchiseRepository
- Implement FranchiseService
- Build FranchiseApplicationScreen
  - Document upload
  - Application form
- Create FranchiseManagementScreen (admin)
  - Review applications
  - Approve/reject
  - Issue MTOP
- Implement document verification flow
- Test franchise module end-to-end

---

### Phase 7: Real-time Features & Communication (Week 13)

**Week 13: Real-time Integration**
- Set up Supabase Realtime subscriptions
  - Booking status updates
  - Driver location updates
  - New message notifications
- Implement in-app messaging
  - MessageService
  - Chat interface
  - Message history
- Build NotificationsScreen
  - List all notifications
  - Mark as read
  - Navigate to related content
- Integrate push notifications (if time permits)
- Test all real-time features
- Optimize subscription management

---

### Phase 8: Testing & Optimization (Week 14)

**Week 14: Comprehensive Testing**
- Unit tests for all Model layer components
- Integration tests for Controllers
- UI tests for View components
- End-to-end testing
  - Complete passenger booking flow
  - Complete driver acceptance flow
  - Admin monitoring workflow
- Performance testing
  - App startup time
  - Location update frequency
  - Memory usage monitoring
- Security testing
  - RLS policy verification
  - Input validation
  - Authentication flow
- Bug fixes and refinements

---

### Phase 9: Payment & Additional Features (Week 15)

**Week 15: Payment Integration**
- Build PaymentService (Model)
- Create paymentSlice (Controller)
- Implement PaymentScreen (View)
  - Select payment method
  - Display fare breakdown
  - Generate receipt
- Build TransactionRepository
- Create transaction history view
- Implement receipt generation
- Add cash payment confirmation flow
- Prepare for future GCash/PayMaya integration
- Test payment flows

---

### Phase 10: Final Polish & Deployment (Week 16)

**Week 16: Deployment Preparation**
- Code review and refactoring
- Performance optimization
  - Code splitting
  - Image optimization
  - Database query optimization
- Final security audit
- Update documentation
  - User manual
  - Developer documentation
  - API documentation
- Build Android APK
- Test on multiple devices
- Prepare for production deployment
- Create deployment checklist
- Final acceptance testing

---

## PART 6: TESTING STRATEGY

### Unit Testing

**Model Layer Tests**
```typescript
// Example: FareCalculationService.test.ts
import { FareCalculationService } from '@/models/services/FareCalculationService';

describe('FareCalculationService', () => {
  let service: FareCalculationService;

  beforeEach(() => {
    service = new FareCalculationService();
  });

  test('calculates fare correctly without peak hour', () => {
    const fare = service.calculateFare(5, 50, 15, 1.0);
    expect(fare).toBe(125);
  });

  test('calculates fare correctly with peak hour multiplier', () => {
    const fare = service.calculateFare(5, 50, 15, 1.5);
    expect(fare).toBe(187.5);
  });

  test('calculates distance between two coordinates', async () => {
    const pickup = { latitude: 13.4, longitude: 121.8, address: 'Point A' };
    const dropoff = { latitude: 13.5, longitude: 121.9, address: 'Point B' };
    const distance = await service.calculateDistance(pickup, dropoff);
    expect(distance).toBeGreaterThan(0);
  });
});
```

**Controller Layer Tests**
```typescript
// Example: bookingSlice.test.ts
import bookingReducer, { createBooking } from '@/controllers/slices/bookingSlice';

describe('bookingSlice', () => {
  test('should handle initial state', () => {
    expect(bookingReducer(undefined, { type: 'unknown' })).toEqual({
      currentBooking: null,
      bookingHistory: [],
      loading: false,
      error: null,
      searchingForDriver: false
    });
  });

  test('should handle createBooking.pending', () => {
    const state = bookingReducer(undefined, createBooking.pending);
    expect(state.loading).toBe(true);
    expect(state.searchingForDriver).toBe(true);
  });
});
```

### Integration Testing

Test complete workflows:
- User registration → Login → Create booking → Driver accepts → Complete trip
- Driver goes online → Receives request → Accepts → Navigates → Completes
- Admin views bookings → Manages users → Generates reports

### Performance Benchmarks

- App cold start: < 3 seconds
- Booking creation: < 2 seconds
- Location update: Every 5 seconds
- Real-time updates: < 1 second latency
- Memory usage: < 150MB during active use

---

## PART 7: DEPLOYMENT CHECKLIST

### Pre-Deployment

- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Performance benchmarks met
- [ ] Security audit completed
- [ ] RLS policies verified
- [ ] Environment variables configured
- [ ] API keys secured
- [ ] Database migrations run
- [ ] Storage buckets configured
- [ ] Error logging set up

### Build Configuration

- [ ] Update app version in package.json
- [ ] Configure Android build.gradle
- [ ] Set minSdkVersion to 26
- [ ] Set targetSdkVersion to latest
- [ ] Configure signing keys
- [ ] Optimize assets and images
- [ ] Enable ProGuard/R8
- [ ] Test release build

### Deployment

- [ ] Build signed APK
- [ ] Test APK on multiple devices
- [ ] Prepare Play Store listing
- [ ] Upload screenshots and assets
- [ ] Write app description
- [ ] Set up Google Play Console
- [ ] Submit for review
- [ ] Plan phased rollout

### Post-Deployment

- [ ] Monitor error logs
- [ ] Track user adoption
- [ ] Collect user feedback
- [ ] Monitor system performance
- [ ] Plan feature updates
- [ ] Maintain documentation

---

## SUMMARY

This implementation plan follows strict MVC architecture:

**Model (Data & Business Logic):**
- Entities define data structures
- Repositories handle database operations
- Services implement business rules
- Validators ensure data integrity
- Complete separation from UI

**Controller (Application Logic):**
- Redux manages application state
- Slices handle state updates
- Custom hooks provide clean API to Views
- Middleware coordinates real-time updates
- No direct database access

**View (User Interface):**
- Screens present data
- Components are purely presentational
- No business logic in UI
- All state from Redux via hooks
- Clean, maintainable code

**Key Principles:**
- Separation of concerns
- Single responsibility
- Testability at every layer
- Scalable architecture
- Type-safe with TypeScript
- Real-time capabilities via Supabase
- Performance optimized
- Security hardened with RLS

The 16-week timeline provides sufficient time for thorough development, testing, and deployment of a production-ready mobile TODA booking system.
