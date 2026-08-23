# Smart Trike - Mobile TODA Booking System

A mobile application for booking tricycle rides in Boac, Marinduque following strict MVC architecture.

> ✅ **Supabase migrated:** the app targets project `tvvfauetrcnxmtgvvshr`,
> with database migrations `001` through `036` applied on 2026-08-23. See
> [`supabase/migrations/README.md`](supabase/migrations/README.md).

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
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_maps_key
\`\`\`

Only the publishable Supabase key belongs in the Expo app. Never put a secret
or service-role key in an `EXPO_PUBLIC_*` variable or commit one to the repo.

### Authentication setup

Email confirmation and password recovery use 6-digit Supabase Auth email OTPs.
The hosted project's confirmation and recovery email templates must include
`{{ .Token }}`, email confirmation must remain enabled, and the OTP expiry is
configured to 10 minutes. Supabase invalidates a code after successful use or
when a replacement code is issued.

Hosted free-tier projects using Supabase's default sender do not allow custom
OTP templates. Configure a production SMTP provider using server-side secrets,
then apply the templates without exposing any credential to Expo:

```powershell
$env:SUPABASE_ACCESS_TOKEN="your-personal-access-token"
$env:SUPABASE_PROJECT_REF="your-project-ref"
$env:AUTH_SMTP_HOST="smtp.example.com"
$env:AUTH_SMTP_PORT="587"
$env:AUTH_SMTP_USER="smtp-user"
$env:AUTH_SMTP_PASSWORD="smtp-password"
$env:AUTH_SMTP_SENDER_EMAIL="no-reply@example.com"
$env:AUTH_SMTP_SENDER_NAME="Smart Trike"
npm run auth:configure-email
```

Create or rotate the administrator account from a secure shell environment:

```powershell
$env:SUPABASE_URL="https://your-project.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
$env:ADMIN_INITIAL_PASSWORD="a-unique-strong-password"
npm run auth:bootstrap-admin
```

The bootstrap secret and initial password are server-side only. Never add them
to Expo configuration, client source, browser logs, or version control. Change
the initial password after the first administrator login.

3. Download and place fonts in `assets/fonts/`:
   - Poppins (Regular, Medium, SemiBold, Bold)
   - Questrial (Regular)

4. Create placeholder images in `assets/`:
   - icon.png (1024x1024)
   - splash.png (1284x2778)
   - adaptive-icon.png (1024x1024)

5. Set up Supabase:
   - Run migrations in `supabase/migrations/` **in numeric order (001 → 035)**
   - See [`supabase/migrations/README.md`](supabase/migrations/README.md) for how
     to apply and verify them

6. Start the app:
\`\`\`bash
npm start
\`\`\`

## Features

- **Passenger**: Exact/default pickup pins, group booking (up to 5), automatic fares, cash payment, assigned body/franchise status, trip tracking and history
- **Driver**: Accept bookings, track earnings, manage status
- **Admin**: Monitor bookings/users, manage franchise lifecycle and agreements, association inventory, violations, and generated reports
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
