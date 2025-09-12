import { z } from 'zod';
import { protectedProcedure } from '../../../create-context';

const getWalkHistorySchema = z.object({
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  completed_only: z.boolean().default(true)
});

export const getWalkHistoryProcedure = protectedProcedure
  .input(getWalkHistorySchema)
  .query(async ({ ctx, input }) => {
    console.log('[getWalkHistory] Fetching walk history for user:', ctx.user.id);
    console.log('[getWalkHistory] Input params:', input);

    try {
      let query = ctx.supabase
        .from('walk_sessions')
        .select(`
          *,
          walk_schedules (
            title,
            location_name,
            partner_id
          )
        `)
        .eq('user_id', ctx.user.id)
        .order('created_at', { ascending: false })
        .range(input.offset, input.offset + input.limit - 1);

      if (input.completed_only) {
        query = query.eq('is_completed', true);
      }

      if (input.start_date) {
        query = query.gte('start_time', input.start_date);
      }

      if (input.end_date) {
        query = query.lte('start_time', input.end_date);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('[getWalkHistory] Error fetching walk history:', error);
        throw new Error(`Failed to fetch walk history: ${error.message}`);
      }

      console.log('[getWalkHistory] Successfully fetched', data?.length || 0, 'walk sessions');
      
      return {
        walks: data || [],
        total: count || 0,
        hasMore: (input.offset + input.limit) < (count || 0)
      };
    } catch (error: any) {
      console.error('[getWalkHistory] Exception:', error);
      throw new Error(`Failed to fetch walk history: ${error.message}`);
    }
  });