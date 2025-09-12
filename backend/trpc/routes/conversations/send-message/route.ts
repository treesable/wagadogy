import { z } from 'zod';
import { protectedProcedure } from '../../../create-context';

export const sendMessageProcedure = protectedProcedure
  .input(z.object({
    conversationId: z.string(),
    content: z.string(),
    messageType: z.string().optional().default('text'),
  }))
  .mutation(async ({ ctx, input }) => {
    const { supabase, user } = ctx;
    const { conversationId, content, messageType } = input;
    
    try {
      console.log('[tRPC] Sending message to conversation:', conversationId, 'from user:', user.id);
      
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
        throw new Error('Conversation not found. Please create the conversation first using the createConversation endpoint.');
      }
      
      if (!convData) {
        console.error('[tRPC] Conversation not found:', conversationId);
        throw new Error('Conversation not found. Please create the conversation first using the createConversation endpoint.');
      }
      
      console.log('[tRPC] Found conversation:', convData.id, 'for match:', convData.match_id);
      
      // Check if user is a participant (either user1 or user2 in the match)
      const match = convData.matches as any;
      const isParticipant = match.user1_id === user.id || match.user2_id === user.id;
      
      if (!isParticipant) {
        console.error('[tRPC] User not authorized for conversation:', user.id, 'match users:', match.user1_id, match.user2_id);
        throw new Error('Not authorized to send messages to this conversation');
      }
      
      console.log('[tRPC] User authorized, inserting message...');
      
      // Insert the message
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content,
          message_type: messageType,
          created_at: new Date().toISOString(),
        })
        .select('*')
        .single();
        
      if (messageError) {
        console.error('[tRPC] Error inserting message:', messageError);
        throw new Error(`Failed to insert message: ${messageError.message}`);
      }
      
      // Update conversation's last_message_at
      const { error: updateError } = await supabase
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
        })
        .eq('id', conversationId);
        
      if (updateError) {
        console.error('[tRPC] Error updating conversation timestamp:', updateError);
      }
      
      console.log('[tRPC] Message sent successfully:', message.id);
      return message;
      
    } catch (error) {
      console.error('[tRPC] Error in sendMessage:', error);
      if (error instanceof Error) {
        throw error; // Re-throw with original message
      }
      throw new Error('Failed to send message');
    }
  });