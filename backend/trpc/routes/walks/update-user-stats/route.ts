import { z } from 'zod';
import { protectedProcedure } from '../../../create-context';

const updateUserStatsSchema = z.object({
  distance_km: z.number().nonnegative(),
  duration_minutes: z.number().int().nonnegative(),
  steps: z.number().int().nonnegative(),
  calories_burned: z.number().int().nonnegative()
});

export const updateUserStatsProcedure = protectedProcedure
  .input(updateUserStatsSchema)
  .mutation(async ({ ctx, input }) => {
    console.log('[updateUserStats] Updating user statistics for user:', ctx.user.id);
    console.log('[updateUserStats] Input data:', input);

    try {
      // Get current user statistics
      const { data: currentStats, error: fetchError } = await ctx.supabase
        .from('user_statistics')
        .select('*')
        .eq('user_id', ctx.user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('[updateUserStats] Error fetching current stats:', fetchError);
        throw new Error(`Failed to fetch current statistics: ${fetchError.message}`);
      }

      const now = new Date();
      const today = now.toISOString().split('T')[0];

      if (currentStats) {
        // Calculate new streak
        const newStreak = calculateStreak(currentStats.last_walk_date, today, currentStats.current_streak_days || 0);
        
        // Update existing statistics
        const updateData = {
          total_walks: (currentStats.total_walks || 0) + 1,
          total_distance_km: (currentStats.total_distance_km || 0) + input.distance_km,
          total_duration_minutes: (currentStats.total_duration_minutes || 0) + input.duration_minutes,
          total_steps: (currentStats.total_steps || 0) + input.steps,
          total_calories_burned: (currentStats.total_calories_burned || 0) + input.calories_burned,
          current_streak_days: newStreak,
          longest_streak_days: Math.max(
            currentStats.longest_streak_days || 0,
            newStreak
          ),
          last_walk_date: today,
          updated_at: now.toISOString()
        };
        
        console.log('[updateUserStats] Updating with data:', updateData);
        
        const { data: updatedStats, error: updateError } = await ctx.supabase
          .from('user_statistics')
          .update(updateData)
          .eq('user_id', ctx.user.id)
          .select()
          .single();

        if (updateError) {
          console.error('[updateUserStats] Error updating stats:', updateError);
          throw new Error(`Failed to update statistics: ${updateError.message}`);
        }
        
        console.log('[updateUserStats] Successfully updated existing stats');
        return updatedStats;
      } else {
        // Create new statistics record
        const insertData = {
          user_id: ctx.user.id,
          total_walks: 1,
          total_distance_km: input.distance_km,
          total_duration_minutes: input.duration_minutes,
          total_steps: input.steps,
          total_calories_burned: input.calories_burned,
          current_streak_days: 1,
          longest_streak_days: 1,
          last_walk_date: today,
          created_at: now.toISOString(),
          updated_at: now.toISOString()
        };
        
        console.log('[updateUserStats] Creating new stats with data:', insertData);

        const { data: newStats, error: insertError } = await ctx.supabase
          .from('user_statistics')
          .insert(insertData)
          .select()
          .single();

        if (insertError) {
          console.error('[updateUserStats] Error creating new stats:', insertError);
          throw new Error(`Failed to create statistics: ${insertError.message}`);
        }
        
        console.log('[updateUserStats] Successfully created new stats record');
        return newStats;
      }
    } catch (error: any) {
      console.error('[updateUserStats] Exception:', error);
      throw new Error(`Failed to update user statistics: ${error.message}`);
    }
  });

// Helper function to calculate streak
function calculateStreak(lastWalkDate: string | null, todayDate: string, currentStreak: number): number {
  if (!lastWalkDate) return 1;
  
  const lastDate = new Date(lastWalkDate);
  const today = new Date(todayDate);
  const diffTime = today.getTime() - lastDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    // Same day, maintain current streak
    return currentStreak;
  } else if (diffDays === 1) {
    // Consecutive day, increment streak
    return currentStreak + 1;
  } else {
    // Gap in days, reset streak
    return 1;
  }
}