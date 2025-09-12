import React from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MessageCircle, Heart, Clock } from "lucide-react-native";
import { router } from "expo-router";
import { useApp } from "@/contexts/AppContext";
import { LinearGradient } from "expo-linear-gradient";
import { Conversation, DogProfile } from "@/types/app";
import { useAuth } from "@/contexts/AuthContext";

interface ConversationItemProps {
  conversation: Conversation;
  match: DogProfile;
}

function ConversationItem({ conversation, match }: ConversationItemProps) {
  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${diffDays}d`;
  };

  const handlePress = () => {
    router.push(`/chat/${conversation.id}`);
  };

  return (
    <TouchableOpacity style={styles.messageCard} onPress={handlePress} testID="conversation-item">
      <Image
        source={{ uri: match.photos[0] }}
        style={styles.messageAvatar}
      />
      <View style={styles.messageInfo}>
        <View style={styles.messageHeader}>
          <Text style={styles.messageName}>{match.name}</Text>
          {conversation.lastMessage && (
            <Text style={styles.messageTime}>
              {formatTime(conversation.lastMessage.timestamp)}
            </Text>
          )}
        </View>
        {conversation.lastMessage ? (
          <Text style={styles.messagePreview} numberOfLines={1}>
            {conversation.lastMessage.text}
          </Text>
        ) : (
          <Text style={styles.noMessagePreview}>Start a conversation!</Text>
        )}
      </View>
      <View style={styles.messageActions}>
        {conversation.unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadCount}>{conversation.unreadCount}</Text>
          </View>
        )}
        <MessageCircle color="#FF6B6B" size={20} />
      </View>
    </TouchableOpacity>
  );
}

export default function MatchesScreen() {
  const { conversations } = useApp();
  const { user, supabase } = useAuth();
  const [matches, setMatches] = React.useState<DogProfile[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    async function loadMatches() {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        console.log('Loading matches for user', user.id);

        const { data: matchRows, error: matchErr } = await supabase
          .from('matches')
          .select('id, user1_id, user2_id, matched_at, is_active')
          .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
          .eq('is_active', true)
          .order('matched_at', { ascending: false });

        if (matchErr) {
          console.error('Error loading matches:', JSON.stringify(matchErr, null, 2));
          throw matchErr;
        }

        if (!matchRows || matchRows.length === 0) {
          if (mounted) {
            setMatches([]);
            setLoading(false);
          }
          return;
        }

        const otherUserIds: string[] = Array.from(new Set(
          matchRows.map(r => r.user1_id === user.id ? r.user2_id : r.user1_id)
        ));

        const { data: userProfiles } = await supabase
          .from('user_profiles')
          .select('id, full_name')
          .in('id', otherUserIds);

        const userNameMap = new Map<string, string>();
        (userProfiles || []).forEach(profile => {
          userNameMap.set(profile.id, profile.full_name || 'Dog Owner');
        });

        const { data: dogs, error: dogErr } = await supabase
          .from('dog_profiles')
          .select('id, name, breed, age, size, owner_id, bio, energy_level')
          .in('owner_id', otherUserIds)
          .eq('is_primary', true);

        if (dogErr) {
          console.error('Error loading dog profiles:', JSON.stringify(dogErr, null, 2));
          throw dogErr;
        }

        if (!dogs || dogs.length === 0) {
          if (mounted) {
            setMatches([]);
            setLoading(false);
          }
          return;
        }

        const dogIds = dogs.map(d => d.id);
        const { data: photos } = await supabase
          .from('dog_photos')
          .select('dog_id, photo_url, is_primary, order_index')
          .in('dog_id', dogIds)
          .order('order_index', { ascending: true });

        const photosByDog = new Map<string, string[]>();
        (photos || []).forEach(p => {
          const arr = photosByDog.get(p.dog_id) || [];
          arr.push(p.photo_url);
          photosByDog.set(p.dog_id, arr);
        });

        const mapped: DogProfile[] = dogs.map((d: any) => {
          const ownerName = userNameMap.get(d.owner_id) || 'Dog Owner';
          const dogPhotos = photosByDog.get(d.id) || [];
          return {
            id: d.id,
            name: d.name,
            age: typeof d.age === 'number' ? `${d.age} year${d.age !== 1 ? 's' : ''}` : String(d.age || ''),
            breed: d.breed,
            size: d.size,
            photos: dogPhotos.length > 0 ? dogPhotos : ['https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800'],
            bio: d.bio || `Hi! I'm ${d.name}, a friendly ${d.breed} looking for playmates!`,
            distance: 'near you',
            ownerName: ownerName,
            ownerId: d.owner_id,
            energyLevel: d.energy_level,
          };
        });

        if (mounted) {
          setMatches(mapped);
          setLoading(false);
        }
      } catch (e: any) {
        console.error('Load matches error:', JSON.stringify(e, null, 2));
        if (mounted) {
          setError(e?.message || 'Failed to load matches');
          setLoading(false);
        }
      }
    }

    loadMatches();
    return () => { mounted = false; };
  }, [supabase, user?.id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Your Matches</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Loading matches...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Your Matches</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Could not load matches</Text>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (matches.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Your Matches</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Heart color="#FF6B6B" size={60} />
          <Text style={styles.emptyTitle}>No matches yet!</Text>
          <Text style={styles.emptyText}>
            Keep swiping to find your pup's perfect playmate
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Matches</Text>
        <Text style={styles.subtitle}>{matches.length} new connections</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {(() => {
          const conversationsWithMatches = conversations
            .map(conv => {
              const match = matches.find(m => m.id === conv.matchId || m.ownerId === conv.matchId);
              return match ? { conversation: conv, match } : null;
            })
            .filter((item): item is { conversation: Conversation; match: DogProfile } => item !== null)
            .sort((a, b) => {
              const aTime = a.conversation.lastMessage?.timestamp || new Date(0);
              const bTime = b.conversation.lastMessage?.timestamp || new Date(0);
              return bTime.getTime() - aTime.getTime();
            });

          const matchesWithoutConversations = matches.filter(
            match => !conversations.some(conv => conv.matchId === match.id || conv.matchId === match.ownerId)
          );

          return (
            <>
              {matchesWithoutConversations.length > 0 && (
                <View style={styles.newMatchesSection}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>New Matches</Text>
                    <Clock color="#FF6B6B" size={16} />
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.horizontalScroll}
                  >
                    {matchesWithoutConversations.slice(0, 5).map((match) => (
                      <TouchableOpacity 
                        key={match.id} 
                        style={styles.newMatchCard}
                        onPress={() => {
                          console.log('Open match details for:', match.name, match.id);
                          router.push((`/matches/${match.id}` as unknown) as any);
                        }}
                        testID="open-match-details"
                      >
                        <Image
                          source={{ uri: match.photos[0] }}
                          style={styles.newMatchImage}
                        />
                        <LinearGradient
                          colors={["transparent", "rgba(0,0,0,0.6)"]}
                          style={styles.newMatchGradient}
                        />
                        <Text style={styles.newMatchName}>{match.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {conversationsWithMatches.length > 0 && (
                <View style={styles.messagesSection}>
                  <Text style={styles.sectionTitle}>Messages</Text>
                  {conversationsWithMatches.map(({ conversation, match }) => (
                    <ConversationItem
                      key={conversation.id}
                      conversation={conversation}
                      match={match}
                    />
                  ))}
                </View>
              )}
            </>
          );
        })()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold" as const,
    color: "#333",
  },
  subtitle: {
    fontSize: 14,
    color: "#FF6B6B",
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "bold" as const,
    color: "#333",
    marginTop: 20,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  newMatchesSection: {
    backgroundColor: "#fff",
    paddingVertical: 20,
    marginBottom: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: "#333",
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  horizontalScroll: {
    paddingHorizontal: 20,
  },
  newMatchCard: {
    width: 100,
    height: 140,
    marginRight: 12,
    borderRadius: 15,
    overflow: "hidden",
  },
  newMatchImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  newMatchGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  newMatchName: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    color: "#fff",
    fontSize: 14,
    fontWeight: "600" as const,
    textAlign: "center",
  },
  messagesSection: {
    backgroundColor: "#fff",
    paddingVertical: 20,
  },
  messageCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  messageAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
  },
  messageInfo: {
    flex: 1,
  },
  messageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  messageName: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#333",
  },
  messageTime: {
    fontSize: 12,
    color: "#999",
  },
  messagePreview: {
    fontSize: 14,
    color: "#666",
  },
  noMessagePreview: {
    fontSize: 14,
    color: "#999",
    fontStyle: "italic",
  },
  messageActions: {
    alignItems: "center",
    gap: 8,
  },
  unreadBadge: {
    backgroundColor: "#FF6B6B",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  unreadCount: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600" as const,
  },
});