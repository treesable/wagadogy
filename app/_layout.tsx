import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useMemo } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppProvider } from "@/contexts/AppContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { StatsProvider } from "@/contexts/StatsContext";
import AuthGuard from "@/components/AuthGuard";
import { AuthErrorBoundary } from "@/components/AuthErrorBoundary";
import { trpc, createTRPCClient } from "@/lib/trpc";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="signup" options={{ headerShown: false }} />
      <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
      <Stack.Screen 
        name="match-modal" 
        options={{ 
          presentation: "modal",
          headerShown: false,
          animation: "fade"
        }} 
      />
      <Stack.Screen 
        name="chat/[conversationId]" 
        options={{ 
          headerShown: true,
          presentation: "card"
        }} 
      />
      <Stack.Screen 
        name="walk-tracker" 
        options={{ 
          headerShown: true,
          presentation: "card"
        }} 
      />
    </Stack>
  );
}

function TRPCProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  
  const trpcClient = useMemo(() => {
    return createTRPCClient(async () => {
      return session?.access_token || null;
    });
  }, [session?.access_token]);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  const handleAuthError = async () => {
    console.log('Handling auth error from error boundary');
    router.replace('/login');
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <AuthErrorBoundary onAuthError={handleAuthError}>
        <AuthProvider>
          <TRPCProvider>
            <AuthGuard>
              <StatsProvider>
                <AppProvider>
                  <RootLayoutNav />
                </AppProvider>
              </StatsProvider>
            </AuthGuard>
          </TRPCProvider>
        </AuthProvider>
      </AuthErrorBoundary>
    </GestureHandlerRootView>
  );
}