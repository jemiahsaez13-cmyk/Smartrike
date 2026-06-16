# Smart Trike — Remaining Work / Gap Analysis

*As of:* 2026-06-15
*Backend mode:* Real Supabase (migration 008 applied; profiles via DB trigger)
*Status legend:* 🔴 Missing · 🟡 Partial / not wired · 🟢 Works (noted for context)

This document compares the implemented app against `docs/Smart_Trike_Features.md` and
lists what is still *kulang (missing)* or incomplete, with enough detail to act on.
Items are ordered roughly by impact on a working demo.

---

## 1. Real-time GPS tracking — 🔴 not wired
*Spec:* Modules 3 & Key Feature 1 — driver location updates every 5s, passenger
tracks the driver moving to the pickup, live ETA, polyline of the route.

*Current state:*
- `LocationService.watchPosition()` and `updateDriverLocation()` exist.
- `useLocation().startWatchingLocation()` exists and would write to `driver_locations`.
- `RealtimeService.subscribeToDriverLocation()` exists.
- *But none of these are ever called by a screen.* `useLocation` is only used by
  `BookRideScreen` for a one-time `getLocation()`.

*What's missing:*
- Driver app never streams its position → `driver_locations` stays empty for live drivers.
- `ActiveTripScreen` (passenger) and `DriverTripScreen` never subscribe to driver
  location, so there is no moving driver marker or live ETA.
- Proximity matching (`DriverMatchingService` / `find_nearby_drivers`) has no fresh
  coordinates to work with.

*To do:*
1. Call `startWatchingLocation(user.id)` when a driver goes *online* (in
   `DriverDashboard.toggleStatus`) and `stopWatchingLocation()` when offline / on app exit.
2. In `ActiveTripScreen`, call `subscribeToDriverLocation(driverId, cb)` and render the
   driver marker + recompute ETA from the live coords.
3. Confirm the `driver_locations` RLS update policy works for the streaming driver
   (it does after migration 004/008), and that the table is in the realtime publication
   (done in 008).

---

## 2. Driver discovery is poll-once, not real-time push — 🟡 partial
*Spec:* Module 1.4 / Driver flow — drivers get an *instant* notification of a new
booking; notify nearby drivers within radius; first to accept wins.

*Current state:*
- When a driver toggles *online*, `DriverDashboard` calls `findActiveBookings()` *once*
  and lists pending requests. New bookings created after that are not pushed.
- `notifyDrivers()` can't read the driver list as a passenger (RLS limits users to own
  row), so the proximity-notify path inserts nothing in practice.

*What's missing:*
- A realtime subscription on `bookings` INSERT (status = pending) for online drivers so
  new requests appear without re-toggling.
- Sound/vibration alert on a new request.

*To do:*
- Add a `subscribeToNewBookings(cb)` in `RealtimeService` (channel on `bookings`,
  event: 'INSERT') and use it in `DriverDashboard` / `BookingRequestScreen` while online.

---

## 3. Push notifications (FCM / device) — 🔴 missing
*Spec:* Real-Time Notification System — push notifications with sound + vibration,
delivered even when the app is backgrounded.

*Current state:* Only *in-app* notifications (DB `notifications` table +
`NotificationsScreen`, fetched once on open). No device push.

*What's missing:*
- `expo-notifications` is not installed; no push token registration, no handlers.
- `NotificationsScreen` is not realtime (doesn't subscribe to new rows).

*To do:*
- Add `expo-notifications`, register for a push token, store it on the user, send via an
  Edge Function / server. At minimum, subscribe `NotificationsScreen` to realtime inserts.

---

## 4. In-app messaging / chat — 🔴 no UI
*Spec:* Messaging & Communication — passenger ⇄ driver chat, message history,
realtime delivery; call integration.

*Current state:* `MessageService`, `MessageRepository`, the `messages` table and its RLS
(insert policy added in 008) all exist. *No screen uses them* — there is no chat screen.

*What's missing:*
- A `ChatScreen` reachable from `ActiveTripScreen` / `DriverTripScreen`.
- Realtime subscription to messages for the active `booking_id`.
- Click-to-call button using `Linking.openURL('tel:…')`.

---

## 5. Social login (Google) — 🟡 stub
*Spec:* Social media login options.

*Current state:* `GoogleAuth` component exists, but the **"Google" button on
`LoginScreen` has no `onPress`** — tapping it does nothing.

*To do:* Wire Supabase OAuth (`supabase.auth.signInWithOAuth({ provider: 'google' })`)
with an Expo redirect, or remove the button to avoid a dead control.

---

## 6. Phone / OTP login & password reset — 🟡 needs provider config
*Spec:* Register/login with phone; password recovery.

*Current state:* `PhoneLoginScreen`, `OTPVerificationScreen`, `ForgotPasswordScreen` and
the corresponding `AuthService` methods exist and are wired.

*What's missing (config, not code):*
- Supabase *SMS provider* (e.g. Twilio) must be configured for phone OTP to actually send.
- Password reset emails require the email template + redirect URL set in the dashboard.
- The phone-OTP path assumes a profile already exists for that phone number.

---

## 7. Document & photo uploads (Supabase Storage) — 🔴 missing
*Spec:* Driver registration uploads (license, OR/CR, proof of ownership); MTOP document
submission; profile photo. Storage buckets `users_profiles/`, `driver_documents/`,
`franchise_documents/`, `receipts/`.

*Current state:* Driver registration collects text fields only. `documents` on a
franchise application is a checklist of names with an `uploaded` boolean — **no real file
upload**. No profile photo upload (`profile_photo_url` always null).

*What's missing:*
- `expo-image-picker` / document picker (not installed).
- Storage buckets + upload calls + storage RLS policies.

---

## 8. Maps & navigation (Google Maps API) — 🟡 placeholder
*Spec:* React Native Maps, real tiles, Distance Matrix + Directions API, turn-by-turn,
traffic, route polyline.

*Current state:*
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` is the literal placeholder `your-google-maps-key`, so
  native Google tiles won't authenticate; web uses a faux-map fallback.
- Distance is *Haversine* (`FareCalculationService.calculateDistance`), not the Google
  Distance Matrix; ETA is a straight-line estimate. Destinations are a fixed hard-coded
  list (`DESTINATIONS`) — no address search / autocomplete.

*To do:* Add a real Maps key + restrict it; (optional) integrate Places autocomplete and
Directions for accurate distance/route.

---

## 9. Admin module — 🟡 mostly read-only
*Spec:* Module 3 — activate/deactivate accounts, manage roles, handle complaints,
booking monitoring, reports/export.

*Current state:*
- `FranchiseManagementScreen` *can* advance applications (`advanceApplication`) — 🟢.
- `UserManagementScreen` lists users but has *no activate/deactivate/role actions* wired.
- `AnalyticsScreen` / `SystemHealthScreen` / `ActivityLogsScreen` display data; verify
  reports are computed from real rows and that CSV/PDF *export* (spec) exists
  (`ExportService` is present — confirm it's reachable from the UI).

*To do:* Add `UserRepository.update(status)` actions (suspend/activate) to
`UserManagementScreen`; wire export buttons; confirm admin RLS lets these run (admin
policies fixed in 008).

---

## 10. Payments — 🟢 cash only (by design)
*Spec note:* Cashless integration is explicitly *out of scope* ("basic payment only").
GCash/PayMaya appear as selectable options but there is no gateway — this matches the
documented scope. `transactions` table now exists (added in 008). Receipt is on-screen
only (no PDF/share export yet).

---

## 11. Demo "QUICK ACCESS" buttons vs real backend — 🟡 known limitation
The Login screen's passenger/driver/admin quick-login dispatches fake users
(`demo-passenger`, etc.) that *don't exist in the real database*. They log in but show
empty dashboards and booking inserts fail RLS. *Decide:* remove them, or seed matching
real accounts.

---

## 12. Dependency versions — 🟡 mismatched for Expo SDK 54
`expo export` warns that many packages are off the versions expected by SDK 54
(`react-native`, `react-native-maps`, `react-native-screens`, `expo-*`, `@types/react`,
etc.). The app bundles, but this can cause subtle native/runtime issues. Run
`npx expo install --fix` and re-test.

---

## 13. Testing — 🔴 none
*Spec:* Jest unit tests, integration tests, RN Testing Library UI tests. No test files or
test runner are configured.

---

## Pending configuration (your action, no code)
- [ ] Supabase Dashboard → *Authentication → Email → "Confirm email" OFF* (or keep the
      email-confirmation flow the app already supports).
- [ ] Add a real *Google Maps API key* to `.env` if native maps are required.
- [ ] Configure an *SMS provider* if phone OTP login is required.
- [ ] Do one real *register → login → book → accept → complete* round-trip to confirm.

---

## Suggested priority for a working capstone demo
1. Driver live location streaming + passenger tracking (#1)
2. Realtime new-booking push to drivers (#2)
3. Decide on demo buttons (#11) and fix the dead Google button (#5)
4. `npx expo install --fix` (#12)
5. In-app chat (#4) and document uploads (#7) if required by the rubric
