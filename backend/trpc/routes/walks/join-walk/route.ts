import { z } from 'zod';
import { protectedProcedure } from '../../../create-context';

const joinWalkSchema = z.object({
  walk_id: z.string().uuid(),
  dog_id: z.string().uuid().optional()
});

export const joinWalkProcedure = protectedProcedure
  .input(joinWalkSchema)
  .mutation(async ({ ctx, input }) => {
    console.log('[joinWalk] User joining walk:', input.walk_id, 'user:', ctx.user.id);

    try {
      // Check if walk exists and has space
      const { data: walkSchedule, error: walkError } = await ctx.supabase
        .from('walk_schedules')
        .select('max_participants, status')
        .eq('id', input.walk_id)
        .single();

      if (walkError) {
        console.error('[joinWalk] Error fetching walk schedule:', walkError);
        throw new Error(`Walk not found: ${walkError.message}`);
      }

      if (walkSchedule.status !== 'scheduled') {
        throw new Error('Cannot join a walk that is not scheduled');
      }

      // Check current participant count
      const { count: currentParticipants, error: countError } = await ctx.supabase
        .from('walk_participants')
        .select('*', { count: 'exact', head: true })
        .eq('walk_id', input.walk_id)
        .eq('status', 'joined');

      if (countError) {
        console.error('[joinWalk] Error counting participants:', countError);
        throw new Error(`Failed to check participant count: ${countError.message}`);
      }

      if ((currentParticipants || 0) >= walkSchedule.max_participants) {
        throw new Error('Walk is already full');
      }

      // Check if user is already a participant
      const { data: existingParticipant } = await ctx.supabase
        .from('walk_participants')
        .select('id, status')
        .eq('walk_id', input.walk_id)
        .eq('user_id', ctx.user.id)
        .single();

      if (existingParticipant) {
        if (existingParticipant.status === 'joined') {
          throw new Error('You are already participating in this walk');
        }
        
        // Update existing participant status
        const { data, error } = await ctx.supabase
          .from('walk_participants')
          .update({
            status: 'joined',
            dog_id: input.dog_id,
            joined_at: new Date().toISOString()
          })
          .eq('id', existingParticipant.id)
          .select()
          .single();

        if (error) {
          console.error('[joinWalk] Error updating participant:', error);
          throw new Error(`Failed to join walk: ${error.message}`);
        }

        console.log('[joinWalk] Successfully rejoined walk');
        return data;
      }

      // Create new participant
      const { data, error } = await ctx.supabase
        .from('walk_participants')
        .insert({
          walk_id: input.walk_id,
          user_id: ctx.user.id,
          dog_id: input.dog_id,
          status: 'joined',
          joined_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('[joinWalk] Error creating participant:', error);
        throw new Error(`Failed to join walk: ${error.message}`);
      }

      console.log('[joinWalk] Successfully joined walk');
      return data;
    } catch (error: any) {
      console.error('[joinWalk] Exception:', error);
      throw new Error(`Failed to join walk: ${error.message}`);
    }
  });