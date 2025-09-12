import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { router, useSegments } from 'expo-router';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const root = segments[0];
    const protectedRoots = ['(tabs)', 'chat', 'match-modal'];
    const isProtected = protectedRoots.includes(String(root));

    if (!user && isProtected) {
      router.replace('/login');
      return;
    }

    if (user && (root === 'login' || root === 'signup' || root === 'auth-callback')) {
      router.replace('/(tabs)');
      return;
    }
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});