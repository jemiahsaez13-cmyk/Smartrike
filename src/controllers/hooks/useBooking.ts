import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { createBooking, acceptBooking, startTrip, completeTrip, cancelBooking } from '../slices/bookingSlice';
import { Location } from '@/models/types';

export const useBooking = () => {
  const dispatch = useAppDispatch();
  const { currentBooking, loading, error, searchingForDriver } = useAppSelector(state => state.booking);

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
