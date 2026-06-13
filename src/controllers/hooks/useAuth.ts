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
