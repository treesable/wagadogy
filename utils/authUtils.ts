import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Clears all authentication-related data from AsyncStorage
 * This should be called when refresh token errors occur
 */
export const clearAuthData = async (): Promise<void> => {
  try {
    await AsyncStorage.multiRemove([
      'userProfile',
      'matches',
      'conversations',
      'walkingStats',
      'dailyStats',
      'scheduledWalks',
      // Clear Supabase auth keys as well
      'sb-jzxabzfkvckivngombxu-auth-token',
      'supabase.auth.token',
      // Clear any other potential auth keys
      'sb-auth-token',
      'supabase-auth-token'
    ]);
    console.log('Auth data cleared successfully');
  } catch (error) {
    console.error('Error clearing auth data:', error);
  }
};

/**
 * Checks if an error is related to refresh token issues
 */
export const isRefreshTokenError = (error: any): boolean => {
  if (!error || !error.message) return false;
  
  const message = error.message.toLowerCase();
  return (
    message.includes('refresh_token_not_found') ||
    message.includes('invalid refresh token') ||
    message.includes('refresh token not found') ||
    message.includes('jwt expired')
  );
};

/**
 * Handles refresh token errors by clearing data and signing out
 */
export const handleRefreshTokenError = async (supabase: any): Promise<void> => {
  console.log('Handling refresh token error...');
  await clearAuthData();
  await supabase.auth.signOut();
};