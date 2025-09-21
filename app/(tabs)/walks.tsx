import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  Image,
  Alert,
  Modal,
  AppState,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { 
  MapPin, 
  TrendingUp, 
  Calendar, 
  Clock, 
  Award, 
  Users,
  CheckCircle,
  XCircle,
  Bell,
  MessageCircle,
  Navigation,
  Zap,
  PersonStanding,
  Plus,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useApp } from "@/contexts/AppContext";
import { router } from "expo-router";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { useFocusEffect } from "@react-navigation/native";
import CreateWalkModal from "@/components/CreateWalkModal";

const { width: screenWidth } = Dimensions.get("window");

interface ScheduledWalkCardProps {
  walk: any;
  onComplete: (walkId: string) => void;
  onCancel: (walkId: string) => void;
  onReminder: (walkId: string) => void;
  onChat: (conversationId: string) => void;
}

function ScheduledWalkCard({ walk, onComplete, onCancel, onReminder, onChat }: ScheduledWalkCardProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow";
    } else {
      return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    }
  };

  const isToday = () => {
    const walkDate = new Date(walk.date);
    const today = new Date();
    return walkDate.toDateString() === today.toDateString();
  };

  const isPast = () => {
    const walkDateTime = new Date(walk.date + ' ' + walk.time);
    return walkDateTime < new Date();
  };

  return (
    <View style={styles.walkCard}>
      <View style={styles.walkCardHeader}>
        <View style={styles.partnerInfo}>
          <Image source={{ uri: walk.partnerPhoto }} style={styles.partnerAvatar} />
          <View style={styles.partnerDetails}>
            <Text style={styles.partnerDogName}>{walk.partnerDogName}</Text>
            <Text style={styles.partnerOwnerName}>{walk.partnerName}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, isToday() && styles.todayBadge]}>
          <Text style={[styles.statusText, isToday() && styles.todayText]}>
            {formatDate(walk.date)}
          </Text>
        </View>
      </View>

      <View style={styles.walkDetails}>
        <View style={styles.walkDetailRow}>
          <Clock size={16} color="#666" />
          <Text style={styles.walkDetailText}>{walk.time}</Text>
        </View>
        <View style={styles.walkDetailRow}>
          <MapPin size={16} color="#666" />
          <Text style={styles.walkDetailText}>{walk.location}</Text>
        </View>
        <View style={styles.walkDetailRow}>
          <Users size={16} color="#666" />
          <Text style={styles.walkDetailText}>{walk.duration}</Text>
        </View>
      </View>

      {walk.notes && (
        <View style={styles.notesContainer}>
          <Text style={styles.notesText}>&quot;{walk.notes}&quot;</Text>
        </View>
      )}

      <View style={styles.walkActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onChat(walk.conversationId)}
        >
          <MessageCircle size={18} color="#FF6B6B" />
          <Text style={styles.actionButtonText}>Chat</Text>
        </TouchableOpacity>

        {!walk.reminderSent && !isPast() && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onReminder(walk.id)}
          >
            <Bell size={18} color="#4ECDC4" />
            <Text style={styles.actionButtonText}>Remind</Text>
          </TouchableOpacity>
        )}

        {isPast() && (
          <TouchableOpacity
            style={[styles.actionButton, styles.completeButton]}
            onPress={() => onComplete(walk.id)}
          >
            <CheckCircle size={18} color="#4CAF50" />
            <Text style={[styles.actionButtonText, styles.completeButtonText]}>Complete</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, styles.cancelButton]}
          onPress={() => onCancel(walk.id)}
        >
          <XCircle size={18} color="#FF5722" />
          <Text style={[styles.actionButtonText, styles.cancelButtonText]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function WalksScreen() {
  const { 
    walkingStats, 
    updateWalkingStats, 
    updateDailyStats,
    getUpcomingWalks, 
    completeWalk, 
    cancelWalk, 
    sendWalkReminder 
  } = useApp();
  const { user, session } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<"day" | "week" | "month">("week");
  const [activeTab, setActiveTab] = useState<"stats" | "scheduled">("stats");
  const [selectedDayData, setSelectedDayData] = useState<{
    day: string;
    date: string;
    steps: number;
    duration: number;
    distance: number;
    walks: number;
  } | null>(null);
  const [showCreateWalkModal, setShowCreateWalkModal] = useState(false);

  // Fetch user statistics from database
  const { data: userStats, isLoading: statsLoading, error: statsError, refetch: refetchUserStats } = trpc.walks.getUserStats.useQuery(undefined, {
    enabled: !!user && !!session && !!session.access_token, // Only run query when user is authenticated with valid token
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 0, // Always refetch to get latest data
    retry: (failureCount: number, error: any) => {
      console.log(`[WalksScreen] getUserStats retry attempt ${failureCount}`, error?.message);
      // Don't retry on authentication errors
      if (error?.message?.includes('UNAUTHORIZED') || error?.message?.includes('Authentication required')) {
        console.log('[WalksScreen] Authentication error, not retrying');
        return false;
      }
      return failureCount < 2; // Reduce retry attempts
    },
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 10000)
  });
  
  const { data: walkStats, isLoading: walkStatsLoading, error: walkStatsError, refetch: refetchWalkStats } = trpc.walks.getStats.useQuery({
    period: selectedPeriod
  }, {
    enabled: !!user && !!session && !!session.access_token, // Only run query when user is authenticated with valid token
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 0,
    retry: (failureCount, error: any) => {
      console.log(`[WalksScreen] getStats retry attempt ${failureCount}`, error?.message);
      // Don't retry on authentication errors
      if (error?.message?.includes('UNAUTHORIZED') || error?.message?.includes('Authentication required')) {
        console.log('[WalksScreen] Authentication error, not retrying');
        return false;
      }
      return failureCount < 2; // Reduce retry attempts
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000)
  });
  
  // Fetch scheduled walks from database
  const { data: scheduledWalksData, isLoading: scheduledWalksLoading, error: scheduledWalksError, refetch: refetchScheduledWalks } = trpc.walks.getSchedules.useQuery({
    status: 'scheduled',
    upcoming_only: true,
    limit: 20
  }, {
    enabled: !!user && !!session && !!session.access_token,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 0,
    retry: (failureCount, error: any) => {
      console.log(`[WalksScreen] getSchedules retry attempt ${failureCount}`, error?.message);
      if (error?.message?.includes('UNAUTHORIZED') || error?.message?.includes('Authentication required')) {
        console.log('[WalksScreen] Authentication error, not retrying');
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000)
  });

  // Transform database scheduled walks to local format
  const upcomingWalks = React.useMemo(() => {
    if (!scheduledWalksData?.schedules) return [];
    
    return scheduledWalksData.schedules.map((schedule: any) => ({
      id: schedule.id,
      date: schedule.scheduled_date,
      time: schedule.scheduled_time,
      location: schedule.location_name,
      duration: schedule.duration_minutes ? `${schedule.duration_minutes} min` : '30 min',
      partnerId: schedule.partner_id || schedule.organizer_id,
      partnerName: 'Walk Partner', // TODO: Get from user profile
      partnerDogName: 'Buddy', // TODO: Get from dog profile
      partnerPhoto: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400',
      status: 'upcoming' as const,
      notes: schedule.notes,
      conversationId: schedule.conversation_id || '',
      createdAt: new Date(schedule.created_at),
      reminderSent: schedule.reminder_sent || false
    }));
  }, [scheduledWalksData]);

  // Add focus listener to refetch data when screen becomes active
  React.useEffect(() => {
    const handleFocus = () => {
      console.log('[WalksScreen] Screen focused, refetching data...');
      if (user && session && session.access_token) {
        console.log('[WalksScreen] User authenticated with valid token, refetching data');
        // Add small delay to ensure auth state is stable
        setTimeout(() => {
          refetchUserStats();
          refetchWalkStats();
          refetchScheduledWalks();
        }, 100);
      } else {
        console.log('[WalksScreen] User not authenticated or token invalid, skipping refetch');
      }
    };

    // For React Native, we can use AppState
    const subscription = AppState.addEventListener('change', (nextAppState: string) => {
      if (nextAppState === 'active') {
        handleFocus();
      }
    });

    return () => {
      subscription?.remove();
    };
  }, [refetchUserStats, refetchWalkStats, refetchScheduledWalks, user, session]);
  
  // Add navigation focus listener using expo-router
  useFocusEffect(
    React.useCallback(() => {
      console.log('[WalksScreen] Navigation focused, checking auth and refetching data...');
      console.log('[WalksScreen] User exists:', !!user);
      console.log('[WalksScreen] Session exists:', !!session);
      console.log('[WalksScreen] Session access token exists:', !!session?.access_token);
      
      if (user && session && session.access_token) {
        console.log('[WalksScreen] User authenticated with valid session, refetching data');
        // Add small delay to ensure auth state is stable
        setTimeout(() => {
          refetchUserStats();
          refetchWalkStats();
          refetchScheduledWalks();
        }, 200);
      } else {
        console.log('[WalksScreen] User not authenticated or session invalid, skipping refetch');
      }
    }, [user, session, refetchUserStats, refetchWalkStats, refetchScheduledWalks])
  );

  // Log data fetches and errors
  React.useEffect(() => {
    if (userStats) {
      console.log('[WalksScreen] User stats loaded successfully:', userStats);
    }
    if (statsError) {
      console.error('[WalksScreen] User stats error:', statsError);
      console.error('[WalksScreen] User stats error details:', {
        message: statsError?.message,
        data: statsError?.data,
        shape: statsError?.shape
      });
    }
  }, [userStats, statsError]);
  
  React.useEffect(() => {
    if (walkStats) {
      console.log('[WalksScreen] Walk stats loaded successfully:', walkStats);
    }
    if (walkStatsError) {
      console.error('[WalksScreen] Walk stats error:', walkStatsError);
      console.error('[WalksScreen] Walk stats error details:', {
        message: walkStatsError?.message,
        data: walkStatsError?.data,
        shape: walkStatsError?.shape
      });
    }
  }, [walkStats, walkStatsError]);

  // Add initial load effect
  React.useEffect(() => {
    console.log('[WalksScreen] Component mounted, queries should start automatically');
    console.log('[WalksScreen] User authenticated:', !!user && !!session && !!session?.access_token);
    console.log('[WalksScreen] Stats loading:', statsLoading, 'Walk stats loading:', walkStatsLoading);
  }, [statsLoading, walkStatsLoading, user, session]);

  // Log loading state changes
  React.useEffect(() => {
    console.log('[WalksScreen] Loading states changed - Stats:', statsLoading, 'Walk stats:', walkStatsLoading);
    console.log('[WalksScreen] User authenticated:', !!user && !!session && !!session?.access_token);
  }, [statsLoading, walkStatsLoading, user, session]);

  // Monitor authentication state changes
  React.useEffect(() => {
    console.log('[WalksScreen] Auth state changed - User:', !!user, 'Session:', !!session);
    console.log('[WalksScreen] Session details:', {
      hasAccessToken: !!session?.access_token,
      expiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
      isExpired: session?.expires_at ? (session.expires_at * 1000) < Date.now() : null
    });
    
    if (user && session && session.access_token) {
      console.log('[WalksScreen] User authenticated with valid session, queries should be enabled');
      // Trigger a fresh fetch when auth state becomes valid
      setTimeout(() => {
        refetchUserStats();
        refetchWalkStats();
        refetchScheduledWalks();
      }, 300);
    } else {
      console.log('[WalksScreen] User not authenticated or session invalid, queries should be disabled');
    }
  }, [user, session, refetchUserStats, refetchWalkStats, refetchScheduledWalks]);





  // Generate chart data from database stats with step information
  const getWeeklyChartDataFromDB = () => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const weekData: { 
      day: string; 
      date: string;
      value: number; 
      steps: number;
      duration: number;
      distance: number;
      walks: number;
    }[] = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayName = dayNames[date.getDay()];
      const dayStats = walkStats?.dailyBreakdown && typeof walkStats.dailyBreakdown === 'object' ? (walkStats.dailyBreakdown as Record<string, any>)[dateStr] : undefined;
      
      // Get actual steps from database or estimate if not available
      const actualSteps = dayStats?.steps || 0;
      const estimatedSteps = actualSteps > 0 ? actualSteps : (dayStats?.duration || 0) * 100;
      
      weekData.push({ 
        day: dayName, 
        date: dateStr,
        value: dayStats?.duration || 0,
        steps: actualSteps,
        duration: dayStats?.duration || 0,
        distance: dayStats?.distance || 0,
        walks: dayStats?.walks || 0
      });
    }
    return weekData;
  };

  // Generate achievements from database stats
  const getAchievementsFromDB = () => {
    const currentStreak = userStats?.current_streak_days || 0;
    const totalDistance = userStats?.total_distance_km || 0;
    const totalWalks = userStats?.total_walks || 0;
    const weeklyWalks = walkStats?.totalWalks || 0;
    
    return [
      { 
        id: 'week_warrior', 
        title: 'Week Warrior', 
        description: '7 day streak!', 
        icon: 'award', 
        unlocked: currentStreak >= 7 
      },
      { 
        id: 'distance_pro', 
        title: 'Distance Pro', 
        description: '50 km total', 
        icon: 'trending-up', 
        unlocked: totalDistance >= 50 
      },
      { 
        id: 'daily_walker', 
        title: 'Daily Walker', 
        description: 'Walk every day this week', 
        icon: 'calendar', 
        unlocked: weeklyWalks >= 7 
      },
      { 
        id: 'marathon_walker', 
        title: 'Marathon Walker', 
        description: '100+ walks completed', 
        icon: 'target', 
        unlocked: totalWalks >= 100 
      },
    ];
  };

  // Real-time subscription for schedule updates
  React.useEffect(() => {
    if (!user || !session || !session.access_token) {
      console.log('[WalksScreen] User not authenticated, skipping subscription');
      return;
    }

    console.log('[WalksScreen] Setting up real-time subscription for schedule updates');
    
    // Note: tRPC subscriptions require WebSocket support which may not be available in all environments
    // For now, we'll use polling as a fallback and implement WebSocket subscriptions when available
    const pollInterval = setInterval(() => {
      console.log('[WalksScreen] Polling for schedule updates');
      refetchScheduledWalks();
    }, 30000); // Poll every 30 seconds

    return () => {
      console.log('[WalksScreen] Cleaning up schedule update polling');
      clearInterval(pollInterval);
    };
  }, [user, session, refetchScheduledWalks]);

  // tRPC mutations for walk schedule management
  const updateScheduleMutation = trpc.walks.updateSchedule.useMutation({
    onSuccess: () => {
      console.log('[WalksScreen] Schedule updated successfully');
      refetchScheduledWalks();
    },
    onError: (error) => {
      console.error('[WalksScreen] Error updating schedule:', error);
      Alert.alert('Error', 'Failed to update walk schedule. Please try again.');
    }
  });

  const handleCompleteWalk = (walkId: string) => {
    Alert.alert(
      "Complete Walk",
      "Mark this walk as completed?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Complete", 
          onPress: async () => {
            try {
              // Update schedule status in database
              await updateScheduleMutation.mutateAsync({
                schedule_id: walkId,
                status: 'completed'
              });
              
              // Update walking stats
              const duration = 30; // Default duration
              const distance = 1.5; // Default distance
              
              // Update daily stats - this will automatically update all other stats
              const today = new Date().toISOString().split('T')[0];
              updateDailyStats(today, duration, distance);
              
              // Also update local context for immediate UI feedback
              completeWalk(walkId);
            } catch (error) {
              console.error('[WalksScreen] Error completing walk:', error);
            }
          }
        },
      ]
    );
  };

  const handleCancelWalk = (walkId: string) => {
    Alert.alert(
      "Cancel Walk",
      "Are you sure you want to cancel this walk?",
      [
        { text: "No", style: "cancel" },
        { 
          text: "Yes, Cancel", 
          style: "destructive", 
          onPress: async () => {
            try {
              // Update schedule status in database
              await updateScheduleMutation.mutateAsync({
                schedule_id: walkId,
                status: 'cancelled'
              });
              
              // Also update local context for immediate UI feedback
              cancelWalk(walkId);
            } catch (error) {
              console.error('[WalksScreen] Error cancelling walk:', error);
            }
          }
        },
      ]
    );
  };

  const handleSendReminder = async (walkId: string) => {
    try {
      // Update reminder status in database
      await updateScheduleMutation.mutateAsync({
        schedule_id: walkId,
        reminder_sent: true
      });
      
      // Also update local context for immediate UI feedback
      sendWalkReminder(walkId);
      Alert.alert("Reminder Sent", "Your walk buddy has been notified!");
    } catch (error) {
      console.error('[WalksScreen] Error sending reminder:', error);
      Alert.alert('Error', 'Failed to send reminder. Please try again.');
    }
  };

  const handleOpenChat = (conversationId: string) => {
    router.push(`/chat/${conversationId}`);
  };

  const handleBarPress = (dayData: typeof chartData[0]) => {
    setSelectedDayData({
      day: dayData.day,
      date: dayData.date,
      steps: dayData.steps,
      duration: dayData.duration,
      distance: dayData.distance,
      walks: dayData.walks
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const chartData = getWeeklyChartDataFromDB();
  const achievements = getAchievementsFromDB();

  const maxValue = Math.max(...chartData.map(d => d.value), 1); // Ensure minimum value of 1 to avoid division by zero

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Walking Tracker</Text>
        <Text style={styles.subtitle}>Keep your pup healthy & happy</Text>
      </View>

      <View style={styles.tabSelector}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "stats" && styles.activeTab]}
          onPress={() => setActiveTab("stats")}
        >
          <TrendingUp size={20} color={activeTab === "stats" ? "#fff" : "#666"} />
          <Text style={[styles.tabText, activeTab === "stats" && styles.activeTabText]}>
            Stats
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "scheduled" && styles.activeTab]}
          onPress={() => setActiveTab("scheduled")}
        >
          <Calendar size={20} color={activeTab === "scheduled" ? "#fff" : "#666"} />
          <Text style={[styles.tabText, activeTab === "scheduled" && styles.activeTabText]}>
            Scheduled ({upcomingWalks.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {activeTab === "stats" ? (
          <>
            <LinearGradient
              colors={["#FF6B6B", "#FF8E53"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.statsCard}
            >
              <View style={styles.mainStats}>
                <TouchableOpacity 
                  style={styles.statItem}
                  onPress={() => {
                    if (statsError) {
                      console.log('[WalksScreen] Manual retry for user stats');
                      refetchUserStats();
                    }
                  }}
                  disabled={!statsError}
                >
                  <Clock color="#fff" size={24} />
                  <Text style={styles.statValue}>
                    {!user || !session || !session?.access_token ? 'Sign In' : statsLoading ? '...' : statsError ? 'Error' : (userStats?.total_duration_minutes ?? 0)}
                  </Text>
                  <Text style={styles.statLabel}>Minutes Total</Text>
                  {statsError && (
                    <Text style={styles.errorText}>Tap to retry</Text>
                  )}
                  {(!user || !session || !session?.access_token) && (
                    <Text style={styles.errorText}>Authentication required</Text>
                  )}
                </TouchableOpacity>
                <View style={styles.statDivider} />
                <TouchableOpacity 
                  style={styles.statItem}
                  onPress={() => {
                    if (statsError) {
                      console.log('[WalksScreen] Manual retry for user stats');
                      refetchUserStats();
                    }
                  }}
                  disabled={!statsError}
                >
                  <MapPin color="#fff" size={24} />
                  <Text style={styles.statValue}>
                    {!user || !session || !session?.access_token ? 'Sign In' : statsLoading ? '...' : statsError ? 'Error' : (userStats?.total_distance_km?.toFixed(1) ?? '0.0')}
                  </Text>
                  <Text style={styles.statLabel}>Total km</Text>
                  {statsError && (
                    <Text style={styles.errorText}>Tap to retry</Text>
                  )}
                  {(!user || !session || !session?.access_token) && (
                    <Text style={styles.errorText}>Authentication required</Text>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.buttonContainer}>
                <TouchableOpacity 
                  style={styles.startWalkButton} 
                  onPress={() => router.push('/walk-tracker')}
                >
                  <Image 
                    source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/sdoi417yv5f4dez8w6v8u' }}
                    style={styles.walkIcon}
                  />
                  <Text style={styles.startWalkButtonText}>Start GPS Walk</Text>
                </TouchableOpacity>
                
                {(statsError || walkStatsError || scheduledWalksError || !user || !session || !session?.access_token) && (
                  <TouchableOpacity 
                    style={styles.retryButton} 
                    onPress={() => {
                      if (!user || !session || !session?.access_token) {
                        console.log('[WalksScreen] Authentication required, redirecting to login');
                        router.push('/login');
                      } else {
                        console.log('[WalksScreen] Manual retry triggered');
                        // Clear any cached data and refetch
                        setTimeout(() => {
                          refetchUserStats();
                          refetchWalkStats();
                          refetchScheduledWalks();
                        }, 100);
                      }
                    }}
                  >
                    <Text style={styles.retryButtonText}>
                      {!user || !session || !session?.access_token ? 'Sign In Required' : 'Retry Loading Data'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </LinearGradient>

            <View style={styles.periodSelector}>
              {(["day", "week", "month"] as const).map((period) => (
                <TouchableOpacity
                  key={period}
                  style={[
                    styles.periodButton,
                    selectedPeriod === period && styles.periodButtonActive,
                  ]}
                  onPress={() => setSelectedPeriod(period)}
                >
                  <Text
                    style={[
                      styles.periodButtonText,
                      selectedPeriod === period && styles.periodButtonTextActive,
                    ]}
                  >
                    {period.charAt(0).toUpperCase() + period.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>Weekly Activity</Text>
              <Text style={styles.chartSubtitle}>Tap on bars to see daily details</Text>
              <View style={styles.chart}>
                {chartData.map((data, index) => (
                  <TouchableOpacity 
                    key={index} 
                    style={styles.chartBar}
                    onPress={() => handleBarPress(data)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.barContainer}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: `${(data.value / maxValue) * 100}%`,
                            backgroundColor: index === 6 ? "#FF6B6B" : "#4ECDC4",
                          },
                        ]}
                      />
                      {data.value > 0 && (
                        <View style={styles.barValueContainer}>
                          <Text style={styles.barValue}>{Math.round(data.value)}m</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.barLabel}>{data.day}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.achievementsSection}>
              <Text style={styles.sectionTitle}>Achievements</Text>
              <View style={styles.achievementsGrid}>
                {achievements.map((achievement) => (
                  <View key={achievement.id} style={[
                    styles.achievementCard,
                    !achievement.unlocked && styles.achievementCardLocked
                  ]}>
                    <Award 
                      color={achievement.unlocked ? "#FFD700" : "#ccc"} 
                      size={30} 
                    />
                    <Text style={[
                      styles.achievementTitle,
                      !achievement.unlocked && styles.achievementTitleLocked
                    ]}>
                      {achievement.title}
                    </Text>
                    <Text style={[
                      styles.achievementDesc,
                      !achievement.unlocked && styles.achievementDescLocked
                    ]}>
                      {achievement.description}
                    </Text>
                    {achievement.unlocked && (
                      <View style={styles.unlockedBadge}>
                        <Text style={styles.unlockedText}>✓</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>This Week's Summary</Text>
              {walkStatsLoading ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Loading stats...</Text>
                </View>
              ) : (
                <>
                  <View style={styles.summaryStats}>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryValue}>{walkStats?.totalDuration ?? 0}</Text>
                      <Text style={styles.summaryLabel}>Total Minutes</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryValue}>{walkStats?.totalDistance?.toFixed(1) ?? '0.0'}</Text>
                      <Text style={styles.summaryLabel}>Total km</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryValue}>{walkStats?.totalWalks ?? 0}</Text>
                      <Text style={styles.summaryLabel}>Total Walks</Text>
                    </View>
                  </View>
                  
                  <View style={styles.summaryExtras}>
                    <View style={styles.summaryExtraItem}>
                      <Text style={styles.summaryExtraLabel}>Calories Burned</Text>
                      <Text style={styles.summaryExtraValue}>{walkStats?.totalCalories ?? 0} cal 🔥</Text>
                    </View>
                    <View style={styles.summaryExtraItem}>
                      <Text style={styles.summaryExtraLabel}>Avg Speed</Text>
                      <Text style={styles.summaryExtraValue}>
                        {walkStats?.avgSpeed?.toFixed(1) ?? '0.0'} km/h
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.summaryExtras}>
                    <View style={styles.summaryExtraItem}>
                      <Text style={styles.summaryExtraLabel}>Current Streak</Text>
                      <View style={styles.streakContainer}>
                        <Text style={styles.summaryExtraValue}>{userStats?.current_streak_days ?? 0} days </Text>
                        <Image 
                          source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/sdoi417yv5f4dez8w6v8u' }}
                          style={styles.streakIcon}
                        />
                      </View>
                    </View>
                    <View style={styles.summaryExtraItem}>
                      <Text style={styles.summaryExtraLabel}>Avg per Walk</Text>
                      <Text style={styles.summaryExtraValue}>
                        {walkStats?.avgDistance?.toFixed(1) ?? '0.0'} km
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          </>
        ) : (
          <View style={styles.scheduledSection}>
            {scheduledWalksLoading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading scheduled walks...</Text>
              </View>
            ) : scheduledWalksError ? (
              <View style={styles.emptyState}>
                <Calendar size={64} color="#ccc" />
                <Text style={styles.emptyStateTitle}>Error Loading Walks</Text>
                <Text style={styles.emptyStateText}>
                  {scheduledWalksError.message || 'Failed to load scheduled walks'}
                </Text>
                <TouchableOpacity 
                  style={styles.emptyStateButton}
                  onPress={() => refetchScheduledWalks()}
                >
                  <Text style={styles.emptyStateButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : upcomingWalks.length === 0 ? (
              <View style={styles.emptyState}>
                <Calendar size={64} color="#ccc" />
                <Text style={styles.emptyStateTitle}>No Scheduled Walks</Text>
                <Text style={styles.emptyStateText}>
                  Start chatting with your matches to schedule some walks!
                </Text>
                <View style={styles.emptyStateButtons}>
                  <TouchableOpacity 
                    style={styles.emptyStateButton}
                    onPress={() => setShowCreateWalkModal(true)}
                  >
                    <Plus size={20} color="#fff" />
                    <Text style={styles.emptyStateButtonText}>Create Walk</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.emptyStateButton, styles.secondaryButton]}
                    onPress={() => router.push("/(tabs)/matches")}
                  >
                    <Text style={[styles.emptyStateButtonText, styles.secondaryButtonText]}>Find Walk Buddies</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <View style={styles.scheduledHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>Upcoming Walks</Text>
                    <Text style={styles.scheduledCount}>{upcomingWalks.length} scheduled</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.createWalkButton}
                    onPress={() => setShowCreateWalkModal(true)}
                  >
                    <Plus size={20} color="#FF6B6B" />
                    <Text style={styles.createWalkButtonText}>New Walk</Text>
                  </TouchableOpacity>
                </View>
                
                {upcomingWalks.map((walk) => (
                  <ScheduledWalkCard
                    key={walk.id}
                    walk={walk}
                    onComplete={handleCompleteWalk}
                    onCancel={handleCancelWalk}
                    onReminder={handleSendReminder}
                    onChat={handleOpenChat}
                  />
                ))}
              </>
            )}
          </View>
        )}
      </ScrollView>
      
      {/* Day Details Modal */}
      <Modal
        visible={selectedDayData !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedDayData(null)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedDayData(null)}
        >
          <View style={styles.modalContent}>
            <TouchableOpacity activeOpacity={1}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {selectedDayData ? formatDate(selectedDayData.date) : ''}
                </Text>
                <TouchableOpacity 
                  style={styles.modalCloseButton}
                  onPress={() => setSelectedDayData(null)}
                >
                  <Text style={styles.modalCloseText}>×</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.modalStats}>
                <View style={styles.modalStatItem}>
                  <PersonStanding size={24} color="#FF6B6B" />
                  <Text style={styles.modalStatValue}>
                    {selectedDayData?.steps.toLocaleString() || '0'}
                  </Text>
                  <Text style={styles.modalStatLabel}>Steps</Text>
                </View>
                
                <View style={styles.modalStatItem}>
                  <Clock size={24} color="#4ECDC4" />
                  <Text style={styles.modalStatValue}>
                    {selectedDayData?.duration || 0}
                  </Text>
                  <Text style={styles.modalStatLabel}>Minutes</Text>
                </View>
                
                <View style={styles.modalStatItem}>
                  <MapPin size={24} color="#FFD700" />
                  <Text style={styles.modalStatValue}>
                    {selectedDayData?.distance.toFixed(1) || '0.0'}
                  </Text>
                  <Text style={styles.modalStatLabel}>km</Text>
                </View>
                
                <View style={styles.modalStatItem}>
                  <Navigation size={24} color="#9C27B0" />
                  <Text style={styles.modalStatValue}>
                    {selectedDayData?.walks || 0}
                  </Text>
                  <Text style={styles.modalStatLabel}>Walks</Text>
                </View>
              </View>
              
              {selectedDayData && selectedDayData.steps > 0 && (
                <View style={styles.modalFooter}>
                  <Text style={styles.modalFooterText}>
                    🎉 Great job on staying active!
                  </Text>
                </View>
              )}
              
              {selectedDayData && selectedDayData.steps === 0 && (
                <View style={styles.modalFooter}>
                  <Text style={styles.modalFooterText}>
                    💪 Ready for a walk today?
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      
      {/* Create Walk Modal */}
      <CreateWalkModal
        visible={showCreateWalkModal}
        onClose={() => setShowCreateWalkModal(false)}
        onSuccess={(schedule) => {
          console.log('[WalksScreen] Walk created successfully:', schedule);
          // Refetch scheduled walks to show the new one
          refetchScheduledWalks();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold" as const,
    color: "#333",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  tabSelector: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  activeTab: {
    backgroundColor: "#FF6B6B",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#666",
  },
  activeTabText: {
    color: "#fff",
  },
  statsCard: {
    margin: 20,
    padding: 25,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  mainStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 25,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 36,
    fontWeight: "bold" as const,
    color: "#fff",
    marginVertical: 5,
  },
  statLabel: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
  },
  statDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.3)",
    marginVertical: 10,
  },
  buttonContainer: {
    alignItems: "center",
  },
  startWalkButton: {
    backgroundColor: "#fff",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  startWalkButtonText: {
    color: "#FF6B6B",
    fontSize: 18,
    fontWeight: "700" as const,
  },
  periodSelector: {
    flexDirection: "row",
    marginHorizontal: 20,
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 5,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  periodButtonActive: {
    backgroundColor: "#FF6B6B",
  },
  periodButtonText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500" as const,
  },
  periodButtonTextActive: {
    color: "#fff",
  },
  chartContainer: {
    backgroundColor: "#fff",
    margin: 20,
    padding: 20,
    borderRadius: 20,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: "#333",
    marginBottom: 20,
  },
  chart: {
    flexDirection: "row",
    justifyContent: "space-between",
    height: 150,
  },
  chartBar: {
    flex: 1,
    alignItems: "center",
  },
  barContainer: {
    flex: 1,
    width: "60%",
    justifyContent: "flex-end",
  },
  bar: {
    width: "100%",
    borderRadius: 5,
    minHeight: 5,
  },
  barLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 8,
  },
  achievementsSection: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: "#333",
    marginBottom: 15,
  },
  achievementsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 15,
  },
  achievementCard: {
    width: (screenWidth - 60) / 2,
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 15,
    alignItems: "center",
    marginBottom: 15,
  },
  achievementTitle: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#333",
    marginTop: 10,
  },
  achievementDesc: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  summaryCard: {
    backgroundColor: "#fff",
    margin: 20,
    padding: 20,
    borderRadius: 20,
    marginBottom: 30,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: "#333",
    marginBottom: 20,
  },
  summaryStats: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  summaryItem: {
    alignItems: "center",
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "bold" as const,
    color: "#FF6B6B",
  },
  summaryLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  scheduledSection: {
    paddingHorizontal: 20,
  },
  scheduledHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 15,
  },
  scheduledCount: {
    fontSize: 14,
    color: "#666",
  },
  walkCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  walkCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  partnerInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  partnerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  partnerDetails: {
    flex: 1,
  },
  partnerDogName: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#333",
  },
  partnerOwnerName: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
  },
  todayBadge: {
    backgroundColor: "#FF6B6B",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: "#666",
  },
  todayText: {
    color: "#fff",
  },
  walkDetails: {
    marginBottom: 12,
  },
  walkDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 8,
  },
  walkDetailText: {
    fontSize: 14,
    color: "#666",
  },
  notesContainer: {
    backgroundColor: "#f8f9fa",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  notesText: {
    fontSize: 14,
    color: "#666",
    fontStyle: "italic" as const,
  },
  walkActions: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f8f9fa",
    gap: 6,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: "#666",
  },
  completeButton: {
    backgroundColor: "#E8F5E8",
  },
  completeButtonText: {
    color: "#4CAF50",
  },
  cancelButton: {
    backgroundColor: "#FFEBEE",
  },
  cancelButtonText: {
    color: "#FF5722",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "600" as const,
    color: "#333",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  emptyStateButtons: {
    flexDirection: "row",
    gap: 12,
  },
  emptyStateButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF6B6B",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#FF6B6B",
  },
  emptyStateButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600" as const,
  },
  secondaryButtonText: {
    color: "#FF6B6B",
  },
  createWalkButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#FF6B6B",
    gap: 6,
  },
  createWalkButtonText: {
    color: "#FF6B6B",
    fontSize: 14,
    fontWeight: "600" as const,
  },
  walkIcon: {
    width: 24,
    height: 24,
    tintColor: "#FF6B6B",
  },
  achievementCardLocked: {
    opacity: 0.6,
    backgroundColor: "#f8f9fa",
  },
  achievementTitleLocked: {
    color: "#999",
  },
  achievementDescLocked: {
    color: "#bbb",
  },
  unlockedBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#4CAF50",
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  unlockedText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold" as const,
  },
  moreAchievements: {
    alignItems: "center",
    marginTop: 10,
  },
  moreAchievementsText: {
    fontSize: 12,
    color: "#999",
    fontStyle: "italic" as const,
  },
  summaryExtras: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  summaryExtraItem: {
    alignItems: "center",
  },
  summaryExtraLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  summaryExtraValue: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#333",
  },
  streakContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  streakIcon: {
    width: 16,
    height: 16,
    tintColor: "#FF6B6B",
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
  },
  chartSubtitle: {
    fontSize: 12,
    color: "#999",
    marginBottom: 15,
    textAlign: "center",
  },
  barValueContainer: {
    position: "absolute",
    top: -20,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  barValue: {
    fontSize: 10,
    color: "#666",
    fontWeight: "600" as const,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 0,
    width: "100%",
    maxWidth: 350,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: "#333",
  },
  modalCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCloseText: {
    fontSize: 20,
    color: "#666",
    fontWeight: "bold" as const,
  },
  modalStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 25,
  },
  modalStatItem: {
    alignItems: "center",
    flex: 1,
  },
  modalStatValue: {
    fontSize: 20,
    fontWeight: "bold" as const,
    color: "#333",
    marginTop: 8,
    marginBottom: 4,
  },
  modalStatLabel: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
  },
  modalFooter: {
    padding: 20,
    paddingTop: 0,
    alignItems: "center",
  },
  modalFooterText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    fontStyle: "italic" as const,
  },
  errorText: {
    fontSize: 10,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
    fontStyle: "italic" as const,
  },
  retryButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600" as const,
    textAlign: "center",
  },
});