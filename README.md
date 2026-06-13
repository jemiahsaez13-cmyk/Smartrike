# Smart Trike - Mobile TODA Booking System

A mobile application for booking tricycle rides in Boac, Marinduque following strict MVC architecture.

## Architecture

### Model Layer (Data & Business Logic)
- **Entities**: TypeScript interfaces defining data structures
- **Repositories**: Data access layer interfacing with Supabase
- **Services**: Business logic (Auth, Booking, Fare Calculation, Location, Notifications, Realtime)
- **Validators**: Input validation

### Controller Layer (Application Logic)
- **Redux Store**: Centralized state management
- **Slices**: State reducers (auth, booking, location, driver)
- **Hooks**: Custom React hooks (useAuth, useBooking, useLocation)
- **Middleware**: Real-time and location tracking

### View Layer (User Interface)
- **Screens**: Auth, Passenger, Driver, Admin screens
- **Components**: Reusable UI components with loading states (image placeholders)
- **Navigation**: Stack-based navigation
- **Theme**: Material Design with custom fonts

## Setup

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Set up environment variables in `.env`:
\`\`\`
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_maps_key
\`\`\`

3. Download and place fonts in `assets/fonts/`:
   - Poppins (Regular, Medium, SemiBold, Bold)
   - Questrial (Regular)

4. Create placeholder images in `assets/`:
   - icon.png (1024x1024)
   - splash.png (1284x2778)
   - adaptive-icon.png (1024x1024)

5. Set up Supabase:
   - Run migrations in `supabase/migrations/`
   - Execute SQL files in order (001-005)

6. Start the app:
\`\`\`bash
npm start
\`\`\`

## Features

- **Passenger**: Book rides, track trips, view history
- **Driver**: Accept bookings, track earnings, manage status
- **Admin**: Monitor bookings, manage users
- **Real-time**: Live location tracking, booking updates
- **Loading States**: Image placeholders during data loading

## Tech Stack

- React Native + Expo
- TypeScript
- Redux Toolkit
- Supabase (PostgreSQL, Auth, Realtime)
- React Native Paper (Material Design)
- React Navigation
- Expo Location
