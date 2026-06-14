import { combineReducers } from '@reduxjs/toolkit';
import authReducer from '../slices/authSlice';
import bookingReducer from '../slices/bookingSlice';
import userReducer from '../slices/userSlice';
import locationReducer from '../slices/locationSlice';
import driverReducer from '../slices/driverSlice';
import notificationReducer from '../slices/notificationSlice';
import paymentReducer from '../slices/paymentSlice';
import franchiseReducer from '../slices/franchiseSlice';

const rootReducer = combineReducers({
  auth: authReducer,
  booking: bookingReducer,
  user: userReducer,
  location: locationReducer,
  driver: driverReducer,
  notification: notificationReducer,
  payment: paymentReducer,
  franchise: franchiseReducer
});

export default rootReducer;
