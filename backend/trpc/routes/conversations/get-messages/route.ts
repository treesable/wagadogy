import { z } from 'zod';
import { protectedProcedure } from '../../../create-context';

export const getMessagesProcedure = protectedProcedure
  .input(z.object({
    conversationId: z.string(),
  }))
  .query(async ({ ctx, input }) => {
    const { supabase, user } = ctx;
    const { conversationId } = input;
    
    try {
      console.log('[tRPC] Getting messages for conversation:', conversationId, 'user:', user.id);
      
      // First verify the conversation exists and user has access
      const { data: convData, error: convErr } = await supabase
        .from('conversations')
        .select(`
          id,
          match_id,
          matches!inner(
            user1_id,
            user2_id
          )
        `)
        .eq('id', conversationId)
        .eq('is_active', true)
        .single();
        
      if (convErr) {
        console.error('[tRPC] Error querying conversation:', convErr);
        throw new Error('Conversation not found');
      }
      
      if (!convData) {
        console.error('[tRPC] Conversation not found:', conversationId);
        throw new Error('Conversation not found');
      }
      
      // Check if user is a participant (either user1 or user2 in the match)
      const match = convData.matches as any;
      const isParticipant = match.user1_id === user.id || match.user2_id === user.id;
      
      if (!isParticipant) {
        console.error('[tRPC] User not authorized for conversation:', user.id);
        throw new Error('Not authorized to access this conversation');
      }
      
      // Get messages for this conversation
      const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
        
      if (msgError) {
        console.error('[tRPC] Error fetching messages:', msgError);
        throw new Error('Failed to fetch messages');
      }
      
      // Get the other user's dog profile for the header
      const otherUserId = match.user1_id === user.id ? match.user2_id : match.user1_id;
      
      // Get the other user's dog profile
      const { data: otherUserDog, error: dogError } = await supabase
        .from('dog_profiles')
        .select(`
          id,
          name,
          owner_id,
          user_profiles!inner(
            full_name
          )
        `)
        .eq('owner_id', otherUserId)
        .maybeSingle();
        
      let dogProfile = null;
      if (dogError) {
        console.error('[tRPC] Error fetching dog profile:', dogError);
      }
      
      if (!dogError && otherUserDog) {
        // Get photos for this dog
        const { data: photos } = await supabase
          .from('dog_photos')
          .select('photo_url, is_primary, order_index')
          .eq('dog_id', otherUserDog.id)
          .order('order_index', { ascending: true });
          
        dogProfile = {
          id: otherUserDog.id,
          name: otherUserDog.name,
          ownerName: (otherUserDog.user_profiles as any)?.full_name,
          photos: (photos || []).map((p: any) => p.photo_url)
        };
      }
      
      console.log('[tRPC] Successfully loaded', messages?.length || 0, 'messages and dog profile:', dogProfile?.name);
      return {
        conversation: convData,
        messages: messages || [],
        dogProfile
      };
      
    } catch (error) {
      console.error('[tRPC] Error in getMessages:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to get messages');
    }
  });