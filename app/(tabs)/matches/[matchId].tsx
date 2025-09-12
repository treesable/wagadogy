import React from "react";
import { StyleSheet, Text, View, Image, ScrollView, Dimensions, TouchableOpacity, Alert, Platform } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useApp } from "@/contexts/AppContext";
import { MessageCircle, XCircle } from "lucide-react-native";

const { width } = Dimensions.get("window");

interface LoadedDogProfile {
  id: string;
  name: string;
  breed?: string;
  age?: number;
  size?: string;
  energyLevel?: number;
  personalityTraits?: string[];
  preferences?: string[];
  healthNotes?: string;
  bio?: string;
  ownerName?: string;
  ownerId?: string;
  photos: string[];
}

export default function MatchDetailScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { supabase, user } = useAuth();
  const { createConversation } = useApp();

  const [profile, setProfile] = React.useState<LoadedDogProfile | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeIndex, setActiveIndex] = React.useState<number>(0);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      if (!matchId) return;
      try {
        setLoading(true);
        setError(null);
        console.log('[MatchDetail] Loading match dog', matchId);
        const { data: dog, error: dogErr } = await supabase
          .from('dog_profiles')
          .select('*')
          .eq('id', matchId)
          .single();
        if (dogErr) throw dogErr;

        const ownerId = dog.owner_id as string;
        const [{ data: owner }, { data: photos }] = await Promise.all([
          supabase.from('user_profiles').select('full_name').eq('id', ownerId).single(),
          supabase.from('dog_photos').select('*').eq('dog_id', matchId).order('order_index', { ascending: true }),
        ]);

        const mapped: LoadedDogProfile = {
          id: dog.id,
          name: dog.name,
          breed: dog.breed,
          age: typeof dog.age === 'number' ? dog.age : undefined,
          size: dog.size,
          energyLevel: dog.energy_level,
          personalityTraits: dog.personality_traits || [],
          preferences: dog.preferences || [],
          healthNotes: dog.health_notes,
          bio: dog.bio,
          ownerName: owner?.full_name,
          ownerId,
          photos: (photos || []).map((p: any) => p.photo_url).length > 0 ? (photos || []).map((p: any) => p.photo_url) : [
            'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=1024'
          ],
        };

        if (mounted) setProfile(mapped);
      } catch (e: any) {
        console.log('[MatchDetail] Load error', JSON.stringify(e, null, 2));
        if (mounted) setError(e?.message || 'Failed to load match');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [matchId, supabase]);

  const onStartChat = React.useCallback(async () => {
    if (!profile || !user) return;
    try {
      console.log('[MatchDetail] Starting chat for profile:', profile.id, 'owner:', profile.ownerId);
      
      // Find the actual match ID from the matches table
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select('id')
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${profile.ownerId}),and(user1_id.eq.${profile.ownerId},user2_id.eq.${user.id})`)
        .eq('is_active', true)
        .order('matched_at', { ascending: false })
        .limit(1)
        .single();
        
      if (matchError || !matchData) {
        console.error('[MatchDetail] No active match found:', matchError);
        Alert.alert('Error', 'No active match found. Please try again.');
        return;
      }
      
      console.log('[MatchDetail] Found match:', matchData.id);
      
      const conversationId = await createConversation(matchData.id);
      console.log('[MatchDetail] Created conversation:', conversationId);
      
      // Add a small delay to ensure the conversation is properly stored
      setTimeout(() => {
        router.push(`/chat/${conversationId}`);
      }, 100);
    } catch (error: any) {
      console.error('[MatchDetail] Error starting chat:', error);
      Alert.alert('Error', 'Failed to start chat. Please try again.');
    }
  }, [profile, createConversation, user, supabase]);

  const onUnmatch = React.useCallback(async () => {
    if (!profile || !user) return;
    const proceed = Platform.OS === 'web' ? (window.confirm ? window.confirm('Unmatch this dog? This cannot be undone.') : true) : true;
    if (!proceed) return;
    try {
      console.log('[MatchDetail] Unmatching with owner', profile.ownerId);
      const { data: rows, error: matchErr } = await supabase
        .from('matches')
        .select('id')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .or(`user1_id.eq.${profile.ownerId},user2_id.eq.${profile.ownerId}`);
      if (matchErr) throw matchErr;
      const matchRow = (rows || [])[0];
      if (!matchRow) throw new Error('Match not found');
      const { error: updateErr } = await supabase
        .from('matches')
        .update({ is_active: false })
        .eq('id', matchRow.id);
      if (updateErr) throw updateErr;
      router.back();
    } catch (e: any) {
      console.log('[MatchDetail] Unmatch error', JSON.stringify(e, null, 2));
      if (Platform.OS !== 'web') {
        Alert.alert('Unmatch failed', e?.message || 'Please try again later');
      } else {
        console.error('Unmatch failed', e?.message);
      }
    }
  }, [profile, user, supabase]);

  const onScroll = React.useCallback((e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setActiveIndex(idx);
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loading}>Loading...</Text>
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || 'Match not found'}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.galleryWrapper}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {profile.photos.map((uri, idx) => (
            <Image key={idx} source={{ uri }} style={styles.photo} />
          ))}
        </ScrollView>
        <View style={styles.dots}>
          {profile.photos.map((_, idx) => (
            <View key={idx} style={[styles.dot, idx === activeIndex ? styles.dotActive : undefined]} />
          ))}
        </View>
      </View>

      <View style={styles.headerBlock}>
        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.meta}>
          {profile.breed ? `${profile.breed} • ` : ''}{profile.age ? `${profile.age} yrs • ` : ''}{profile.size || '—'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>About</Text>
        <Text style={styles.cardText}>{profile.bio || 'No bio yet.'}</Text>
      </View>

      <View style={styles.cardRow}>
        <View style={styles.cardHalf}>
          <Text style={styles.cardTitle}>Energy</Text>
          <Text style={styles.cardText}>{profile.energyLevel ?? '—'}</Text>
        </View>
        <View style={styles.cardHalf}>
          <Text style={styles.cardTitle}>Personality</Text>
          <Text style={styles.cardText}>{(profile.personalityTraits || []).join(', ') || '—'}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Health</Text>
        <Text style={styles.cardText}>{profile.healthNotes || 'No specific health notes.'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Owner</Text>
        <Text style={styles.cardText}>{profile.ownerName || 'Dog Owner'}</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryBtn} onPress={onStartChat} testID="start-chat">
          <MessageCircle color="#fff" size={20} />
          <Text style={styles.primaryText}>Start Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onUnmatch} testID="unmatch">
          <XCircle color="#FF6B6B" size={20} />
          <Text style={styles.secondaryText}>Unmatch</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 32,
    backgroundColor: '#f5f5f5',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loading: { fontSize: 16, color: '#666' },
  errorText: { fontSize: 16, color: '#d00' },
  galleryWrapper: { width, height: width * 0.9, backgroundColor: '#000' },
  photo: { width, height: width * 0.9, resizeMode: 'cover' },
  dots: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: '#fff' },
  headerBlock: { backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  name: { fontSize: 24, fontWeight: '700' as const, color: '#333' },
  meta: { marginTop: 6, fontSize: 14, color: '#666' },
  card: { backgroundColor: '#fff', marginTop: 12, paddingHorizontal: 20, paddingVertical: 16 },
  cardRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: 12 },
  cardHalf: { flex: 1, backgroundColor: '#fff', padding: 16 },
  cardTitle: { fontSize: 16, fontWeight: '600' as const, color: '#333', marginBottom: 6 },
  cardText: { fontSize: 14, color: '#555' },
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: 20, marginBottom: 40 },
  primaryBtn: { flex: 1, backgroundColor: '#FF6B6B', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, gap: 8 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' as const },
  secondaryBtn: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#FF6B6B', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, gap: 8 },
  secondaryText: { color: '#FF6B6B', fontSize: 16, fontWeight: '700' as const },
});