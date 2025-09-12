import createContextHook from "@nkzw/create-context-hook";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DogProfile, UserProfile, UserPreferences, UserSettings, WalkingStats, Conversation, Message, WalkDetails, PresetMessage, ScheduledWalk, DogProfileData, DogPhoto } from "@/types/app";
import { useAuth } from "@/contexts/AuthContext";
import { createTRPCClient } from "@/lib/trpc";

interface AppState {
  matches: DogProfile[];
  likedProfiles: string[];
  userProfile: UserProfile;
  walkingStats: WalkingStats;
  conversations: Conversation[];
  presetMessages: PresetMessage[];
  scheduledWalks: ScheduledWalk[];
  dailyStats: { [date: string]: { minutes: number; distance: number; walks: number } };
  addMatch: (profile: DogProfile) => void;
  addLikedProfile: (profileId: string) => void;
  updateUserProfile: (profile: UserProfile) => Promise<void>;
  updateWalkingStats: (stats: WalkingStats) => void;
  updateDailyStats: (date: string, minutes: number, distance: number) => void;
  getWeeklyChartData: () => { day: string; value: number }[];
  getAchievements: () => { id: string; title: string; description: string; icon: string; unlocked: boolean }[];
  sendMessage: (conversationId: string, message: Omit<Message, 'id' | 'timestamp'>) => Promise<void>;
  createConversation: (matchId: string) => Promise<string>;
  getConversation: (conversationId: string) => Conversation | undefined;
  loadConversationById: (conversationId: string) => Promise<void>;
  markAsRead: (conversationId: string) => void;
  scheduleWalk: (conversationId: string, walkDetails: Omit<WalkDetails, 'id' | 'status'>) => void;
  confirmWalk: (conversationId: string, walkId: string) => void;
  getUpcomingWalks: () => ScheduledWalk[];
  completeWalk: (walkId: string) => void;
  cancelWalk: (walkId: string) => void;
  sendWalkReminder: (walkId: string) => void;
}

const defaultPreferences: UserPreferences = {
  lookingFor: "All",
  preferredSize: "All sizes",
  maxDistance: 5,
  ageRange: "All ages",
  activityLevel: "Moderate",
  playStyle: "All styles",
  availableTimes: ["Morning", "Evening"],
};

const defaultUserSettings: UserSettings = {
  userId: "",
  distancePreference: 25,
  ageRangeMin: 1,
  ageRangeMax: 15,
  sizePreferences: ["Small", "Medium", "Large"],
  notificationPreferences: {
    matches: true,
    messages: true,
    walkReminders: true,
  },
  privacySettings: {
    showLocation: true,
    showLastSeen: true,
  },
};

const defaultDogProfile: DogProfileData = {
  id: "temp-default-dog",
  name: "Max",
  breed: "Golden Retriever",
  age: 3,
  size: "Large",
  weight: 30.5,
  gender: "Male",
  isNeutered: true,
  bio: "Friendly golden who loves fetch and swimming! Looking for playmates who enjoy outdoor adventures.",
  personalityTraits: ["Friendly", "Energetic", "Loyal"],
  energyLevel: 4,
  friendlinessLevel: 5,
  trainingLevel: 3,
  healthNotes: "No known health issues. Regular vet checkups.",
  vaccinationStatus: true,
  vaccinationDate: "2024-01-15",
  isPrimary: true,
  isActive: true,
  photos: [{
    photoUrl: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400",
    isPrimary: true,
    orderIndex: 0,
  }],
  ownerId: "temp-user", // This will be replaced with actual user ID
  createdAt: new Date().toISOString(),
};

const defaultUserProfile: UserProfile = {
  id: "temp-user", // This will be replaced with actual user ID
  email: "john.doe@example.com",
  fullName: "John Doe",
  phone: "+1 (555) 123-4567",
  bio: "Dog lover and outdoor enthusiast",
  preferences: defaultPreferences,
  userSettings: defaultUserSettings,
  isActive: true,
  dogProfiles: [], // Start with empty array, will be populated from database
  activeDogId: undefined,
  dogName: defaultDogProfile.name,
  dogPhoto: defaultDogProfile.photos[0]?.photoUrl || "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400",
  breed: defaultDogProfile.breed,
  age: defaultDogProfile.age,
  size: defaultDogProfile.size,
  weight: defaultDogProfile.weight,
  gender: defaultDogProfile.gender,
  isNeutered: defaultDogProfile.isNeutered,
  dogBio: defaultDogProfile.bio,
  personalityTraits: defaultDogProfile.personalityTraits,
  energyLevel: defaultDogProfile.energyLevel,
  friendlinessLevel: defaultDogProfile.friendlinessLevel,
  trainingLevel: defaultDogProfile.trainingLevel,
  healthNotes: defaultDogProfile.healthNotes,
  vaccinationStatus: defaultDogProfile.vaccinationStatus,
  vaccinationDate: defaultDogProfile.vaccinationDate,
  isPrimary: defaultDogProfile.isPrimary,
  dogIsActive: defaultDogProfile.isActive,
  ownerName: "John Doe",
  displayName: "John Doe",
};

const defaultWalkingStats: WalkingStats = {
  todayMinutes: 0,
  todayDistance: 0,
  weeklyMinutes: 0,
  weeklyDistance: 0,
  totalWalks: 0,
  streak: 0,
};

const defaultPresetMessages: PresetMessage[] = [
  { id: '1', text: 'Wag to meet for a walk? 🐕', category: 'greeting' },
  { id: '2', text: 'What time works for you?', category: 'scheduling' },
  { id: '3', text: 'How about the park nearby?', category: 'walk_request' },
  { id: '4', text: 'My pup loves morning walks!', category: 'casual' },
  { id: '5', text: 'Are you free this weekend?', category: 'scheduling' },
  { id: '6', text: 'Great match! Our dogs will love each other 🎾', category: 'greeting' },
  { id: '7', text: 'Perfect! See you there 👋', category: 'casual' },
  { id: '8', text: 'Let\'s schedule a playdate!', category: 'walk_request' },
];

const parseDbLocation = (input: unknown): { lat: number; lng: number } | undefined => {
  try {
    if (!input) return undefined;
    if (typeof input === 'string') {
      const str = input.trim();
      if (str.startsWith('POINT')) {
        const inside = str.slice(str.indexOf('(') + 1, str.indexOf(')'));
        const parts = inside.split(/[ ,]+/).filter(Boolean);
        const lng = Number(parts[0]);
        const lat = Number(parts[1]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return { lat, lng };
        }
      }
      return undefined;
    }
    if (typeof input === 'object' && input !== null) {
      const anyObj: any = input as any;
      if (Array.isArray(anyObj.coordinates) && anyObj.coordinates.length >= 2) {
        const lng = Number(anyObj.coordinates[0]);
        const lat = Number(anyObj.coordinates[1]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return { lat, lng };
        }
      }
      if (typeof anyObj.lat === 'number' && typeof anyObj.lng === 'number') {
        return { lat: anyObj.lat, lng: anyObj.lng };
      }
      if (typeof anyObj.y === 'number' && typeof anyObj.x === 'number') {
        return { lat: anyObj.y, lng: anyObj.x };
      }
    }
  } catch (e) {
    console.log('parseDbLocation error', e);
  }
  return undefined;
};

export const [AppProvider, useApp] = createContextHook<AppState>(() => {
  const { user, supabase, session } = useAuth();
  
  // Create tRPC client with auth token
  const authTrpcClient = useMemo(() => {
    return createTRPCClient(async () => {
      try {
        console.log('[tRPC Client] Getting auth token for user:', user?.id);
        console.log('[tRPC Client] Session exists:', !!session);
        console.log('[tRPC Client] Session access token exists:', !!session?.access_token);
        console.log('[tRPC Client] User confirmed:', !!user?.email_confirmed_at);
        console.log('[tRPC Client] Session expires at:', session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'never');
        
        // For development, allow both confirmed and unconfirmed users
        // In production, you should only allow confirmed users
        if (!user?.email_confirmed_at) {
          console.log('[tRPC Client] User not confirmed, but providing token for development');
          console.log('[tRPC Client] In production, you should require email confirmation');
          // For development, continue with the token even if not confirmed
          // In production, uncomment the next line:
          // return null;
        }
        
        // Always get a fresh session to ensure we have the latest token
        console.log('[tRPC Client] Getting fresh session to ensure token validity');
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[tRPC Client] Error getting current session:', error);
          return null;
        }
        
        if (!currentSession) {
          console.log('[tRPC Client] No current session found');
          return null;
        }
        
        if (!currentSession.user?.email_confirmed_at) {
          console.log('[tRPC Client] Current session user not confirmed, but allowing for development');
          console.log('[tRPC Client] In production, you should require email confirmation');
          // For development, continue even if not confirmed
          // In production, uncomment the next line:
          // return null;
        }
        
        // Check if token is expired or expiring soon (5 minute buffer)
        const bufferTime = 5 * 60 * 1000; // 5 minutes
        if (currentSession.expires_at && (currentSession.expires_at * 1000 - bufferTime) < Date.now()) {
          console.log('[tRPC Client] Session token expired or expiring soon, refreshing');
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError || !refreshedSession) {
            console.error('[tRPC Client] Failed to refresh session:', refreshError);
            return null;
          }
          
          console.log('[tRPC Client] Using refreshed session token');
          console.log('[tRPC Client] Refreshed token expires at:', refreshedSession.expires_at ? new Date(refreshedSession.expires_at * 1000).toISOString() : 'never');
          return refreshedSession.access_token;
        }
        
        console.log('[tRPC Client] Using current session token');
        return currentSession.access_token;
      } catch (error) {
        console.error('[tRPC Client] Exception getting auth token:', error);
        return null;
      }
    });
  }, [session, user, supabase]);
  const [matches, setMatches] = useState<DogProfile[]>([]);
  const [likedProfiles, setLikedProfiles] = useState<string[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>(defaultUserProfile);
  const [walkingStats, setWalkingStats] = useState<WalkingStats>(defaultWalkingStats);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [presetMessages] = useState<PresetMessage[]>(defaultPresetMessages);
  const [scheduledWalks, setScheduledWalks] = useState<ScheduledWalk[]>([]);
  const [dailyStats, setDailyStats] = useState<{ [date: string]: { minutes: number; distance: number; walks: number } }>({});
  const subscriptionsRef = useRef<Record<string, { channel: any }>>({});

  const upsertConversationsLocal = useCallback((incoming: Conversation[]) => {
    setConversations(prev => {
      const map = new Map<string, Conversation>();
      [...prev, ...incoming].forEach(c => {
        const existing = map.get(c.id);
        if (!existing) {
          map.set(c.id, c);
        } else {
          map.set(c.id, {
            ...existing,
            ...c,
            messages: (existing.messages || []).concat(c.messages || []).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
            lastMessage: c.lastMessage ?? existing.lastMessage,
          });
        }
      });
      const merged = Array.from(map.values());
      AsyncStorage.setItem("conversations", JSON.stringify(merged));
      return merged;
    });
  }, []);

  const createDefaultProfile = useCallback(async () => {
    if (!user) return;
    
    // For development, allow profile creation for unconfirmed users
    // In production, you should require email confirmation
    if (!user.email_confirmed_at) {
      console.log('User not confirmed yet, but allowing profile creation for development:', user.id);
      console.log('In production, you should require email confirmation');
      // For development, continue with profile creation
      // In production, uncomment the next line:
      // return;
    }
    
    try {
      console.log('Creating default profiles for user:', user.id);
      console.log('User email confirmed at:', user.email_confirmed_at);
      console.log('User email:', user.email);
      
      // First, verify the user exists in auth.users by checking current session
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !currentSession?.user) {
        console.error('No valid session found, cannot create profiles:', sessionError);
        throw new Error('User session invalid. Please sign in again.');
      }
      
      if (currentSession.user.id !== user.id) {
        console.error('Session user ID mismatch:', { sessionUserId: currentSession.user.id, contextUserId: user.id });
        throw new Error('User ID mismatch. Please sign in again.');
      }
      
      console.log('Session verified, user exists in auth.users:', currentSession.user.id);
      
      // Wait a bit to ensure the database trigger has completed
      // The trigger should automatically create the user_profiles record
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Check if user profile already exists (should exist due to trigger)
      const { data: existingUserProfile, error: userCheckError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', user.id)
        .single();
      
      let userError = null;
      if (existingUserProfile) {
        console.log('User profile already exists (created by trigger), updating:', user.id);
        const { error } = await supabase
          .from('user_profiles')
          .update({
            email: user.email!,
            full_name: user.user_metadata?.full_name || defaultUserProfile.fullName,
            phone: user.phone || defaultUserProfile.phone,
            bio: defaultUserProfile.bio,
            preferences: defaultUserProfile.preferences,
            is_active: defaultUserProfile.isActive,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);
        userError = error;
      } else if (userCheckError?.code === 'PGRST116') {
        // User profile doesn't exist, wait a bit more and try again
        console.log('User profile not found, waiting longer for trigger to complete...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check again
        const { data: retryUserProfile, error: retryError } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('id', user.id)
          .single();
          
        if (retryUserProfile) {
          console.log('User profile found after waiting, updating:', user.id);
          const { error } = await supabase
            .from('user_profiles')
            .update({
              email: user.email!,
              full_name: user.user_metadata?.full_name || defaultUserProfile.fullName,
              phone: user.phone || defaultUserProfile.phone,
              bio: defaultUserProfile.bio,
              preferences: defaultUserProfile.preferences,
              is_active: defaultUserProfile.isActive,
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);
          userError = error;
        } else if (retryError?.code === 'PGRST116') {
          // Still not found, the trigger definitely failed - create it manually as fallback
          console.log('Trigger failed completely, creating user profile manually:', user.id);
          
          // Double-check that the user really exists in auth.users before creating
          const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
          if (authError || !authUser || authUser.id !== user.id) {
            console.error('Cannot verify user exists in auth.users:', authError);
            throw new Error('User authentication failed. Please sign out and sign in again.');
          }
          
          const { error } = await supabase
            .from('user_profiles')
            .insert({
              id: user.id,
              email: user.email!,
              full_name: user.user_metadata?.full_name || defaultUserProfile.fullName,
              phone: user.phone || defaultUserProfile.phone,
              bio: defaultUserProfile.bio,
              preferences: defaultUserProfile.preferences,
              is_active: defaultUserProfile.isActive,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          userError = error;
        } else {
          console.error('Unexpected error on retry:', JSON.stringify(retryError, null, 2));
          userError = retryError;
        }
      } else {
        // Some other error occurred
        console.error('Error checking user profile:', JSON.stringify(userCheckError, null, 2));
        userError = userCheckError;
      }
      
      if (userError) {
        console.error('Error creating/updating user profile:', JSON.stringify(userError, null, 2));
        
        // If it's a foreign key constraint error, provide a more helpful message
        if (userError.code === '23503') {
          throw new Error('Database synchronization issue. Please sign out and sign in again.');
        }
        
        throw userError; // Don't continue if user profile creation fails
      }
      
      // Check if any dog profile already exists for this user
      const { data: existingDogProfiles, error: dogCheckError } = await supabase
        .from('dog_profiles')
        .select('id, is_primary')
        .eq('owner_id', user.id);
      
      let dogError = null;
      if (dogCheckError && dogCheckError.code !== 'PGRST116') {
        console.error('Error checking dog profiles:', JSON.stringify(dogCheckError, null, 2));
        dogError = dogCheckError;
      } else if (!existingDogProfiles || existingDogProfiles.length === 0) {
        // No dog profiles exist, create the default one
        console.log('Creating new default dog profile for user:', user.id);
        const { data: newDogProfile, error } = await supabase
          .from('dog_profiles')
          .insert({
            owner_id: user.id,
            name: defaultUserProfile.dogName,
            breed: defaultUserProfile.breed,
            age: defaultUserProfile.age,
            size: defaultUserProfile.size,
            weight: defaultUserProfile.weight,
            gender: defaultUserProfile.gender,
            is_neutered: defaultUserProfile.isNeutered,
            bio: defaultUserProfile.dogBio,
            personality_traits: defaultUserProfile.personalityTraits,
            energy_level: defaultUserProfile.energyLevel,
            friendliness_level: defaultUserProfile.friendlinessLevel,
            training_level: defaultUserProfile.trainingLevel,
            health_notes: defaultUserProfile.healthNotes,
            vaccination_status: defaultUserProfile.vaccinationStatus,
            vaccination_date: defaultUserProfile.vaccinationDate,
            is_primary: true, // First dog is always primary
            is_active: defaultUserProfile.dogIsActive,
          })
          .select('id')
          .single();
        dogError = error;
        
        // Create default photo for the new dog profile
        if (!dogError && newDogProfile?.id) {
          const { error: photoError } = await supabase
            .from('dog_photos')
            .insert({
              dog_id: newDogProfile.id,
              photo_url: defaultDogProfile.photos[0]?.photoUrl,
              is_primary: true,
              order_index: 0,
            });
          if (photoError) {
            console.error('Error creating default dog photo:', JSON.stringify(photoError, null, 2));
          }
        }
      } else {
        console.log('Dog profiles already exist for user:', user.id, '- count:', existingDogProfiles.length);
        // Make sure at least one is marked as primary
        const hasPrimary = existingDogProfiles.some(dog => dog.is_primary);
        if (!hasPrimary && existingDogProfiles.length > 0) {
          console.log('No primary dog found, setting first one as primary');
          const { error: primaryError } = await supabase
            .from('dog_profiles')
            .update({ is_primary: true })
            .eq('id', existingDogProfiles[0].id);
          if (primaryError) {
            console.error('Error setting primary dog:', JSON.stringify(primaryError, null, 2));
          }
        }
      }
      
      if (dogError) {
        console.error('Error creating dog profile:', JSON.stringify(dogError, null, 2));
      }
      
      // Update local state with the authenticated user's info
      setUserProfile(prev => ({
        ...prev,
        id: user.id,
        email: user.email || prev.email,
        fullName: user.user_metadata?.full_name || prev.fullName,
        displayName: user.user_metadata?.full_name || prev.displayName,
      }));
      
    } catch (error) {
      console.error('Error creating default profiles:', JSON.stringify(error, null, 2));
      throw error;
    }
  }, [user, supabase]);

  const loadConversationsFromDB = useCallback(async () => {
    if (!user) return;
    try {
      console.log('[Conversations] Loading for user', user.id);
      let convRows: any[] | null = null;
      let convErr: any = null;
      const tryQueries = [
        supabase.from('conversations').select('*').contains('participants', [user.id]),
        supabase.from('conversations').select('*').or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`),
        supabase.from('conversations').select('*').eq('user_id', user.id),
      ];
      for (const q of tryQueries) {
        const { data, error } = await (q as any);
        if (!error && data && data.length >= 0) { convRows = data; convErr = null; break; }
        convErr = error;
      }
      if (convErr) {
        console.log('[Conversations] Failed to load via all strategies:', convErr?.message ?? convErr);
        return;
      }
      const conversationsMapped: Conversation[] = [];
      for (const row of convRows || []) {
        const id: string = row.id?.toString();
        const matchId: string = (row.match_id ?? row.matchId ?? '').toString();
        const { data: msgsData } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', id)
          .order('created_at', { ascending: true });
        const messages: Message[] = (msgsData || []).map((m: any) => ({
          id: m.id?.toString(),
          senderId: (m.sender_id ?? m.user_id ?? '').toString(),
          text: (m.content ?? m.text ?? ''),
          timestamp: new Date(m.created_at ?? new Date().toISOString()),
          type: ((m.message_type as Message['type']) ?? (m.type as Message['type']) ?? 'text'),
          walkDetails: m.walk_details ?? undefined,
        }));
        const conv: Conversation = {
          id,
          matchId,
          messages,
          lastMessage: messages[messages.length - 1],
          unreadCount: 0,
        };
        conversationsMapped.push(conv);
      }
      upsertConversationsLocal(conversationsMapped);
      (convRows || []).forEach(row => {
        const id: string = row.id?.toString();
        if (!subscriptionsRef.current[id]) {
          const channel = supabase.channel(`messages-conv-${id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, (payload: any) => {
              const m = payload.new;
              const incoming: Message = {
                id: m.id?.toString(),
                senderId: (m.sender_id ?? m.user_id ?? '').toString(),
                text: (m.content ?? m.text ?? ''),
                timestamp: new Date(m.created_at ?? new Date().toISOString()),
                type: ((m.message_type as Message['type']) ?? (m.type as Message['type']) ?? 'text'),
                walkDetails: m.walk_details ?? undefined,
              };
              setConversations(prev => {
                const updated = prev.map(c => c.id === id ? { ...c, messages: [...c.messages, incoming], lastMessage: incoming } : c);
                AsyncStorage.setItem('conversations', JSON.stringify(updated));
                return updated;
              });
            })
            .subscribe();
          subscriptionsRef.current[id] = { channel };
        }
      });
    } catch (e: any) {
      console.log('[Conversations] load error', e?.message ?? String(e));
    }
  }, [supabase, upsertConversationsLocal, user]);

  const loadConversationById = useCallback(async (conversationId: string) => {
    if (!user) {
      console.log('[Conversations] No user, skipping load');
      return;
    }
    try {
      console.log('[Conversations] Loading single conversation via tRPC:', conversationId);
      
      // Use tRPC to get messages with proper authorization
      const result = await authTrpcClient.conversations.getMessages.query({
        conversationId: conversationId,
      });
      
      console.log('[Conversations] tRPC result:', result);
      console.log('[Conversations] Found messages:', result.messages?.length || 0);
      
      const messages: Message[] = (result.messages || []).map((m: any) => ({
        id: m.id?.toString(),
        senderId: (m.sender_id ?? m.user_id ?? '').toString(),
        text: (m.content ?? m.text ?? ''),
        timestamp: new Date(m.created_at ?? new Date().toISOString()),
        type: ((m.message_type as Message['type']) ?? (m.type as Message['type']) ?? 'text'),
        walkDetails: m.walk_details ?? undefined,
      }));
      
      const conv: Conversation = {
        id: conversationId,
        matchId: result.conversation.match_id,
        messages,
        lastMessage: messages[messages.length - 1],
        unreadCount: 0,
      };
      
      console.log('[Conversations] Upserting conversation locally:', conv.id, 'with', messages.length, 'messages');
      upsertConversationsLocal([conv]);
      
      // Set up real-time subscription if not already exists
      if (!subscriptionsRef.current[conversationId]) {
        console.log('[Conversations] Setting up real-time subscription for:', conversationId);
        const channel = supabase.channel(`messages-conv-${conversationId}`)
          .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages', 
            filter: `conversation_id=eq.${conversationId}` 
          }, (payload: any) => {
            console.log('[Conversations] Real-time message received:', payload.new);
            const m = payload.new;
            const incoming: Message = {
              id: m.id?.toString(),
              senderId: (m.sender_id ?? m.user_id ?? '').toString(),
              text: (m.content ?? m.text ?? ''),
              timestamp: new Date(m.created_at ?? new Date().toISOString()),
              type: ((m.message_type as Message['type']) ?? (m.type as Message['type']) ?? 'text'),
              walkDetails: m.walk_details ?? undefined,
            };
            console.log('[Conversations] Adding real-time message to conversation:', conversationId);
            setConversations(prev => {
              const updated = prev.map(c => c.id === conversationId ? { 
                ...c, 
                messages: [...c.messages, incoming], 
                lastMessage: incoming 
              } : c);
              AsyncStorage.setItem('conversations', JSON.stringify(updated));
              return updated;
            });
          })
          .subscribe();
        subscriptionsRef.current[conversationId] = { channel };
      }
    } catch (e: any) {
      console.error('[Conversations] single load exception', e?.message ?? String(e));
      console.error('[Conversations] Full error:', e);
    }
  }, [supabase, upsertConversationsLocal, user, authTrpcClient]);

  const loadData = useCallback(async () => {
    if (!user) return;
    
    // For development, allow data loading for unconfirmed users
    // In production, you should require email confirmation
    if (!user.email_confirmed_at) {
      console.log('User not confirmed yet, but allowing data load for development:', user.id);
      console.log('In production, you should require email confirmation');
      // For development, continue with data loading
      // In production, uncomment the next line:
      // return;
    }
    
    try {
      console.log('Loading user data from Supabase for user:', user.id);
      const [userProfileResult, dogProfileResult, userSettingsResult] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('id', user.id).single(),
        supabase.from('dog_profiles').select('*').eq('owner_id', user.id).eq('is_primary', true).single(),
        supabase.from('user_settings').select('*').eq('user_id', user.id).single()
      ]);
      const { data: userProfileData, error: userProfileError } = userProfileResult;
      const { data: dogProfileData, error: dogProfileError } = dogProfileResult;
      const { data: userSettingsData, error: userSettingsError } = userSettingsResult;
      const needsUserProfile = userProfileError && userProfileError.code === 'PGRST116';
      const needsDogProfile = dogProfileError && dogProfileError.code === 'PGRST116';
      const needsUserSettings = userSettingsError && userSettingsError.code === 'PGRST116';
      if (needsUserProfile || needsDogProfile) {
        console.log('Missing profiles detected, creating defaults...');
        await createDefaultProfile();
        return;
      }
      if (needsUserSettings && userProfileData) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const { error: settingsError } = await supabase.from('user_settings').upsert({
              user_id: user.id,
              distance_preference: defaultUserSettings.distancePreference,
              age_range_min: defaultUserSettings.ageRangeMin,
              age_range_max: defaultUserSettings.ageRangeMax,
              size_preferences: defaultUserSettings.sizePreferences,
              notification_preferences: {
                matches: defaultUserSettings.notificationPreferences.matches,
                messages: defaultUserSettings.notificationPreferences.messages,
                walk_reminders: defaultUserSettings.notificationPreferences.walkReminders,
              },
              privacy_settings: {
                show_location: defaultUserSettings.privacySettings.showLocation,
                show_last_seen: defaultUserSettings.privacySettings.showLastSeen,
              },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id', ignoreDuplicates: false });
            if (settingsError) {
              console.error('Error creating default user settings:', JSON.stringify(settingsError, null, 2));
            }
          }
        } catch (settingsCreateError) {
          console.error('Exception creating user settings:', JSON.stringify(settingsCreateError, null, 2));
        }
      }
      if (userProfileData || dogProfileData) {
        const mappedUserSettings: UserSettings | undefined = userSettingsData ? {
          id: userSettingsData.id,
          userId: userSettingsData.user_id,
          distancePreference: userSettingsData.distance_preference,
          ageRangeMin: userSettingsData.age_range_min,
          ageRangeMax: userSettingsData.age_range_max,
          sizePreferences: userSettingsData.size_preferences,
          notificationPreferences: {
            matches: userSettingsData.notification_preferences?.matches ?? true,
            messages: userSettingsData.notification_preferences?.messages ?? true,
            walkReminders: userSettingsData.notification_preferences?.walk_reminders ?? true,
          },
          privacySettings: {
            showLocation: userSettingsData.privacy_settings?.show_location ?? true,
            showLastSeen: userSettingsData.privacy_settings?.show_last_seen ?? true,
          },
          createdAt: userSettingsData.created_at,
          updatedAt: userSettingsData.updated_at,
        } : { ...defaultUserSettings, userId: user.id };
        let dogPhotoUrl = defaultUserProfile.dogPhoto;
        if (dogProfileData?.id) {
          const { data: dogPhotoData } = await supabase
            .from('dog_photos')
            .select('photo_url')
            .eq('dog_id', dogProfileData.id)
            .eq('is_primary', true)
            .single();
          if (dogPhotoData?.photo_url) {
            dogPhotoUrl = dogPhotoData.photo_url;
          }
        }
        const { data: allDogProfiles } = await supabase
          .from('dog_profiles')
          .select('*')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: true });
        const dogProfilesWithPhotos: DogProfileData[] = [];
        if (allDogProfiles && allDogProfiles.length > 0) {
          for (const dogData of allDogProfiles) {
            const { data: dogPhotos } = await supabase
              .from('dog_photos')
              .select('*')
              .eq('dog_id', dogData.id)
              .order('order_index', { ascending: true });
            const mappedPhotos: DogPhoto[] = (dogPhotos || []).map(photo => ({
              id: photo.id,
              dogId: photo.dog_id,
              photoUrl: photo.photo_url,
              isPrimary: photo.is_primary,
              orderIndex: photo.order_index,
              createdAt: photo.created_at,
            }));
            dogProfilesWithPhotos.push({
              id: dogData.id,
              name: dogData.name,
              breed: dogData.breed,
              age: dogData.age,
              size: dogData.size,
              weight: dogData.weight,
              gender: dogData.gender,
              isNeutered: dogData.is_neutered,
              bio: dogData.bio,
              personalityTraits: dogData.personality_traits || [],
              energyLevel: dogData.energy_level,
              friendlinessLevel: dogData.friendliness_level,
              trainingLevel: dogData.training_level,
              healthNotes: dogData.health_notes,
              vaccinationStatus: dogData.vaccination_status,
              vaccinationDate: dogData.vaccination_date,
              isPrimary: dogData.is_primary,
              isActive: dogData.is_active,
              photos: mappedPhotos,
              ownerId: dogData.owner_id,
              createdAt: dogData.created_at,
              updatedAt: dogData.updated_at,
            });
          }
        }
        const primaryDog = dogProfilesWithPhotos.find(dog => dog.isPrimary) || dogProfilesWithPhotos[0];
        const primaryDogPhoto = primaryDog?.photos.find(photo => photo.isPrimary) || primaryDog?.photos[0];
        const loadedProfile: UserProfile = {
          id: user.id,
          email: userProfileData?.email || user.email || defaultUserProfile.email,
          fullName: userProfileData?.full_name || defaultUserProfile.fullName,
          avatarUrl: userProfileData?.avatar_url,
          phone: userProfileData?.phone || defaultUserProfile.phone,
          dateOfBirth: userProfileData?.date_of_birth,
          location: parseDbLocation(userProfileData?.location),
          address: userProfileData?.address,
          city: userProfileData?.city,
          state: userProfileData?.state,
          country: userProfileData?.country,
          bio: userProfileData?.bio,
          preferences: userProfileData?.preferences || defaultPreferences,
          userSettings: mappedUserSettings || { ...defaultUserSettings, userId: user.id },
          isActive: userProfileData?.is_active ?? defaultUserProfile.isActive,
          lastSeen: userProfileData?.last_seen,
          dogProfiles: dogProfilesWithPhotos,
          activeDogId: primaryDog?.id,
          dogName: primaryDog?.name || defaultUserProfile.dogName,
          dogPhoto: primaryDogPhoto?.photoUrl || dogPhotoUrl || defaultUserProfile.dogPhoto,
          breed: primaryDog?.breed || defaultUserProfile.breed,
          age: primaryDog?.age || defaultUserProfile.age,
          size: primaryDog?.size || defaultUserProfile.size,
          weight: primaryDog?.weight || defaultUserProfile.weight,
          gender: primaryDog?.gender || defaultUserProfile.gender,
          isNeutered: primaryDog?.isNeutered ?? defaultUserProfile.isNeutered,
          dogBio: primaryDog?.bio || defaultUserProfile.dogBio,
          personalityTraits: primaryDog?.personalityTraits || defaultUserProfile.personalityTraits,
          energyLevel: primaryDog?.energyLevel || defaultUserProfile.energyLevel,
          friendlinessLevel: primaryDog?.friendlinessLevel || defaultUserProfile.friendlinessLevel,
          trainingLevel: primaryDog?.trainingLevel || defaultUserProfile.trainingLevel,
          healthNotes: primaryDog?.healthNotes || defaultUserProfile.healthNotes,
          vaccinationStatus: primaryDog?.vaccinationStatus ?? defaultUserProfile.vaccinationStatus,
          vaccinationDate: primaryDog?.vaccinationDate || defaultUserProfile.vaccinationDate,
          isPrimary: primaryDog?.isPrimary ?? defaultUserProfile.isPrimary,
          dogIsActive: primaryDog?.isActive ?? defaultUserProfile.dogIsActive,
          ownerName: userProfileData?.full_name || defaultUserProfile.ownerName,
          displayName: userProfileData?.full_name || defaultUserProfile.displayName,
        };
        setUserProfile(loadedProfile);
      }
      const [savedStats, savedConversations, savedScheduledWalks, savedDailyStats] = await Promise.all([
        AsyncStorage.getItem("walkingStats"),
        AsyncStorage.getItem("conversations"),
        AsyncStorage.getItem("scheduledWalks"),
        AsyncStorage.getItem("dailyStats"),
      ]);
      // Only load saved stats if user has actual data, otherwise keep defaults
      if (savedStats) {
        const parsedStats = JSON.parse(savedStats);
        // Only set if there's actual activity data
        if (parsedStats.totalWalks > 0 || parsedStats.todayMinutes > 0 || parsedStats.weeklyMinutes > 0) {
          setWalkingStats(parsedStats);
        }
      }
      if (savedConversations) {
        const parsedConversations = JSON.parse(savedConversations);
        parsedConversations.forEach((conv: Conversation) => {
          conv.messages.forEach((msg: Message) => {
            msg.timestamp = new Date(msg.timestamp);
          });
          if (conv.lastMessage) {
            conv.lastMessage.timestamp = new Date(conv.lastMessage.timestamp);
          }
        });
        setConversations(parsedConversations);
      }
      if (savedScheduledWalks) {
        const parsedWalks = JSON.parse(savedScheduledWalks);
        parsedWalks.forEach((walk: ScheduledWalk) => {
          walk.createdAt = new Date(walk.createdAt);
        });
        setScheduledWalks(parsedWalks);
      }
      if (savedDailyStats) {
        const parsedDailyStats = JSON.parse(savedDailyStats);
        // Clear daily stats if they seem to be from a different user or are too old
        const hasRecentData = Object.keys(parsedDailyStats).some(date => {
          const dateObj = new Date(date);
          const daysDiff = (new Date().getTime() - dateObj.getTime()) / (1000 * 3600 * 24);
          return daysDiff < 30; // Only keep data from last 30 days
        });
        
        // Only set daily stats if they have recent data and belong to current user
        if (hasRecentData && Object.keys(parsedDailyStats).length > 0) {
          // Verify this data belongs to current user by checking if it matches database stats
          // For now, clear it for new users
          setDailyStats({});
          await AsyncStorage.removeItem("dailyStats");
        } else {
          setDailyStats({});
        }
      } else {
        // No saved daily stats, start fresh
        setDailyStats({});
      }
      await loadConversationsFromDB();
    } catch (error) {
      const err: any = error;
      try {
        const serialized = JSON.stringify(
          err && (err.message || err.code || err.status || err.details || err.hint)
            ? {
                message: err.message ?? String(err),
                code: err.code,
                status: err.status,
                details: err.details,
                hint: err.hint,
                stack: err.stack,
              }
            : err,
          Object.getOwnPropertyNames(err ?? {}),
          2,
        );
        console.error('Error loading data:', serialized);
        
        // If it's a foreign key constraint error, it means the trigger didn't work
        // Don't retry automatically to avoid infinite loops
        if (err?.code === '23503') {
          console.error('Foreign key constraint error - database trigger may have failed');
          console.error('User should try signing out and signing in again');
          
          // Provide a more user-friendly error message
          throw new Error('Database synchronization issue. Please sign out and sign in again to resolve this.');
        }
      } catch {
        console.error('Error loading data:', err?.message ?? String(err));
      }
    }
  }, [user, supabase, createDefaultProfile, loadConversationsFromDB]);

  useEffect(() => {
    if (user) {
      // For development, load data for all authenticated users
      // In production, you should only load for confirmed users
      if (user.email_confirmed_at) {
        console.log('User is confirmed, loading data for:', user.id);
      } else {
        console.log('User not confirmed, but loading data for development:', user.id);
        console.log('In production, you should require email confirmation');
      }
      loadData();
    }
    return () => {
      Object.values(subscriptionsRef.current).forEach(s => s.channel.unsubscribe());
      subscriptionsRef.current = {};
    };
  }, [user, loadData]);

  const addMatch = useCallback(async (profile: DogProfile) => {
    setMatches(prev => {
      if (prev.some(m => m.id === profile.id)) {
        return prev;
      }
      return [...prev, profile];
    });
  }, []);

  const addLikedProfile = useCallback((profileId: string) => {
    setLikedProfiles([...likedProfiles, profileId]);
  }, [likedProfiles]);

  const updateUserProfile = useCallback(async (profile: UserProfile) => {
    if (!user) {
      console.error('No user logged in');
      return;
    }
    try {
      const { error: userError } = await supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          email: profile.email,
          full_name: profile.fullName,
          avatar_url: profile.avatarUrl,
          phone: profile.phone,
          date_of_birth: profile.dateOfBirth,
          location: profile.location ? `POINT(${profile.location.lng} ${profile.location.lat})` : null,
          address: profile.address,
          city: profile.city,
          state: profile.state,
          country: profile.country,
          bio: profile.bio,
          preferences: profile.preferences,
          is_active: profile.isActive,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });
      if (userError) {
        console.error('Error updating user profile in Supabase:', JSON.stringify(userError, null, 2));
        throw userError;
      }
      if (profile.dogProfiles && profile.dogProfiles.length > 0) {
        for (const dogProfile of profile.dogProfiles) {
          let dogError;
          let dogProfileId = dogProfile.id;
          if (dogProfile.id && !dogProfile.id.startsWith('temp-') && !dogProfile.id.startsWith('dog-')) {
            const { error } = await supabase
              .from('dog_profiles')
              .update({
                name: dogProfile.name,
                breed: dogProfile.breed,
                age: dogProfile.age,
                size: dogProfile.size,
                weight: dogProfile.weight,
                gender: dogProfile.gender,
                is_neutered: dogProfile.isNeutered,
                bio: dogProfile.bio,
                personality_traits: dogProfile.personalityTraits,
                energy_level: dogProfile.energyLevel,
                friendliness_level: dogProfile.friendlinessLevel,
                training_level: dogProfile.trainingLevel,
                health_notes: dogProfile.healthNotes,
                vaccination_status: dogProfile.vaccinationStatus,
                vaccination_date: dogProfile.vaccinationDate,
                is_primary: dogProfile.isPrimary,
                is_active: dogProfile.isActive,
                updated_at: new Date().toISOString(),
              })
              .eq('id', dogProfile.id);
            dogError = error;
          } else {
            const { data: newDogProfile, error } = await supabase
              .from('dog_profiles')
              .insert({
                owner_id: user.id,
                name: dogProfile.name,
                breed: dogProfile.breed,
                age: dogProfile.age,
                size: dogProfile.size,
                weight: dogProfile.weight,
                gender: dogProfile.gender,
                is_neutered: dogProfile.isNeutered,
                bio: dogProfile.bio,
                personality_traits: dogProfile.personalityTraits,
                energy_level: dogProfile.energyLevel,
                friendliness_level: dogProfile.friendlinessLevel,
                training_level: dogProfile.trainingLevel,
                health_notes: dogProfile.healthNotes,
                vaccination_status: dogProfile.vaccinationStatus,
                vaccination_date: dogProfile.vaccinationDate,
                is_primary: dogProfile.isPrimary,
                is_active: dogProfile.isActive,
              })
              .select('id')
              .single();
            dogError = error;
            dogProfileId = newDogProfile?.id;
          }
          if (dogError) {
            console.error('Error updating dog profile:', JSON.stringify(dogError, null, 2));
            continue;
          }
          if (dogProfileId && dogProfile.photos && dogProfile.photos.length > 0) {
            await supabase.from('dog_photos').delete().eq('dog_id', dogProfileId);
            for (const photo of dogProfile.photos) {
              const { error: photoError } = await supabase
                .from('dog_photos')
                .insert({
                  dog_id: dogProfileId,
                  photo_url: photo.photoUrl,
                  is_primary: photo.isPrimary,
                  order_index: photo.orderIndex,
                });
              if (photoError) {
                console.error('Error creating dog photo:', JSON.stringify(photoError, null, 2));
              }
            }
          }
        }
      } else {
        const { data: existingDogProfile } = await supabase
          .from('dog_profiles')
          .select('id')
          .eq('owner_id', user.id)
          .eq('is_primary', true)
          .single();
        let dogError;
        let dogProfileId;
        if (existingDogProfile) {
          dogProfileId = existingDogProfile.id;
          const { error } = await supabase
            .from('dog_profiles')
            .update({
              name: profile.dogName,
              breed: profile.breed,
              age: profile.age,
              size: profile.size,
              weight: profile.weight,
              gender: profile.gender,
              is_neutered: profile.isNeutered,
              bio: profile.dogBio,
              personality_traits: profile.personalityTraits,
              energy_level: profile.energyLevel,
              friendliness_level: profile.friendlinessLevel,
              training_level: profile.trainingLevel,
              health_notes: profile.healthNotes,
              vaccination_status: profile.vaccinationStatus,
              vaccination_date: profile.vaccinationDate,
              is_active: profile.dogIsActive,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingDogProfile.id);
          dogError = error;
        } else {
          const { data: newDogProfile, error } = await supabase
            .from('dog_profiles')
            .insert({
              owner_id: user.id,
              name: profile.dogName,
              breed: profile.breed,
              age: profile.age,
              size: profile.size,
              weight: profile.weight,
              gender: profile.gender,
              is_neutered: profile.isNeutered,
              bio: profile.dogBio,
              personality_traits: profile.personalityTraits,
              energy_level: profile.energyLevel,
              friendliness_level: profile.friendlinessLevel,
              training_level: profile.trainingLevel,
              health_notes: profile.healthNotes,
              vaccination_status: profile.vaccinationStatus,
              vaccination_date: profile.vaccinationDate,
              is_primary: profile.isPrimary,
              is_active: profile.dogIsActive,
            })
            .select('id')
            .single();
          dogError = error;
          dogProfileId = newDogProfile?.id;
        }
        if (!dogError && dogProfileId && profile.dogPhoto) {
          const { data: existingPhoto } = await supabase
            .from('dog_photos')
            .select('id')
            .eq('dog_id', dogProfileId)
            .eq('is_primary', true)
            .single();
          if (existingPhoto) {
            const { error: photoError } = await supabase
              .from('dog_photos')
              .update({ photo_url: profile.dogPhoto })
              .eq('id', existingPhoto.id);
            if (photoError) {
              console.error('Error updating dog photo:', JSON.stringify(photoError, null, 2));
            }
          } else {
            const { error: photoError } = await supabase
              .from('dog_photos')
              .insert({
                dog_id: dogProfileId,
                photo_url: profile.dogPhoto,
                is_primary: true,
                order_index: 0,
              });
            if (photoError) {
              console.error('Error creating dog photo:', JSON.stringify(photoError, null, 2));
            }
          }
        }
      }
      setUserProfile(profile);
      AsyncStorage.setItem("userProfile", JSON.stringify(profile));
    } catch (error) {
      console.error('Error updating user profile:', JSON.stringify(error, null, 2));
      throw error;
    }
  }, [user, supabase]);

  const updateWalkingStats = useCallback((stats: WalkingStats) => {
    setWalkingStats(stats);
    AsyncStorage.setItem("walkingStats", JSON.stringify(stats));
  }, []);

  const updateDailyStats = useCallback((date: string, minutes: number, distance: number) => {
    setDailyStats(prev => {
      const updated = {
        ...prev,
        [date]: {
          minutes: (prev[date]?.minutes || 0) + minutes,
          distance: (prev[date]?.distance || 0) + distance,
          walks: (prev[date]?.walks || 0) + 1,
        }
      };
      AsyncStorage.setItem("dailyStats", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const getWeeklyChartData = useCallback(() => {
    const today = new Date();
    const weekData: { day: string; value: number }[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayName = dayNames[date.getDay()];
      weekData.push({ day: dayName, value: dailyStats[dateStr]?.minutes || 0 });
    }
    return weekData;
  }, [dailyStats]);

  const getWeeklyStats = useCallback(() => {
    const today = new Date();
    let weeklyMinutes = 0;
    let weeklyDistance = 0;
    let weeklyWalks = 0;
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayStats = dailyStats[dateStr];
      if (dayStats) {
        weeklyMinutes += dayStats.minutes;
        weeklyDistance += dayStats.distance;
        weeklyWalks += dayStats.walks;
      }
    }
    return { weeklyMinutes, weeklyDistance, weeklyWalks };
  }, [dailyStats]);

  const calculateCurrentStreak = useCallback(() => {
    const today = new Date();
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];
      if (dailyStats[dateStr] && dailyStats[dateStr].walks > 0) {
        streak++;
      } else {
        if (i === 0) {
          continue;
        }
        break;
      }
    }
    return streak;
  }, [dailyStats]);

  const getTotalWalksAllTime = useCallback(() => {
    return Object.values(dailyStats).reduce((total, day) => total + day.walks, 0);
  }, [dailyStats]);

  const getTotalDistanceAllTime = useCallback(() => {
    return Object.values(dailyStats).reduce((total, day) => total + day.distance, 0);
  }, [dailyStats]);

  const getAchievements = useCallback(() => {
    const currentStreak = calculateCurrentStreak();
    const totalWalksAllTime = getTotalWalksAllTime();
    const totalDistanceAllTime = getTotalDistanceAllTime();
    const weeklyStats = getWeeklyStats();
    const achievements = [
      { id: 'week_warrior', title: 'Week Warrior', description: '7 day streak!', icon: 'award', unlocked: currentStreak >= 7 },
      { id: 'distance_pro', title: 'Distance Pro', description: '50 km total', icon: 'trending-up', unlocked: totalDistanceAllTime >= 50 },
      { id: 'daily_walker', title: 'Daily Walker', description: 'Walk every day this week', icon: 'calendar', unlocked: weeklyStats.weeklyWalks >= 7 },
      { id: 'marathon_walker', title: 'Marathon Walker', description: '100+ walks completed', icon: 'target', unlocked: totalWalksAllTime >= 100 },
    ];
    return achievements;
  }, [calculateCurrentStreak, getTotalWalksAllTime, getTotalDistanceAllTime, getWeeklyStats]);

  const createConversation = useCallback(async (matchId: string): Promise<string> => {
    console.log('[createConversation] Starting for match:', matchId);
    console.log('[createConversation] Current conversations count:', conversations.length);
    
    // Check if conversation already exists for this match
    const localExisting = conversations.find(c => c.matchId === matchId);
    if (localExisting) {
      console.log('[createConversation] Found existing conversation:', localExisting.id);
      return localExisting.id;
    }

    // Use tRPC to create conversation properly
    try {
      console.log('[createConversation] Creating conversation via tRPC for match:', matchId);
      const created = await authTrpcClient.conversations.createConversation.mutate({
        matchId: matchId,
      });
      
      console.log('[createConversation] tRPC response:', created);
      
      if (created?.id) {
        const createdId = created.id.toString();
        console.log('[createConversation] Conversation created successfully:', createdId);
        
        const newConversation: Conversation = { id: createdId, matchId, messages: [], unreadCount: 0 };
        console.log('[createConversation] Adding to local state:', newConversation);
        
        const updatedConversations = [...conversations, newConversation];
        setConversations(updatedConversations);
        AsyncStorage.setItem("conversations", JSON.stringify(updatedConversations));
        
        console.log('[createConversation] Updated conversations count:', updatedConversations.length);
        return createdId;
      } else {
        console.error('[createConversation] No ID in tRPC response:', created);
        throw new Error('Invalid response from server');
      }
    } catch (e: any) {
      console.error('[createConversation] tRPC error:', e?.message ?? String(e));
      console.error('[createConversation] Full tRPC error:', e);
      throw e; // Re-throw the error so the caller can handle it
    }
  }, [conversations, authTrpcClient]);

  const getConversation = useCallback((conversationId: string): Conversation | undefined => {
    return conversations.find(conv => conv.id === conversationId);
  }, [conversations]);

  const sendMessage = useCallback(async (conversationId: string, messageData: Omit<Message, 'id' | 'timestamp'>) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimistic: Message = {
      ...messageData,
      id: tempId,
      timestamp: new Date(),
    };
    
    console.log('[sendMessage] Starting message send to conversation:', conversationId);
    console.log('[sendMessage] Message data:', { text: messageData.text, type: messageData.type, senderId: messageData.senderId });
    
    // Check if conversation exists locally first
    let existingConversation = conversations.find(conv => conv.id === conversationId);
    if (!existingConversation) {
      console.log('[sendMessage] Conversation not found locally, attempting to load:', conversationId);
      await loadConversationById(conversationId);
      // Wait a bit for state to update, then check again
      await new Promise(resolve => setTimeout(resolve, 100));
      existingConversation = getConversation(conversationId);
    }
    
    if (!existingConversation) {
      console.error('[sendMessage] Conversation still not found after loading:', conversationId);
      throw new Error('Conversation not found. Please try again.');
    }
    
    console.log('[sendMessage] Found conversation:', existingConversation.id, 'with match ID:', existingConversation.matchId);
    
    // Add optimistic message
    setConversations(prev => {
      const updated = prev.map(conv => conv.id === conversationId ? {
        ...conv,
        messages: [...conv.messages, optimistic],
        lastMessage: optimistic,
        unreadCount: messageData.senderId !== userProfile.id ? (conv.unreadCount + 1) : conv.unreadCount,
      } : conv);
      AsyncStorage.setItem("conversations", JSON.stringify(updated));
      return updated;
    });
    
    try {
      console.log('[sendMessage] Sending via tRPC:', { conversationId, content: messageData.text, messageType: messageData.type });
      console.log('[sendMessage] User ID:', user?.id);
      console.log('[sendMessage] Session token exists:', !!session?.access_token);
      
      const created = await authTrpcClient.conversations.sendMessage.mutate({
        conversationId,
        content: messageData.text,
        messageType: messageData.type,
      });
      
      if (created?.id) {
        const serverId = created.id.toString();
        const createdAt = created.created_at ? new Date(created.created_at) : new Date();
        console.log('[sendMessage] Message sent successfully:', serverId);
        setConversations(prev => {
          const updated = prev.map(conv => conv.id === conversationId ? {
            ...conv,
            messages: conv.messages.map(m => m.id === tempId ? { ...m, id: serverId, timestamp: createdAt } : m),
            lastMessage: conv.lastMessage && conv.lastMessage.id === tempId ? { ...conv.lastMessage, id: serverId, timestamp: createdAt } : conv.lastMessage,
          } : conv);
          AsyncStorage.setItem("conversations", JSON.stringify(updated));
          return updated;
        });
      }
    } catch (e: any) {
      console.error('[sendMessage] tRPC error:', e?.message ?? String(e));
      console.error('[sendMessage] Full error:', e);
      
      // If the error is about conversation not found, try to recreate it
      if (e?.message?.includes('Conversation not found')) {
        console.log('[sendMessage] Conversation not found in database, attempting to recreate');
        try {
          const conversation = conversations.find(conv => conv.id === conversationId);
          if (conversation?.matchId) {
            console.log('[sendMessage] Recreating conversation for match:', conversation.matchId);
            
            // Remove the old conversation from local state
            setConversations(prev => {
              const updated = prev.filter(conv => conv.id !== conversationId);
              AsyncStorage.setItem("conversations", JSON.stringify(updated));
              return updated;
            });
            
            // Create a new conversation
            const newConversationId = await createConversation(conversation.matchId);
            console.log('[sendMessage] Created new conversation:', newConversationId);
            
            // Wait a bit for the conversation to be properly created
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Retry with the new conversation ID
            console.log('[sendMessage] Retrying with new conversation ID:', newConversationId);
            return sendMessage(newConversationId, messageData);
          } else {
            console.error('[sendMessage] No match ID found for conversation:', conversationId);
          }
        } catch (createError) {
          console.error('[sendMessage] Failed to recreate conversation:', createError);
        }
      }
      
      // Remove the optimistic message on error
      setConversations(prev => {
        const updated = prev.map(conv => conv.id === conversationId ? {
          ...conv,
          messages: conv.messages.filter(m => m.id !== tempId),
          lastMessage: conv.messages.filter(m => m.id !== tempId).slice(-1)[0] || conv.lastMessage,
        } : conv);
        AsyncStorage.setItem("conversations", JSON.stringify(updated));
        return updated;
      });
      
      // Re-throw the error so the UI can handle it
      throw e;
    }
  }, [userProfile.id, authTrpcClient, user?.id, session?.access_token, conversations, loadConversationById, createConversation, getConversation]);

  const markAsRead = useCallback((conversationId: string) => {
    const updatedConversations = conversations.map(conv => {
      if (conv.id === conversationId) {
        return { ...conv, unreadCount: 0 };
      }
      return conv;
    });
    setConversations(updatedConversations);
    AsyncStorage.setItem("conversations", JSON.stringify(updatedConversations));
  }, [conversations]);

  const scheduleWalk = useCallback(async (conversationId: string, walkDetailsData: Omit<WalkDetails, 'id' | 'status'>) => {
    const match = matches.find(m => {
      const conversation = conversations.find(c => c.id === conversationId);
      return conversation && m.id === conversation.matchId;
    });
    
    const walkDetails: WalkDetails = {
      ...walkDetailsData,
      id: `walk-${Date.now()}`,
      status: 'pending',
      partnerId: match?.id,
      partnerName: match?.ownerName,
      partnerDogName: match?.name,
      partnerPhoto: match?.photos[0],
    };
    
    // Create the message first
    const message: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      senderId: userProfile.id,
      text: `Walk scheduled for ${walkDetails.date} at ${walkDetails.time}`,
      timestamp: new Date(),
      type: 'walk_request',
      walkDetails,
    };
    
    // Update local conversations immediately for UI feedback
    const updatedConversations = conversations.map(conv => {
      if (conv.id === conversationId) {
        const updatedMessages = [...conv.messages, message];
        return { ...conv, messages: updatedMessages, lastMessage: message };
      }
      return conv;
    });
    setConversations(updatedConversations);
    AsyncStorage.setItem("conversations", JSON.stringify(updatedConversations));
    
    try {
      // Send the message to the conversation
      await authTrpcClient.conversations.sendMessage.mutate({
        conversationId,
        content: message.text,
        messageType: message.type,
      });
      
      // Create the actual walk schedule in the database
      console.log('[scheduleWalk] Creating walk schedule in database');
      const scheduleData = {
        conversation_id: conversationId,
        partner_id: match?.ownerId, // Use the owner ID of the matched dog
        title: `Walk with ${walkDetails.partnerDogName}`,
        description: walkDetails.notes || `Scheduled walk at ${walkDetails.location}`,
        scheduled_date: walkDetails.date,
        scheduled_time: walkDetails.time,
        duration_minutes: parseInt(walkDetails.duration.replace(/\D/g, '')) || 30, // Extract number from duration string
        location_name: walkDetails.location,
        notes: walkDetails.notes,
        is_group_walk: false,
        max_participants: 2
      };
      
      const createdSchedule = await authTrpcClient.walks.createSchedule.mutate(scheduleData);
      console.log('[scheduleWalk] Walk schedule created successfully:', createdSchedule.id);
      
    } catch (e: any) {
      console.error('[scheduleWalk] Error:', e?.message ?? String(e));
      // If database creation fails, we still have the message in the conversation
      // The user can try to reschedule or the schedule can be created later
    }
  }, [userProfile.id, matches, conversations, authTrpcClient]);

  const confirmWalk = useCallback(async (conversationId: string, walkId: string) => {
    // Update the message status locally first
    const updatedConversations = conversations.map(conv => {
      if (conv.id === conversationId) {
        const updatedMessages = conv.messages.map(msg => {
          if (msg.walkDetails?.id === walkId) {
            const walkDetails = msg.walkDetails;
            const match = matches.find(m => m.id === conv.matchId);
            if (match) {
              // Add to local scheduled walks for immediate UI feedback
              const scheduledWalk: ScheduledWalk = {
                id: walkDetails.id,
                date: walkDetails.date,
                time: walkDetails.time,
                location: walkDetails.location,
                duration: walkDetails.duration,
                partnerId: match.id,
                partnerName: match.ownerName,
                partnerDogName: match.name,
                partnerPhoto: match.photos[0],
                status: 'upcoming',
                conversationId,
                createdAt: new Date(),
                reminderSent: false,
                notes: walkDetails.notes,
              };
              const updatedScheduledWalks = [...scheduledWalks, scheduledWalk];
              setScheduledWalks(updatedScheduledWalks);
              AsyncStorage.setItem("scheduledWalks", JSON.stringify(updatedScheduledWalks));
            }
            return { ...msg, walkDetails: { ...msg.walkDetails, status: 'confirmed' as const } };
          }
          return msg;
        });
        return { ...conv, messages: updatedMessages };
      }
      return conv;
    });
    setConversations(updatedConversations);
    AsyncStorage.setItem("conversations", JSON.stringify(updatedConversations));
    
    // Send confirmation message
    const confirmMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      senderId: userProfile.id,
      text: 'Walk confirmed! Looking forward to it! 🎉',
      timestamp: new Date(),
      type: 'walk_confirmation',
    };
    
    try {
      await sendMessage(conversationId, confirmMessage);
      
      // Note: The actual database schedule should already exist from scheduleWalk
      // If needed, we could update the status in the database here
      console.log('[confirmWalk] Walk confirmed for walkId:', walkId);
    } catch (e: any) {
      console.error('[confirmWalk] Error sending confirmation:', e?.message ?? String(e));
    }
  }, [conversations, userProfile.id, sendMessage, matches, scheduledWalks]);

  const getUpcomingWalks = useCallback((): ScheduledWalk[] => {
    const now = new Date();
    const today = now.toDateString();
    return scheduledWalks
      .filter(walk => walk.status === 'upcoming')
      .filter(walk => {
        const walkDate = new Date(walk.date + ' ' + walk.time);
        return walkDate >= now || walkDate.toDateString() === today;
      })
      .sort((a, b) => new Date(a.date + ' ' + a.time).getTime() - new Date(b.date + ' ' + b.time).getTime());
  }, [scheduledWalks]);

  const completeWalk = useCallback(async (walkId: string) => {
    // Update local state immediately for UI feedback
    const updatedWalks = scheduledWalks.map(walk => walk.id === walkId ? { ...walk, status: 'completed' as const } : walk);
    setScheduledWalks(updatedWalks);
    AsyncStorage.setItem("scheduledWalks", JSON.stringify(updatedWalks));
    
    try {
      // Update the database if this is a database schedule ID (UUID format)
      if (walkId.includes('-') && walkId.length > 10) {
        console.log('[completeWalk] Updating database schedule status to completed:', walkId);
        await authTrpcClient.walks.updateSchedule.mutate({
          schedule_id: walkId,
          status: 'completed'
        });
      }
    } catch (e: any) {
      console.error('[completeWalk] Error updating database:', e?.message ?? String(e));
      // Local state is already updated, so UI will still show as completed
    }
  }, [scheduledWalks, authTrpcClient]);

  const cancelWalk = useCallback(async (walkId: string) => {
    // Update local state immediately for UI feedback
    const updatedWalks = scheduledWalks.map(walk => walk.id === walkId ? { ...walk, status: 'cancelled' as const } : walk);
    setScheduledWalks(updatedWalks);
    AsyncStorage.setItem("scheduledWalks", JSON.stringify(updatedWalks));
    
    try {
      // Update the database if this is a database schedule ID (UUID format)
      if (walkId.includes('-') && walkId.length > 10) {
        console.log('[cancelWalk] Updating database schedule status to cancelled:', walkId);
        await authTrpcClient.walks.updateSchedule.mutate({
          schedule_id: walkId,
          status: 'cancelled'
        });
      }
    } catch (e: any) {
      console.error('[cancelWalk] Error updating database:', e?.message ?? String(e));
      // Local state is already updated, so UI will still show as cancelled
    }
  }, [scheduledWalks, authTrpcClient]);

  const sendWalkReminder = useCallback(async (walkId: string) => {
    // Update local state immediately for UI feedback
    const updatedWalks = scheduledWalks.map(walk => walk.id === walkId ? { ...walk, reminderSent: true } : walk);
    setScheduledWalks(updatedWalks);
    AsyncStorage.setItem("scheduledWalks", JSON.stringify(updatedWalks));
    
    try {
      // Update the database if this is a database schedule ID (UUID format)
      if (walkId.includes('-') && walkId.length > 10) {
        console.log('[sendWalkReminder] Updating database reminder status:', walkId);
        await authTrpcClient.walks.updateSchedule.mutate({
          schedule_id: walkId,
          reminder_sent: true
        });
      }
    } catch (e: any) {
      console.error('[sendWalkReminder] Error updating database:', e?.message ?? String(e));
      // Local state is already updated, so UI will still show reminder as sent
    }
  }, [scheduledWalks, authTrpcClient]);

  const realTimeWalkingStats = useMemo(() => {
    const weeklyStats = getWeeklyStats();
    const todayStr = new Date().toISOString().split('T')[0];
    const todayStats = dailyStats[todayStr] || { minutes: 0, distance: 0, walks: 0 };
    const currentStreak = calculateCurrentStreak();
    const totalWalksAllTime = getTotalWalksAllTime();
    return {
      ...walkingStats,
      todayMinutes: todayStats.minutes,
      todayDistance: todayStats.distance,
      weeklyMinutes: weeklyStats.weeklyMinutes,
      weeklyDistance: weeklyStats.weeklyDistance,
      totalWalks: totalWalksAllTime,
      streak: currentStreak,
    };
  }, [walkingStats, dailyStats, getWeeklyStats, calculateCurrentStreak, getTotalWalksAllTime]);

  return useMemo(() => ({
    matches,
    likedProfiles,
    userProfile,
    walkingStats: realTimeWalkingStats,
    conversations,
    presetMessages,
    scheduledWalks,
    dailyStats,
    addMatch,
    addLikedProfile,
    updateUserProfile,
    updateWalkingStats,
    updateDailyStats,
    getWeeklyChartData,
    getWeeklyStats,
    calculateCurrentStreak,
    getTotalWalksAllTime,
    getTotalDistanceAllTime,
    getAchievements,
    sendMessage,
    createConversation,
    getConversation,
    loadConversationById,
    markAsRead,
    scheduleWalk,
    confirmWalk,
    getUpcomingWalks,
    completeWalk,
    cancelWalk,
    sendWalkReminder,
  }), [
    matches,
    likedProfiles,
    userProfile,
    realTimeWalkingStats,
    conversations,
    presetMessages,
    scheduledWalks,
    dailyStats,
    addMatch,
    addLikedProfile,
    updateUserProfile,
    updateWalkingStats,
    updateDailyStats,
    getWeeklyChartData,
    getWeeklyStats,
    calculateCurrentStreak,
    getTotalWalksAllTime,
    getTotalDistanceAllTime,
    getAchievements,
    sendMessage,
    createConversation,
    getConversation,
    loadConversationById,
    markAsRead,
    scheduleWalk,
    confirmWalk,
    getUpcomingWalks,
    completeWalk,
    cancelWalk,
    sendWalkReminder,
  ]);
});