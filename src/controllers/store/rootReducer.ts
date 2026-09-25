import { combineReducers, UnknownAction } from '@reduxjs/toolkit';
import authReducer from '../slices/authSlice';
import bookingReducer from '../slices/bookingSlice';
import userReducer from '../slices/userSlice';
import locationReducer from '../slices/locationSlice';
import driverReducer from '../slices/driverSlice';
import notificationReducer from '../slices/notificationSlice';
import paymentReducer from '../slices/paymentSlice';
import franchiseReducer from '../slices/franchiseSlice';

const appReducer = combineReducers({
  auth: authReducer,
  booking: bookingReducer,
  user: userReducer,
  location: locationReducer,
  driver: driverReducer,
  notification: notificationReducer,
  payment: paymentReducer,
  franchise: franchiseReducer
});

type AppState = ReturnType<typeof appReducer>;

// Logging out (or the session expiring) wipes every slice, so the next account
// on this device never sees the previous user's ride, trip, payments or MTOP.
const rootReducer = (state: AppState | undefined, action: UnknownAction): AppState => {
  if (action.type === 'auth/signOut/fulfilled' || action.type === 'auth/sessionEnded') {
    return appReducer(undefined, action);
  }
  return appReducer(state, action);
};

export default rootReducer;
