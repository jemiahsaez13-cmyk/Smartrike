import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { getCurrentLocation, updateDriverLocation, setWatchId, clearWatchId } from '../slices/locationSlice';
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
      const watchId = await locationService.watchPosition((location) => {
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
