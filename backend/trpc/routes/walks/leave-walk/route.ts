import { z } from 'zod';
import { protectedProcedure } from '../../../create-context';

const leaveWalkSchema = z.object({
  walk_id: z.string().uuid()
});

export const leaveWalkProcedure = protectedProcedure
  .input(leaveWalkSchema)
  .mutation(async ({ ctx, input }) => {
    console.log('[leaveWalk] User leaving walk:', input.walk_id, 'user:', ctx.user.id);

    try {
      // Update participant status to 'left'
      const { data, error } = await ctx.supabase
        .from('walk_participants')
        .update({
          status: 'left',
          left_at: new Date().toISOString()
        })
        .eq('walk_id', input.walk_id)
        .eq('user_id', ctx.user.id)
        .select()
        .single();

      if (error) {
        console.error('[leaveWalk] Error leaving walk:', error);
        throw new Error(`Failed to leave walk: ${error.message}`);
      }

      if (!data) {
        throw new Error('You are not a participant in this walk');
      }

      console.log('[leaveWalk] Successfully left walk');
      return data;
    } catch (error: any) {
      console.error('[leaveWalk] Exception:', error);
      throw new Error(`Failed to leave walk: ${error.message}`);
    }
  });