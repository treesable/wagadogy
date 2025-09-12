import { z } from 'zod';
import { protectedProcedure } from '../../../create-context';
import { scheduleUpdateEmitter } from '../subscribe-schedule-updates/route';

const updateWalkScheduleSchema = z.object({
  schedule_id: z.string().uuid(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  scheduled_date: z.string().date().optional(),
  scheduled_time: z.string().time().optional(),
  duration_minutes: z.number().int().positive().optional(),
  location_name: z.string().min(1).max(255).optional(),
  location_coordinates: z.object({
    latitude: z.number(),
    longitude: z.number()
  }).optional(),
  location_address: z.string().optional(),
  max_participants: z.number().int().positive().optional(),
  status: z.enum(['scheduled', 'completed', 'cancelled']).optional(),
  reminder_sent: z.boolean().optional(),
  notes: z.string().optional()
});

export const updateWalkScheduleProcedure = protectedProcedure
  .input(updateWalkScheduleSchema)
  .mutation(async ({ ctx, input }) => {
    console.log('[updateWalkSchedule] Updating walk schedule:', input.schedule_id, 'for user:', ctx.user.id);
    console.log('[updateWalkSchedule] Input data:', input);

    try {
      // First check if user has permission to update this schedule
      const { data: existingSchedule, error: fetchError } = await ctx.supabase
        .from('walk_schedules')
        .select('organizer_id, partner_id')
        .eq('id', input.schedule_id)
        .single();

      if (fetchError) {
        console.error('[updateWalkSchedule] Error fetching schedule:', fetchError);
        throw new Error(`Schedule not found: ${fetchError.message}`);
      }

      if (existingSchedule.organizer_id !== ctx.user.id && existingSchedule.partner_id !== ctx.user.id) {
        console.error('[updateWalkSchedule] User not authorized to update this schedule');
        throw new Error('Not authorized to update this schedule');
      }

      const { schedule_id, ...updateData } = input;
      
      const { data, error } = await ctx.supabase
        .from('walk_schedules')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', schedule_id)
        .select()
        .single();

      if (error) {
        console.error('[updateWalkSchedule] Error updating walk schedule:', error);
        throw new Error(`Failed to update walk schedule: ${error.message}`);
      }

      console.log('[updateWalkSchedule] Successfully updated walk schedule:', data.id);
      
      // Emit real-time update
      const updateType = updateData.status === 'completed' ? 'schedule_completed' : 
                        updateData.status === 'cancelled' ? 'schedule_cancelled' : 
                        'schedule_updated';
      
      scheduleUpdateEmitter.emit('schedule_update', {
        type: updateType,
        schedule: data,
        user_id: ctx.user.id
      });
      
      return data;
    } catch (error: any) {
      console.error('[updateWalkSchedule] Exception:', error);
      throw new Error(`Failed to update walk schedule: ${error.message}`);
    }
  });