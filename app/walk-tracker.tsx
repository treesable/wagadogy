import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import * as Location from 'expo-location';
import { NativeMapView } from '@/components/NativeMapView';
import { useApp } from '@/contexts/AppContext';
import { useStats } from '@/contexts/StatsContext';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/contexts/AuthContext';
import {
  Play,
  Pause,
  Square,
  Clock,
  Activity,
  Target,
  Award,
  ArrowLeft,
} from 'lucide-react-native';





interface WalkStats {
  distance: number;
  duration: number;
  steps: number;
  calories: number;
  avgSpeed: number;
}

interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
}

type WalkStatus = 'idle' | 'active' | 'paused';



export default function WalkTrackerScreen() {
  const { updateDailyStats, userProfile } = useApp();
  const { incrementWalks } = useStats();
  const { user, session } = useAuth();
  
  // Log auth status when component mounts
  useEffect(() => {
    console.log('[WalkTrackerScreen] Auth status:', {
      userExists: !!user,
      sessionExists: !!session,
      userId: user?.id,
      userEmail: user?.email,
      tokenExists: !!session?.access_token,
      tokenLength: session?.access_token?.length || 0
    });
  }, [user, session]);
  
  const utils = trpc.useUtils();
  
  const saveWalkSessionMutation = trpc.walks.saveSession.useMutation({
    onError: (error) => {
      console.error('[saveWalkSessionMutation] Error:', error);
      console.error('[saveWalkSessionMutation] Error message:', error.message);
      console.error('[saveWalkSessionMutation] Error data:', error.data);
      console.error('[saveWalkSessionMutation] Error shape:', error.shape);
    },
    onSuccess: async (data) => {
      console.log('[saveWalkSessionMutation] Success:', data);
      
      // Invalidate and refetch all walk-related queries to update the UI
      console.log('[saveWalkSessionMutation] Invalidating walk queries...');
      await utils.walks.getUserStats.invalidate();
      await utils.walks.getStats.invalidate();
      await utils.walks.getHistory.invalidate();
      console.log('[saveWalkSessionMutation] Walk queries invalidated successfully');
    }
  });
  const [walkStatus, setWalkStatus] = useState<WalkStatus>('idle');
  const [walkStats, setWalkStats] = useState<WalkStats>({
    distance: 0,
    duration: 0,
    steps: 0,
    calories: 0,
    avgSpeed: 0,
  });
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [startLocation, setStartLocation] = useState<Location.LocationObject | null>(null);
  const [walkPath, setWalkPath] = useState<LocationPoint[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [pausedDuration, setPausedDuration] = useState(0);
  const [lastPauseTime, setLastPauseTime] = useState<number | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const walkStatusRef = useRef<WalkStatus>('idle');
  const walkStatsRef = useRef<WalkStats>({
    distance: 0,
    duration: 0,
    steps: 0,
    calories: 0,
    avgSpeed: 0,
  });

  useEffect(() => {
    requestLocationPermission();
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    walkStatusRef.current = walkStatus;
  }, [walkStatus]);

  useEffect(() => {
    walkStatsRef.current = walkStats;
  }, [walkStats]);

  useEffect(() => {
    if (walkStatus === 'active' && startTime) {
      timerRef.current = setInterval(() => {
        const now = Date.now();
        const totalElapsed = now - startTime - pausedDuration;
        const newDuration = Math.floor(totalElapsed / 1000);
        
        setWalkStats(prev => {
          const updated = { ...prev, duration: newDuration };
          walkStatsRef.current = updated;
          return updated;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [walkStatus, startTime, pausedDuration]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Location permission is needed to track your walks.'
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setCurrentLocation(location);
    } catch (error) {
      console.error('Error requesting location permission:', error);
      Alert.alert('Error', 'Failed to get location permission.');
    }
  };

  const startWalk = async () => {
    if (isStarting) return; // Prevent double tap
    
    try {
      setIsStarting(true);
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is needed to track walks.');
        setIsStarting(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      console.log('Starting walk at location:', location.coords);
      
      setCurrentLocation(location);
      setStartLocation(location); // Keep start location separate
      setWalkStatus('active');
      setStartTime(Date.now());
      setPausedDuration(0);
      setWalkPath([{
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: Date.now(),
      }]);
      setWalkStats({
        distance: 0,
        duration: 0,
        steps: 0,
        calories: 0,
        avgSpeed: 0,
      });

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000, // Reduced to 2 seconds for better tracking
          distanceInterval: 3, // Reduced to 3 meters for better sensitivity
        },
        (newLocation) => {
          console.log('New location received:', newLocation.coords);
          setCurrentLocation(newLocation);
          if (walkStatusRef.current === 'active') {
            updateWalkPath(newLocation);
          }
        }
      );
      
      setIsStarting(false);
    } catch (error) {
      console.error('Error starting walk:', error);
      Alert.alert('Error', 'Failed to start walk tracking.');
      setIsStarting(false);
    }
  };

  const pauseWalk = () => {
    setWalkStatus('paused');
    setLastPauseTime(Date.now());
  };

  const resumeWalk = () => {
    if (lastPauseTime) {
      setPausedDuration(prev => prev + (Date.now() - lastPauseTime));
    }
    setWalkStatus('active');
    setLastPauseTime(null);
  };

  const stopWalk = () => {
    const finalStats = walkStatsRef.current;
    
    setWalkStatus('idle');
    setStartTime(null);
    setPausedDuration(0);
    setLastPauseTime(null);
    setStartLocation(null);
    
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const saveWalk = async () => {
      try {
        console.log('[saveWalk] Saving walk session to database');
        console.log('[saveWalk] Current auth status:', {
          userExists: !!user,
          sessionExists: !!session,
          userId: user?.id,
          tokenExists: !!session?.access_token
        });
        
        if (!user || !session) {
          console.error('[saveWalk] No authenticated user or session');
          Alert.alert(
            'Authentication Required',
            'Please sign in to save your walk.',
            [{ text: 'OK' }]
          );
          return;
        }
        
        const durationMinutes = Math.max(1, Math.floor(finalStats.duration / 60)); // Ensure minimum 1 minute
        const distanceKm = Math.max(0.01, finalStats.distance / 1000); // Ensure minimum distance
        const now = new Date();
        const walkStartTime = new Date(startTime!);
        
        console.log('[saveWalk] Attempting to save walk session with data:', {
          start_time: walkStartTime.toISOString(),
          end_time: now.toISOString(),
          duration_minutes: durationMinutes,
          distance_km: distanceKm,
          steps: finalStats.steps,
          calories_burned: finalStats.calories,
          route_coordinates_length: walkPath.length,
          has_start_location: !!startLocation,
          has_end_location: !!currentLocation,
        });
        
        // Get the active dog ID from user profile
        const activeDogId = userProfile.activeDogId;
        
        console.log('[saveWalk] Active dog ID:', activeDogId);
        console.log('[saveWalk] User profile dog profiles:', userProfile.dogProfiles?.length || 0);
        
        if (!activeDogId) {
          console.error('[saveWalk] No active dog ID found');
          throw new Error('No active dog profile found. Please set up your dog profile first.');
        }
        
        // Prepare walk data for saving
        const walkData = {
          dog_id: activeDogId,
          start_time: walkStartTime.toISOString(),
          end_time: now.toISOString(),
          duration_minutes: durationMinutes,
          distance_km: distanceKm,
          steps: finalStats.steps,
          calories_burned: finalStats.calories,
          route_coordinates: walkPath,
          start_location: startLocation ? {
            latitude: startLocation.coords.latitude,
            longitude: startLocation.coords.longitude
          } : undefined,
          end_location: currentLocation ? {
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude
          } : undefined,
          is_completed: true
        };
        
        console.log('[saveWalk] Attempting to save walk with data:', {
          ...walkData,
          route_coordinates_length: walkData.route_coordinates?.length || 0,
          has_start_location: !!walkData.start_location,
          has_end_location: !!walkData.end_location
        });
        
        // Save walk session using tRPC
        let saveSuccess = false;
        let result = null;
        
        try {
          console.log('[saveWalk] Attempting tRPC save...');
          console.log('[saveWalk] Walk data being sent:', {
            ...walkData,
            route_coordinates_sample: walkData.route_coordinates?.slice(0, 2) || [],
            route_coordinates_count: walkData.route_coordinates?.length || 0
          });
          
          // Test API connectivity first
          console.log('[saveWalk] Testing API connectivity...');
          const baseUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
          console.log('[saveWalk] Base URL:', baseUrl);
          
          if (baseUrl) {
            try {
              const healthResponse = await fetch(`${baseUrl}/api/health`);
              console.log('[saveWalk] Health check status:', healthResponse.status);
              if (healthResponse.ok) {
                const healthData = await healthResponse.json();
                console.log('[saveWalk] Health check response:', healthData);
              } else {
                const healthText = await healthResponse.text();
                console.log('[saveWalk] Health check failed:', healthText.substring(0, 200));
              }
            } catch (healthError) {
              console.error('[saveWalk] Health check error:', healthError);
            }
          }
          
          result = await saveWalkSessionMutation.mutateAsync(walkData);
          
          console.log('[saveWalk] tRPC save successful:', result);
          saveSuccess = true;
          
        } catch (trpcError: any) {
          console.error('[saveWalk] tRPC save failed:', trpcError);
          console.error('[saveWalk] tRPC error details:', {
            message: trpcError?.message,
            code: trpcError?.code,
            data: trpcError?.data,
            shape: trpcError?.shape,
            stack: trpcError?.stack
          });
          
          // Provide more specific error messages based on the error type
          let errorMessage = 'Failed to save walk to database';
          
          if (trpcError?.message?.includes('Server returned HTML instead of JSON')) {
            errorMessage = 'API server is not responding correctly. The backend may not be running.';
          } else if (trpcError?.message?.includes('UNAUTHORIZED')) {
            errorMessage = 'Authentication failed. Please sign in again.';
          } else if (trpcError?.message?.includes('Network') || trpcError?.message?.includes('fetch')) {
            errorMessage = 'Network connection error. Please check your internet connection.';
          } else if (trpcError?.message?.includes('API endpoint is not found')) {
            errorMessage = 'API configuration error. The server endpoint was not found.';
          } else if (trpcError?.message) {
            errorMessage = trpcError.message;
          }
          
          throw new Error(errorMessage);
        }
        
        if (saveSuccess && result) {
          console.log('[saveWalk] Walk session saved successfully to database:', result);
          
          // Update daily stats for local UI
          const today = new Date().toISOString().split('T')[0];
          updateDailyStats(today, durationMinutes, distanceKm);
          
          // Update stats context
          await incrementWalks();
          
          Alert.alert(
            'Walk Saved! 🎉',
            `Your walk has been successfully saved to the database.\n\nDistance: ${distanceKm.toFixed(2)} km\nDuration: ${Math.floor(durationMinutes)} minutes\nSteps: ${finalStats.steps.toLocaleString()}\nCalories: ${finalStats.calories}`,
            [{ text: 'OK', onPress: () => router.back() }]
          );
        } else {
          throw new Error('Walk save completed but no result returned');
        }
      } catch (error: any) {
        console.error('[saveWalk] All save methods failed:', error);
        console.error('[saveWalk] Error details:', {
          message: error?.message,
          code: error?.code,
          status: error?.status,
          data: error?.data
        });
        
        // Provide more specific error messages
        let errorMessage = 'Failed to save walk to database';
        if (error?.message?.includes('No base url found')) {
          errorMessage = 'API configuration error. Please check your network connection.';
        } else if (error?.message?.includes('UNAUTHORIZED') || error?.message?.includes('Authentication required')) {
          errorMessage = 'Authentication error. Please sign in again.';
        } else if (error?.message?.includes('Network') || error?.message?.includes('fetch')) {
          errorMessage = 'Network error. Please check your internet connection.';
        } else if (error?.message) {
          errorMessage = error.message;
        }
        
        // Fallback to local storage with user notification
        const durationMinutes = Math.floor(finalStats.duration / 60);
        const distanceKm = finalStats.distance / 1000;
        const today = new Date().toISOString().split('T')[0];
        updateDailyStats(today, durationMinutes, distanceKm);
        await incrementWalks();
        
        Alert.alert(
          'Save Error',
          `${errorMessage}\n\nYour walk has been saved locally and will sync when the connection is restored.`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    };

    Alert.alert(
      'Walk Complete! 🐕',
      `Distance: ${(finalStats.distance / 1000).toFixed(2)} km\nDuration: ${formatDuration(finalStats.duration)}\nCalories: ${finalStats.calories}\nSteps: ${finalStats.steps.toLocaleString()}\nAverage Speed: ${formatSpeed(finalStats.avgSpeed)}`,
      [
        { text: 'Save Walk', onPress: saveWalk },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() }
      ]
    );
  };

  const updateWalkPath = (newLocation: Location.LocationObject) => {
    setWalkPath(prev => {
      const newPoint: LocationPoint = {
        latitude: newLocation.coords.latitude,
        longitude: newLocation.coords.longitude,
        timestamp: Date.now(),
      };
      
      const updatedPath = [...prev, newPoint];
      
      if (prev.length > 0) {
        const lastPoint = prev[prev.length - 1];
        const segmentDistance = calculateDistance(
          lastPoint.latitude,
          lastPoint.longitude,
          newPoint.latitude,
          newPoint.longitude
        );
        
        console.log('Segment distance:', segmentDistance, 'meters');
        
        // Filter out GPS noise - only count movements between 2-50 meters to avoid GPS drift and unrealistic jumps
        if (segmentDistance >= 2 && segmentDistance <= 50) {
          setWalkStats(prevStats => {
            const newDistance = prevStats.distance + segmentDistance;
            
            // More realistic step calculation: average step length is 0.65-0.8m for adults
            // Using 0.75m (75cm) as average step length
            const newSteps = Math.floor(newDistance / 0.75);
            
            // More realistic calorie calculation: ~50 calories per km for average adult walking
            // Factors: body weight (assuming 70kg), walking speed, terrain
            const newCalories = Math.floor((newDistance / 1000) * 50);
            
            // Calculate speed more conservatively - only update if we have reasonable duration
            const currentDuration = walkStatsRef.current.duration;
            let avgSpeed = 0;
            if (currentDuration > 30) { // Only calculate speed after 30 seconds to avoid initial GPS settling
              const speedMs = newDistance / currentDuration; // meters per second
              const speedKmh = speedMs * 3.6; // convert to km/h
              // Cap realistic walking speed between 1-8 km/h
              avgSpeed = Math.min(Math.max(speedKmh, 1), 8);
            }
            
            const updated = {
              ...prevStats,
              distance: newDistance,
              steps: newSteps,
              calories: newCalories,
              avgSpeed,
            };
            
            walkStatsRef.current = updated;
            console.log('Updated stats:', updated);
            return updated;
          });
        }
      }
      
      return updatedPath;
    });
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  };

  const formatSpeed = (speed: number): string => {
    return `${speed.toFixed(1)} km/h`;
  };

  const renderMap = () => {
    return (
      <NativeMapView 
        currentLocation={currentLocation}
        startLocation={startLocation}
        walkPath={walkPath}
        walkStatus={walkStatus}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{
          title: 'Walk Tracker',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft size={24} color="#333" />
            </TouchableOpacity>
          ),
        }} 
      />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.mapContainer}>
          {renderMap()}
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Activity size={24} color="#FF6B6B" />
              <Text style={styles.statValue}>{(walkStats.distance / 1000).toFixed(2)}</Text>
              <Text style={styles.statLabel}>km</Text>
            </View>
            <View style={styles.statCard}>
              <Clock size={24} color="#4ECDC4" />
              <Text style={styles.statValue}>{formatDuration(walkStats.duration)}</Text>
              <Text style={styles.statLabel}>Duration</Text>
            </View>
          </View>
          
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Target size={24} color="#45B7D1" />
              <Text style={styles.statValue}>{walkStats.steps.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Steps</Text>
            </View>
            <View style={styles.statCard}>
              <Award size={24} color="#FFA726" />
              <Text style={styles.statValue}>{walkStats.calories}</Text>
              <Text style={styles.statLabel}>Calories</Text>
            </View>
          </View>

          {walkStats.avgSpeed > 0 && (
            <View style={styles.speedCard}>
              <Text style={styles.speedLabel}>Average Speed</Text>
              <Text style={styles.speedValue}>{formatSpeed(walkStats.avgSpeed)}</Text>
            </View>
          )}
        </View>

        <View style={styles.controlsContainer}>
          {walkStatus === 'idle' && (
            <TouchableOpacity 
              style={[styles.startButton, isStarting && styles.startButtonDisabled]} 
              onPress={startWalk}
              disabled={isStarting}
            >
              <Play size={24} color="white" />
              <Text style={styles.startButtonText}>
                {isStarting ? 'Starting...' : 'Start Walk'}
              </Text>
            </TouchableOpacity>
          )}
          
          {walkStatus === 'active' && (
            <View style={styles.activeControls}>
              <TouchableOpacity style={styles.pauseButton} onPress={pauseWalk}>
                <Pause size={20} color="white" />
                <Text style={styles.controlButtonText}>Pause</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.stopButton} onPress={stopWalk}>
                <Square size={20} color="white" />
                <Text style={styles.controlButtonText}>Stop</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {walkStatus === 'paused' && (
            <View style={styles.activeControls}>
              <TouchableOpacity style={styles.resumeButton} onPress={resumeWalk}>
                <Play size={20} color="white" />
                <Text style={styles.controlButtonText}>Resume</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.stopButton} onPress={stopWalk}>
                <Square size={20} color="white" />
                <Text style={styles.controlButtonText}>Stop</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {walkStatus !== 'idle' && (
          <View style={styles.statusContainer}>
            <View style={[styles.statusDot, { backgroundColor: walkStatus === 'active' ? '#4CAF50' : '#FFA726' }]} />
            <Text style={styles.statusText}>
              {walkStatus === 'active' ? 'Walk in progress...' : 'Walk paused'}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  mapContainer: {
    margin: 20,
    height: 300,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },

  statsContainer: {
    paddingHorizontal: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginHorizontal: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#7F8C8D',
  },
  speedCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginHorizontal: 8,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  speedLabel: {
    fontSize: 16,
    color: '#7F8C8D',
    marginBottom: 8,
  },
  speedValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  controlsContainer: {
    paddingHorizontal: 20,
    marginTop: 10,
  },
  startButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  startButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  activeControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pauseButton: {
    backgroundColor: '#FFA726',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    flex: 1,
    marginRight: 8,
  },
  resumeButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    flex: 1,
    marginRight: 8,
  },
  stopButton: {
    backgroundColor: '#F44336',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    flex: 1,
    marginLeft: 8,
  },
  controlButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    color: '#7F8C8D',
    fontWeight: '500',
  },
  startButtonDisabled: {
    backgroundColor: '#A5D6A7',
    opacity: 0.7,
  },
});