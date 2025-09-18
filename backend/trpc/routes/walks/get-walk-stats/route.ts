import { z } from 'zod';
import { protectedProcedure } from '../../../create-context';

const getWalkStatsSchema = z.object({
  period: z.enum(['day', 'week', 'month', 'year']).default('week'),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional()
});

export const getWalkStatsProcedure = protectedProcedure
  .input(getWalkStatsSchema)
  .query(async ({ ctx, input }) => {
    console.log('[getWalkStats] Starting - user ID:', ctx.user.id);
    console.log('[getWalkStats] User email:', ctx.user.email);
    console.log('[getWalkStats] Input params:', input);

    try {
      // Test database connection first
      console.log('[getWalkStats] Testing database connection...');
      const { error: testError } = await ctx.supabase
        .from('walk_sessions')
        .select('id')
        .limit(1);
      
      if (testError) {
        console.error('[getWalkStats] Database connection test failed:', testError);
        console.error('[getWalkStats] Test error details:', {
          code: testError.code,
          message: testError.message,
          details: testError.details,
          hint: testError.hint
        });
        // Don't throw here, continue with the actual query
      } else {
        console.log('[getWalkStats] Database connection test successful');
      }

      let startDate: string;
      let endDate: string;

      if (input.start_date && input.end_date) {
        startDate = input.start_date;
        endDate = input.end_date;
      } else {
        const now = new Date();
        endDate = now.toISOString();

        switch (input.period) {
          case 'day':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
            break;
          case 'week':
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay());
            weekStart.setHours(0, 0, 0, 0);
            startDate = weekStart.toISOString();
            break;
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            break;
          case 'year':
            startDate = new Date(now.getFullYear(), 0, 1).toISOString();
            break;
        }
      }

      console.log('[getWalkStats] Date range:', { startDate, endDate });

      // Get walk sessions within the period
      console.log('[getWalkStats] Fetching walk sessions...');
      const { data: walkSessions, error } = await ctx.supabase
        .from('walk_sessions')
        .select('*')
        .eq('user_id', ctx.user.id)
        .eq('is_completed', true)
        .gte('start_time', startDate)
        .lte('start_time', endDate);

      console.log('[getWalkStats] Query result - sessions found:', walkSessions?.length || 0);
      console.log('[getWalkStats] Query error:', error);

      if (error) {
        console.error('[getWalkStats] Error fetching walk sessions:', error);
        console.error('[getWalkStats] Error code:', error.code);
        console.error('[getWalkStats] Error message:', error.message);
        console.error('[getWalkStats] Error details:', error.details);
        throw new Error(`Failed to fetch walk stats: ${error.message}`);
      }

      // Calculate statistics
      const totalWalks = walkSessions?.length || 0;
      const totalDistance = walkSessions?.reduce((sum, walk) => sum + (Number(walk.distance_km) || 0), 0) || 0;
      const totalDuration = walkSessions?.reduce((sum, walk) => sum + (Number(walk.duration_minutes) || 0), 0) || 0;
      const totalSteps = walkSessions?.reduce((sum, walk) => sum + (Number(walk.steps) || 0), 0) || 0;
      const totalCalories = walkSessions?.reduce((sum, walk) => sum + (Number(walk.calories_burned) || 0), 0) || 0;

      const avgDistance = totalWalks > 0 ? totalDistance / totalWalks : 0;
      const avgDuration = totalWalks > 0 ? totalDuration / totalWalks : 0;
      const avgSpeed = totalDuration > 0 ? (totalDistance / (totalDuration / 60)) : 0;

      console.log('[getWalkStats] Calculated totals:', {
        totalWalks,
        totalDistance,
        totalDuration,
        totalSteps,
        totalCalories
      });

      // Calculate daily breakdown for charts
      const dailyStats: Record<string, { walks: number; distance: number; duration: number; steps: number }> = {};
      
      walkSessions?.forEach(walk => {
        const walkDate = new Date(walk.start_time).toISOString().split('T')[0];
        if (!dailyStats[walkDate]) {
          dailyStats[walkDate] = { walks: 0, distance: 0, duration: 0, steps: 0 };
        }
        dailyStats[walkDate].walks += 1;
        dailyStats[walkDate].distance += Number(walk.distance_km) || 0;
        dailyStats[walkDate].duration += Number(walk.duration_minutes) || 0;
        dailyStats[walkDate].steps += Number(walk.steps) || 0;
      });

      console.log('[getWalkStats] Daily breakdown:', dailyStats);

      const stats = {
        period: input.period,
        startDate,
        endDate,
        totalWalks: Number(totalWalks) || 0,
        totalDistance: Math.round((Number(totalDistance) || 0) * 100) / 100,
        totalDuration: Number(totalDuration) || 0,
        totalSteps: Number(totalSteps) || 0,
        totalCalories: Number(totalCalories) || 0,
        avgDistance: Math.round((Number(avgDistance) || 0) * 100) / 100,
        avgDuration: Math.round(Number(avgDuration) || 0),
        avgSpeed: Math.round((Number(avgSpeed) || 0) * 100) / 100,
        dailyBreakdown: dailyStats || {}
      };

      console.log('[getWalkStats] Successfully calculated stats:', stats);
      return stats;
    } catch (error: any) {
      console.error('[getWalkStats] Exception:', error);
      console.error('[getWalkStats] Error details:', {
        message: error?.message,
        name: error?.name,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        stack: error?.stack?.substring(0, 500)
      });
      
      // Don't return fallback stats on error - let the error propagate to the client
      // This way the client can show proper error messages and retry functionality
      console.error('[getWalkStats] Throwing error to client for proper error handling');
      throw new Error(`Failed to fetch walk statistics: ${error?.message || 'Unknown database error'}`);
    }
  });