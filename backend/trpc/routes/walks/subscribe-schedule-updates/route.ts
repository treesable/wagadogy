import { z } from 'zod';
import { protectedProcedure } from '../../../create-context';
import { observable } from '@trpc/server/observable';
import { EventEmitter } from 'events';

// Create a global event emitter for schedule updates
const scheduleUpdateEmitter = new EventEmitter();

// Export the emitter so other procedures can emit events
export { scheduleUpdateEmitter };

const subscribeScheduleUpdatesSchema = z.object({
  user_id: z.string().uuid().optional() // Optional filter by user
});

export const subscribeScheduleUpdatesProcedure = protectedProcedure
  .input(subscribeScheduleUpdatesSchema)
  .subscription(async ({ ctx, input }) => {
    console.log('[subscribeScheduleUpdates] Starting subscription for user:', ctx.user.id);
    
    return observable<{
      type: 'schedule_created' | 'schedule_updated' | 'schedule_cancelled' | 'schedule_completed';
      schedule: any;
      user_id: string;
    }>((emit) => {
      const handleScheduleUpdate = (data: any) => {
        // Only emit updates relevant to this user
        if (data.user_id === ctx.user.id || 
            data.schedule?.organizer_id === ctx.user.id || 
            data.schedule?.partner_id === ctx.user.id) {
          console.log('[subscribeScheduleUpdates] Emitting update for user:', ctx.user.id, 'Type:', data.type);
          emit.next(data);
        }
      };

      // Listen for schedule updates
      scheduleUpdateEmitter.on('schedule_update', handleScheduleUpdate);

      // Cleanup function
      return () => {
        console.log('[subscribeScheduleUpdates] Cleaning up subscription for user:', ctx.user.id);
        scheduleUpdateEmitter.off('schedule_update', handleScheduleUpdate);
      };
    });
  });