import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { getCurrentLocation, updateDriverLocation } from '../slices/locationSlice';
import { LocationService } from '@/models/services/LocationService';

const locationService = new LocationService();

export const useLocation = () => {
  const dispatch = useAppDispatch();
  const { currentLocation, driverLocation, loading, error } = useAppSelector(state => state.location);

  const getLocation = useCallback(async () => {
    return dispatch(getCurrentLocation()).unwrap();
  }, [dispatch]);

  const startWatchingLocation = useCallback(
    async (driverId: string) => {
      // Streams the driver's position to `driver_locations` every ~5s so
      // passengers can track them live. Returns false if permission denied.
      return locationService.startWatching((location) => {
        dispatch(updateDriverLocation({ driverId, location }));
      });
    },
    [dispatch]
  );

  const stopWatchingLocation = useCallback(() => {
    locationService.stopWatching();
  }, []);

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
