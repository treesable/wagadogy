import { z } from 'zod';
import { protectedProcedure } from '../../../create-context';

const getWalkSchedulesSchema = z.object({
  status: z.enum(['scheduled', 'completed', 'cancelled']).optional(),
  upcoming_only: z.boolean().default(true),
  limit: z.number().int().positive().max(50).default(20),
  offset: z.number().int().nonnegative().default(0)
});

export const getWalkSchedulesProcedure = protectedProcedure
  .input(getWalkSchedulesSchema)
  .query(async ({ ctx, input }) => {
    console.log('[getWalkSchedules] Fetching walk schedules for user:', ctx.user.id);
    console.log('[getWalkSchedules] Input params:', input);

    try {
      let query = ctx.supabase
        .from('walk_schedules')
        .select(`
          *,
          walk_participants!inner (
            user_id,
            status
          )
        `)
        .or(`organizer_id.eq.${ctx.user.id},partner_id.eq.${ctx.user.id}`)
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true })
        .range(input.offset, input.offset + input.limit - 1);

      if (input.status) {
        query = query.eq('status', input.status);
      }

      if (input.upcoming_only) {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const currentTime = now.toTimeString().split(' ')[0];
        
        query = query.or(`scheduled_date.gt.${today},and(scheduled_date.eq.${today},scheduled_time.gte.${currentTime})`);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('[getWalkSchedules] Error fetching walk schedules:', error);
        throw new Error(`Failed to fetch walk schedules: ${error.message}`);
      }

      console.log('[getWalkSchedules] Successfully fetched', data?.length || 0, 'walk schedules');
      
      return {
        schedules: data || [],
        total: count || 0,
        hasMore: (input.offset + input.limit) < (count || 0)
      };
    } catch (error: any) {
      console.error('[getWalkSchedules] Exception:', error);
      throw new Error(`Failed to fetch walk schedules: ${error.message}`);
    }
  });