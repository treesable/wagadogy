import { protectedProcedure } from '../../../create-context';

export const getConversationsProcedure = protectedProcedure
  .query(async ({ ctx }) => {
    const { supabase, user } = ctx;
    
    try {
      console.log('[tRPC] Loading conversations for user:', user.id);
      
      // Get all matches where the user is either user1 or user2
      const { data: userMatches, error: matchError } = await supabase
        .from('matches')
        .select('id')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .eq('is_active', true);
        
      if (matchError) {
        console.error('[tRPC] Error fetching user matches:', matchError);
        throw new Error('Failed to fetch user matches');
      }
      
      if (!userMatches || userMatches.length === 0) {
        console.log('[tRPC] No matches found for user');
        return [];
      }
      
      const matchIds = userMatches.map((match: any) => match.id);
      
      // Get conversations for these matches
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .in('match_id', matchIds)
        .eq('is_active', true)
        .order('last_message_at', { ascending: false });
        
      if (convError) {
        console.error('[tRPC] Error fetching conversations:', convError);
        throw new Error('Failed to fetch conversations');
      }
      
      // Get messages for each conversation
      const conversationsWithMessages = await Promise.all(
        (conversations || []).map(async (conv: any) => {
          const { data: messages, error: msgError } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: true });
            
          if (msgError) {
            console.error('[tRPC] Error fetching messages for conversation:', conv.id, msgError);
            return {
              ...conv,
              messages: []
            };
          }
          
          return {
            ...conv,
            messages: messages || []
          };
        })
      );
      
      console.log('[tRPC] Successfully loaded', conversationsWithMessages.length, 'conversations');
      return conversationsWithMessages;
      
    } catch (error) {
      console.error('[tRPC] Error in getConversations:', error);
      throw new Error('Failed to load conversations');
    }
  });