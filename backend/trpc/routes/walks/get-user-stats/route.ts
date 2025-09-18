import { protectedProcedure } from '../../../create-context';

export const getUserStatsProcedure = protectedProcedure
  .query(async ({ ctx }) => {
    console.log('[getUserStats] Starting - user ID:', ctx.user.id);
    console.log('[getUserStats] User email:', ctx.user.email);
    console.log('[getUserStats] User confirmed:', !!ctx.user.email_confirmed_at);

    try {
      // Test database connection first
      console.log('[getUserStats] Testing database connection...');
      const { error: testError } = await ctx.supabase
        .from('user_statistics')
        .select('id')
        .limit(1);
      
      if (testError) {
        console.error('[getUserStats] Database connection test failed:', testError);
        console.error('[getUserStats] Test error details:', {
          code: testError.code,
          message: testError.message,
          details: testError.details,
          hint: testError.hint
        });
        // Don't throw here, continue with the actual query
      } else {
        console.log('[getUserStats] Database connection test successful');
      }

      // Get user statistics from the database
      console.log('[getUserStats] Fetching user statistics for user:', ctx.user.id);
      const { data: userStats, error: statsError } = await ctx.supabase
        .from('user_statistics')
        .select('*')
        .eq('user_id', ctx.user.id)
        .single();

      console.log('[getUserStats] Query result - data exists:', !!userStats);
      console.log('[getUserStats] Query result - error:', statsError);

      if (statsError && statsError.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('[getUserStats] Error fetching user stats:', statsError);
        console.error('[getUserStats] Error code:', statsError.code);
        console.error('[getUserStats] Error message:', statsError.message);
        console.error('[getUserStats] Error details:', statsError.details);
        throw new Error(`Failed to fetch user statistics: ${statsError.message}`);
      }

      // If no stats exist, create default entry and return it
      if (!userStats || statsError?.code === 'PGRST116') {
        console.log('[getUserStats] No user statistics found, creating default entry');
        
        const defaultStats = {
          user_id: ctx.user.id,
          total_walks: 0,
          total_distance_km: 0,
          total_duration_minutes: 0,
          total_steps: 0,
          total_calories_burned: 0,
          current_streak_days: 0,
          longest_streak_days: 0,
          last_walk_date: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        // Try to create the default entry
        const { data: createdStats, error: createError } = await ctx.supabase
          .from('user_statistics')
          .insert(defaultStats)
          .select()
          .single();
        
        if (createError) {
          console.error('[getUserStats] Failed to create default stats:', createError);
          // Return defaults without database entry
          console.log('[getUserStats] Returning in-memory defaults');
          return {
            total_walks: 0,
            total_distance_km: 0,
            total_duration_minutes: 0,
            total_steps: 0,
            total_calories_burned: 0,
            current_streak_days: 0,
            longest_streak_days: 0,
            last_walk_date: null,
            created_at: null,
            updated_at: null
          };
        }
        
        console.log('[getUserStats] Created default stats:', createdStats);
        return {
          total_walks: Number(createdStats.total_walks) || 0,
          total_distance_km: Number(createdStats.total_distance_km) || 0,
          total_duration_minutes: Number(createdStats.total_duration_minutes) || 0,
          total_steps: Number(createdStats.total_steps) || 0,
          total_calories_burned: Number(createdStats.total_calories_burned) || 0,
          current_streak_days: Number(createdStats.current_streak_days) || 0,
          longest_streak_days: Number(createdStats.longest_streak_days) || 0,
          last_walk_date: createdStats.last_walk_date,
          created_at: createdStats.created_at,
          updated_at: createdStats.updated_at
        };
      }

      console.log('[getUserStats] Successfully fetched user statistics:', userStats);
      
      // Ensure all numeric fields are properly typed
      const cleanedStats = {
        total_walks: Number(userStats.total_walks) || 0,
        total_distance_km: Number(userStats.total_distance_km) || 0,
        total_duration_minutes: Number(userStats.total_duration_minutes) || 0,
        total_steps: Number(userStats.total_steps) || 0,
        total_calories_burned: Number(userStats.total_calories_burned) || 0,
        current_streak_days: Number(userStats.current_streak_days) || 0,
        longest_streak_days: Number(userStats.longest_streak_days) || 0,
        last_walk_date: userStats.last_walk_date,
        created_at: userStats.created_at,
        updated_at: userStats.updated_at
      };
      
      console.log('[getUserStats] Cleaned stats:', cleanedStats);
      return cleanedStats;
    } catch (error: any) {
      console.error('[getUserStats] Exception:', error);
      console.error('[getUserStats] Error details:', {
        message: error?.message,
        name: error?.name,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        stack: error?.stack?.substring(0, 500)
      });
      
      // Return default stats on error to prevent crashes
      const fallbackStats = {
        total_walks: 0,
        total_distance_km: 0,
        total_duration_minutes: 0,
        total_steps: 0,
        total_calories_burned: 0,
        current_streak_days: 0,
        longest_streak_days: 0,
        last_walk_date: null,
        created_at: null,
        updated_at: null
      };
      
      console.log('[getUserStats] Returning fallback stats due to error:', fallbackStats);
      return fallbackStats;
    }
  });