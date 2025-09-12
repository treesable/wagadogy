import { z } from 'zod';
import { protectedProcedure } from '../../../create-context';
import { scheduleUpdateEmitter } from '../subscribe-schedule-updates/route';

const createWalkScheduleSchema = z.object({
  partner_id: z.string().uuid().optional(),
  conversation_id: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  scheduled_date: z.string().date(),
  scheduled_time: z.string().time(),
  duration_minutes: z.number().int().positive().optional(),
  location_name: z.string().min(1).max(255),
  location_coordinates: z.object({
    latitude: z.number(),
    longitude: z.number()
  }).optional(),
  location_address: z.string().optional(),
  max_participants: z.number().int().positive().default(2),
  is_group_walk: z.boolean().default(false),
  notes: z.string().optional()
});

export const createWalkScheduleProcedure = protectedProcedure
  .input(createWalkScheduleSchema)
  .mutation(async ({ ctx, input }) => {
    console.log('[createWalkSchedule] Creating walk schedule for user:', ctx.user.id);
    console.log('[createWalkSchedule] Input data:', input);

    try {
      const { data, error } = await ctx.supabase
        .from('walk_schedules')
        .insert({
          organizer_id: ctx.user.id,
          partner_id: input.partner_id,
          conversation_id: input.conversation_id,
          title: input.title,
          description: input.description,
          scheduled_date: input.scheduled_date,
          scheduled_time: input.scheduled_time,
          duration_minutes: input.duration_minutes,
          location_name: input.location_name,
          location_coordinates: input.location_coordinates,
          location_address: input.location_address,
          max_participants: input.max_participants,
          is_group_walk: input.is_group_walk,
          status: 'scheduled',
          reminder_sent: false,
          notes: input.notes,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('[createWalkSchedule] Error creating walk schedule:', error);
        throw new Error(`Failed to create walk schedule: ${error.message}`);
      }

      console.log('[createWalkSchedule] Successfully created walk schedule:', data.id);
      
      // Emit real-time update
      scheduleUpdateEmitter.emit('schedule_update', {
        type: 'schedule_created',
        schedule: data,
        user_id: ctx.user.id
      });
      
      return data;
    } catch (error: any) {
      console.error('[createWalkSchedule] Exception:', error);
      throw new Error(`Failed to create walk schedule: ${error.message}`);
    }
  });