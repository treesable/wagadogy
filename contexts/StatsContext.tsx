import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';

interface UserStats {
  likes: number;
  matches: number;
  walks: number;
  loading: boolean;
  error: string | null;
}

interface StatsContextType {
  stats: UserStats;
  refreshStats: () => Promise<void>;
  incrementLikes: () => Promise<void>;
  incrementMatches: () => Promise<void>;
  incrementWalks: () => Promise<void>;
}

export const [StatsProvider, useStats] = createContextHook((): StatsContextType => {
  const { user, supabase } = useAuth();
  const [stats, setStats] = useState<UserStats>({
    likes: 0,
    matches: 0,
    walks: 0,
    loading: true,
    error: null,
  });

  const fetchStats = useCallback(async () => {
    if (!user) {
      setStats(prev => ({ ...prev, loading: false, error: 'No user logged in' }));
      return;
    }

    try {
      setStats(prev => ({ ...prev, loading: true, error: null }));
      console.log('Fetching stats for user:', user.id);

      // Fetch likes count (swipes where current user liked someone)
      const { count: likesCount, error: likesError } = await supabase
        .from('user_swipes')
        .select('*', { count: 'exact', head: true })
        .eq('swiper_id', user.id)
        .eq('action', 'like');

      if (likesError) {
        console.error('Error fetching likes:', likesError);
        throw likesError;
      }

      // Fetch matches count (matches where current user is involved)
      const { count: matchesCount, error: matchesError } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      if (matchesError) {
        console.error('Error fetching matches:', matchesError);
        throw matchesError;
      }

      // Fetch completed walks count
      const { count: walksCount, error: walksError } = await supabase
        .from('walk_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_completed', true);

      if (walksError) {
        console.error('Error fetching walks:', walksError);
        throw walksError;
      }

      const newStats = {
        likes: likesCount || 0,
        matches: matchesCount || 0,
        walks: walksCount || 0,
        loading: false,
        error: null,
      };

      console.log('Fetched stats:', newStats);
      setStats(newStats);

    } catch (error: any) {
      console.error('Error fetching stats:', error);
      setStats(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to fetch stats',
      }));
    }
  }, [user, supabase]);

  const refreshStats = useCallback(async () => {
    await fetchStats();
  }, [fetchStats]);

  const incrementLikes = useCallback(async () => {
    if (!user) return;
    try {
      console.log('Increment likes UI for user:', user.id);
      // Optimistically update the UI first
      setStats(prev => ({ ...prev, likes: prev.likes + 1 }));
      // Then refresh from database to ensure accuracy
      setTimeout(() => {
        refreshStats();
      }, 500);
    } catch (error: any) {
      console.error('Error incrementing likes (ui):', error);
    }
  }, [user, refreshStats]);

  const incrementMatches = useCallback(async () => {
    if (!user) return;
    try {
      console.log('Increment matches UI for user:', user.id);
      // Optimistically update the UI first
      setStats(prev => ({ ...prev, matches: prev.matches + 1 }));
      // Then refresh from database to ensure accuracy
      setTimeout(() => {
        refreshStats();
      }, 500);
    } catch (error: any) {
      console.error('Error incrementing matches (ui):', error);
    }
  }, [user, refreshStats]);

  const incrementWalks = useCallback(async () => {
    if (!user) return;
    
    try {
      console.log('Incrementing walks UI for user:', user.id);
      
      // Just update the UI optimistically - the actual walk session
      // is already saved by the walk tracker
      setStats(prev => ({
        ...prev,
        walks: prev.walks + 1
      }));
      
      // Refresh from database to ensure accuracy
      setTimeout(() => {
        refreshStats();
      }, 500);
      
      console.log('Successfully incremented walks UI');
    } catch (error: any) {
      console.error('Error incrementing walks UI:', error);
    }
  }, [user, refreshStats]);

  // Fetch stats when user changes
  useEffect(() => {
    if (user) {
      fetchStats();
    } else {
      setStats({
        likes: 0,
        matches: 0,
        walks: 0,
        loading: false,
        error: null,
      });
    }
  }, [user, fetchStats]);

  return useMemo(() => ({
    stats,
    refreshStats,
    incrementLikes,
    incrementMatches,
    incrementWalks,
  }), [stats, refreshStats, incrementLikes, incrementMatches, incrementWalks]);
});