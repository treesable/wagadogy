import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { isRefreshTokenError, handleRefreshTokenError } from '@/utils/authUtils';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signUpDev: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateUserProfile: (updates: { 
    full_name?: string; 
    phone?: string; 
    avatar_url?: string;
    date_of_birth?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    bio?: string;
    preferences?: any;
  }) => Promise<{ error: any }>;
  supabase: SupabaseClient;
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

export const [AuthProvider, useAuth] = createContextHook((): AuthContextType => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        console.error('Error getting session:', error);
        // If there's an error getting the session (like invalid refresh token),
        // clear the stored session and redirect to login
        if (isRefreshTokenError(error)) {
          console.log('Invalid refresh token detected, clearing session...');
          await handleRefreshTokenError(supabase);
          setSession(null);
          setUser(null);
        }
      } else {
        setSession(session);
        setUser(session?.user ?? null);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.email || 'no user');
      
      // Handle token refresh errors
      if (event === 'TOKEN_REFRESHED' && !session) {
        console.log('Token refresh failed, signing out...');
        supabase.auth.signOut();
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Handle deep linking for mobile
    if (Platform.OS !== 'web') {
      const handleDeepLink = (url: string) => {
        console.log('Deep link received:', url);
        // Handle the deep link URL here if needed
      };

      const subscription2 = Linking.addEventListener('url', ({ url }) => {
        handleDeepLink(url);
      });

      return () => {
        subscription.unsubscribe();
        subscription2?.remove();
      };
    }

    return () => subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    try {
      console.log('Starting signup process for:', email);
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: Platform.OS === 'web' 
            ? `${window.location.origin}/auth/callback` 
            : 'myapp://auth/callback'
        }
      });
      
      console.log('SignUp response:', { 
        user: data?.user ? { id: data.user.id, email: data.user.email, confirmed: data.user.email_confirmed_at } : null, 
        session: data?.session ? 'exists' : null,
        error: error ? { message: error.message, status: error.status } : null 
      });
      
      // If there's an error, return it
      if (error) {
        console.error('SignUp error:', error);
        return { error };
      }
      
      // If user is returned but not confirmed, that's expected for email confirmation flow
      if (data.user && !data.user.email_confirmed_at) {
        console.log('User created successfully, email confirmation required');
        return { error: null };
      }
      
      // If user is confirmed immediately (shouldn't happen with email confirmation enabled)
      if (data.user && data.user.email_confirmed_at) {
        console.log('User created and confirmed immediately');
        return { error: null };
      }
      
      return { error: null };
    } catch (err) {
      console.error('SignUp catch error:', err);
      return { error: err };
    }
  }, []);

  // Development signup without email confirmation
  const signUpDev = useCallback(async (email: string, password: string) => {
    try {
      console.log('Starting dev signup process for:', email);
      
      // First try to sign up normally
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      
      console.log('SignUpDev response:', { 
        user: data?.user ? { id: data.user.id, email: data.user.email, confirmed: data.user.email_confirmed_at } : null, 
        session: data?.session ? 'exists' : null,
        error: error ? { message: error.message, status: error.status } : null 
      });
      
      if (error) {
        console.error('SignUpDev error:', error);
        return { error };
      }
      
      // If signup was successful, immediately try to sign in
      // This works if email confirmation is disabled in Supabase
      console.log('Attempting auto sign-in after signup');
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (signInError) {
        console.log('Auto sign-in failed, user needs to confirm email:', signInError);
        return { error: null }; // Still return success for signup
      }
      
      console.log('User signed up and signed in successfully:', {
        user: signInData?.user ? { id: signInData.user.id, email: signInData.user.email } : null,
        session: signInData?.session ? 'exists' : null
      });
      return { error: null };
    } catch (err) {
      console.error('SignUpDev catch error:', err);
      return { error: err };
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      // If there's a refresh token error, clear storage and try again
      if (error && isRefreshTokenError(error)) {
        console.log('Refresh token error during sign in, clearing storage...');
        await handleRefreshTokenError(supabase);
        
        // Try signing in again after clearing
        const { error: retryError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        return { error: retryError };
      }
      
      return { error };
    } catch (err) {
      console.error('SignIn error:', err);
      return { error: err };
    }
  }, []);

  const signOut = useCallback(async () => {
    // Clear all local storage data before signing out
    await AsyncStorage.multiRemove([
      'userProfile',
      'matches',
      'conversations',
      'walkingStats',
      'dailyStats',
      'scheduledWalks'
    ]);
    await supabase.auth.signOut();
  }, []);

  const updateUserProfile = useCallback(async (updates: { 
    full_name?: string; 
    phone?: string; 
    avatar_url?: string;
    date_of_birth?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    bio?: string;
    preferences?: any;
  }) => {
    if (!user) {
      return { error: { message: 'No user logged in' } };
    }

    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        id: user.id,
        email: user.email!,
        ...updates,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'id'
      });

    return { error };
  }, [user]);

  return useMemo(() => ({
    user,
    session,
    loading,
    signUp,
    signUpDev,
    signIn,
    signOut,
    updateUserProfile,
    supabase,
  }), [user, session, loading, signUp, signUpDev, signIn, signOut, updateUserProfile]);
});