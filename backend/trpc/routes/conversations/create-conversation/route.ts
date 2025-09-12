import { z } from 'zod';
import { protectedProcedure } from '../../../create-context';

export const createConversationProcedure = protectedProcedure
  .input(z.object({
    matchId: z.string(),
  }))
  .mutation(async ({ ctx, input }) => {
    const { supabase, user } = ctx;
    const { matchId } = input;
    
    try {
      console.log('[createConversation] Starting for match:', matchId);
      console.log('[createConversation] User ID:', user.id);
      console.log('[createConversation] User email:', user.email);
      console.log('[createConversation] User role:', user.role);
      console.log('[createConversation] Supabase client exists:', !!supabase);
      
      // Test the supabase connection with a simple query
      const { data: testData, error: testError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', user.id)
        .single();
      
      if (testError) {
        console.error('[createConversation] Supabase connection test failed:', testError);
        throw new Error(`Database connection failed: ${testError.message}`);
      }
      
      console.log('[createConversation] Supabase connection test passed, user profile exists:', !!testData);
      
      // First try to find match by ID directly
      let matchData: any = null;
      let matchError: any = null;
      
      const { data: directMatch, error: directError } = await supabase
        .from('matches')
        .select('id, user1_id, user2_id')
        .eq('id', matchId)
        .eq('is_active', true)
        .single();
        
      if (!directError && directMatch) {
        matchData = directMatch;
        console.log('[createConversation] Found match by ID:', directMatch.id);
      } else {
        console.log('[createConversation] Match not found by ID, trying to find by dog profile ID:', matchId);
        
        // If not found by match ID, try to find by dog profile ID
        // This handles the case where matchId is actually a dog profile ID
        const { data: dogProfile, error: dogError } = await supabase
          .from('dog_profiles')
          .select('owner_id')
          .eq('id', matchId)
          .single();
          
        if (!dogError && dogProfile) {
          console.log('[createConversation] Found dog profile, owner:', dogProfile.owner_id);
          
          // Find match between current user and the dog's owner
          const { data: foundMatch, error: foundError } = await supabase
            .from('matches')
            .select('id, user1_id, user2_id')
            .or(`and(user1_id.eq.${user.id},user2_id.eq.${dogProfile.owner_id}),and(user1_id.eq.${dogProfile.owner_id},user2_id.eq.${user.id})`)
            .eq('is_active', true)
            .single();
            
          if (!foundError && foundMatch) {
            matchData = foundMatch;
            console.log('[createConversation] Found match by dog owner:', foundMatch.id);
          } else {
            console.error('[createConversation] No match found between users:', foundError);
            matchError = foundError;
          }
        } else {
          console.error('[createConversation] Dog profile not found:', dogError);
          matchError = dogError;
        }
      }
        
      if (!matchData) {
        console.error('[createConversation] Error finding match:', matchError);
        throw new Error('Match not found');
      }
      
      // Check if user is part of this match
      const isParticipant = matchData.user1_id === user.id || matchData.user2_id === user.id;
      if (!isParticipant) {
        console.error('[createConversation] User not authorized for match:', user.id);
        throw new Error('Not authorized to create conversation for this match');
      }
      
      console.log('[createConversation] Current conversations count:', await supabase.from('conversations').select('id', { count: 'exact' }).then(r => r.count));
      
      // Use the actual match ID we found
      const actualMatchId = matchData.id;
      console.log('[createConversation] Using actual match ID:', actualMatchId);
      
      // Check if conversation already exists for this match
      const { data: existingConv, error: existingError } = await supabase
        .from('conversations')
        .select('id')
        .eq('match_id', actualMatchId)
        .eq('is_active', true)
        .maybeSingle();
        
      if (existingError) {
        console.error('[createConversation] Error checking existing conversation:', existingError);
      }
      
      if (existingConv) {
        console.log('[createConversation] Found existing conversation:', existingConv.id);
        return { id: existingConv.id };
      }
      
      // Create new conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          match_id: actualMatchId,
          is_active: true,
          created_at: new Date().toISOString(),
          last_message_at: new Date().toISOString(),
        })
        .select('id')
        .single();
        
      if (convError) {
        console.error('[createConversation] Error creating conversation:', convError);
        throw new Error(`Failed to create conversation: ${convError.message}`);
      }
      
      console.log('[createConversation] Conversation created successfully:', conversation.id);
      return conversation;
      
    } catch (error) {
      console.error('[createConversation] Error in createConversation:', error);
      if (error instanceof Error) {
        throw error; // Re-throw with original message
      }
      throw new Error('Failed to create conversation');
    }
  });