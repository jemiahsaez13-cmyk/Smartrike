# Smart Trike — Project Completion Plan

## Current State
The project is a React Native / Expo mobile app using Redux Toolkit + Supabase.
The core architecture (MVC), design system, and primary screens are built.
What remains is completing the missing screens, model layer gaps, and wiring everything together.

---

## What EXISTS (done)
| Area | Files |
|---|---|
| Auth Screens | LoginScreen, EmailLoginScreen, PhoneLoginScreen, RegisterScreen, PassengerRegisterScreen, DriverRegisterScreen, ForgotPasswordScreen, OTPVerificationScreen, EmailRegisterScreen |
| Passenger Screens | PassengerDashboard, BookRideScreen, ConfirmBookingScreen, ActiveTripScreen, TripHistoryScreen |
| Driver Screens | DriverDashboard, BookingRequestScreen, FranchiseScreen |
| Admin Screens | AdminDashboard, UserManagementScreen, ActivityLogsScreen, FranchiseManagementScreen, SystemHealthScreen, AnalyticsScreen |
| Shared Screens | ProfileScreen |
| State (Redux) | authSlice, bookingSlice, driverSlice, locationSlice, notificationSlice, paymentSlice, userSlice, franchiseSlice |
| Model Entities | User, Booking, Transaction, Message, Franchise, ActivityLog, Notification |
| Repositories | UserRepository, BookingRepository |
| Services | AuthService, BookingService, FareCalculationService, LocationService, NotificationService, RealtimeService, FranchiseService, ActivityLogService, ExportService |
| Validators | UserValidator, BookingValidator |
| Navigation | AppNavigator, AuthNavigator, PassengerNavigator, DriverNavigator, AdminNavigator |
| Config | supabase.ts, maps.ts, mockData.ts, mockSupabase.ts |
| Design System | theme.ts (Uber-style: black/green/blue, Poppins font) |

---

## What's MISSING (to build)

### Screens
| Screen | Priority | Description |
|---|---|---|
| `SplashScreen.tsx` | HIGH | Animated brand splash before auth check |
| `DriverTripScreen.tsx` | HIGH | Driver active trip: pickup → dropoff navigation flow |
| `EarningsScreen.tsx` | HIGH | Driver detailed earnings: daily/weekly/monthly breakdowns |
| `NotificationsScreen.tsx` | HIGH | In-app notification center for all user types |
| `SettingsScreen.tsx` | MEDIUM | App preferences: theme, language, push notification toggles |
| `PaymentScreen.tsx` | MEDIUM | Payment method management and transaction history |

### Model Layer
| File | Purpose |
|---|---|
| `MessageRepository.ts` | CRUD for in-app messages |
| `TransactionRepository.ts` | CRUD for payment transactions |
| `FranchiseRepository.ts` | CRUD for franchise/MTOP applications |
| `DriverMatchingService.ts` | Nearby-driver lookup + ranking algorithm |
| `MessageService.ts` | Send/receive in-booking messages |
| `PaymentService.ts` | Transaction creation and receipt logic |
| `FranchiseValidator.ts` | Franchise application validation rules |

### Utilities & Config
| File | Purpose |
|---|---|
| `src/utils/dateUtils.ts` | Relative dates, date formatting, duration helpers |
| `src/utils/locationUtils.ts` | Haversine distance, coordinate formatting |
| `src/utils/validationUtils.ts` | PH phone, email, plate number regex helpers |
| `src/config/constants.ts` | App-wide constants (fare rates, map bounds, timeouts) |

### Navigator Wiring
| Navigator | Missing Routes |
|---|---|
| PassengerNavigator | NotificationsScreen, SettingsScreen, PaymentScreen |
| DriverNavigator | DriverTripScreen, EarningsScreen, NotificationsScreen, SettingsScreen |
| AdminNavigator | NotificationsScreen, SettingsScreen |

---

## Implementation Order

1. `config/constants.ts` + `utils/*.ts` — foundation helpers, no deps
2. Model repositories (MessageRepository, TransactionRepository, FranchiseRepository)
3. Model services (DriverMatchingService, MessageService, PaymentService)
4. FranchiseValidator
5. All 6 missing screens (matching existing Uber-style design system)
6. Navigator updates to wire all new screens in

---

## Design Standards to Follow
- **Color palette**: Uber Black `#000000`, Uber Green `#06C167`, Uber Blue `#276EF1`
- **Typography**: Poppins Bold headings, Questrial body text
- **Card style**: `Card` component from `@/views/components/common/Card`
- **Gradients**: `gradients.brand` (dark → black), `gradients.accent` for CTAs
- **Spacing**: `spacing.screen` side padding (20px), `spacing.lg` gaps
- **Animations**: Animated.spring entry (translateY 20→0, opacity 0→1)
- **Icons**: `@expo/vector-icons` → `MaterialCommunityIcons`
