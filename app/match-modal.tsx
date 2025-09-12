import React, { useEffect, useMemo, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  Animated,

  Platform,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { MessageCircle, X } from "lucide-react-native";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";



export default function MatchModal() {
  const { matches, createConversation, userProfile } = useApp();
  const { user, session } = useAuth();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  const lastMatch = useMemo(() => {
    try {
      return matches[matches.length - 1];
    } catch (e) {
      console.log('[MatchModal] Error deriving lastMatch', e);
      return undefined;
    }
  }, [matches]);

  // Get the current user's dog prime photo
  const userDogPhoto = useMemo(() => {
    if (userProfile.dogProfiles && userProfile.dogProfiles.length > 0) {
      const activeDog = userProfile.dogProfiles.find(dog => dog.id === userProfile.activeDogId) || userProfile.dogProfiles[0];
      const primePhoto = activeDog.photos.find(photo => photo.isPrimary);
      return primePhoto?.photoUrl || activeDog.photos[0]?.photoUrl || userProfile.dogPhoto;
    }
    return userProfile.dogPhoto || "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400";
  }, [userProfile]);

  // Get the matched dog's prime photo
  const matchedDogPhoto = useMemo(() => {
    if (lastMatch?.photos && lastMatch.photos.length > 0) {
      return lastMatch.photos[0]; // This should already be the prime photo from the discover screen
    }
    return "https://images.unsplash.com/photo-1552053831-71594a27632d?w=400";
  }, [lastMatch]);

  useEffect(() => {
    if (lastMatch) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 20,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();

      if (Platform.OS !== "web") {
        import("expo-haptics").then((Haptics) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        });
      }
    }
  }, [lastMatch, scaleAnim, fadeAnim]);

  useEffect(() => {
    if (!lastMatch) {
      console.log('[MatchModal] No lastMatch found, navigating back');
      const timeoutId = setTimeout(() => {
        try {
          router.back();
        } catch (e) {
          console.log('[MatchModal] Error navigating back', e);
        }
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [lastMatch]);

  if (!lastMatch) {
    return <View accessibilityRole="none" testID="no-lastmatch-fallback" />;
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#FF6B6B", "#FF8E53"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <TouchableOpacity style={styles.closeButton} onPress={() => router.back()} testID="close-button">
        <X color="#fff" size={24} />
      </TouchableOpacity>

      <Animated.View
        style={[
          styles.content,
          {
            transform: [{ scale: scaleAnim }],
            opacity: fadeAnim,
          },
        ]}
      >
        <Text style={styles.title}>It&apos;s a Match! 🎉</Text>
        <Text style={styles.subtitle}>
          You and {lastMatch.name} liked each other!
        </Text>

        <View style={styles.imagesContainer}>
          <Image
            source={{ uri: userDogPhoto || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400' }}
            style={styles.userImage}
            resizeMode="cover"
          />
          <View style={styles.heartContainer}>
            <Text style={styles.heartEmoji}>❤️</Text>
          </View>
          <Image
            source={{ uri: matchedDogPhoto || 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=400' }}
            style={styles.matchImage}
            resizeMode="cover"
          />
        </View>

        <Text style={styles.ownerInfo}>
          Connect with {lastMatch.ownerName} to arrange a playdate!
        </Text>

        <TouchableOpacity 
          style={styles.messageButton} 
          onPress={async () => {
            try {
              console.log('[MatchModal] Creating conversation for match:', lastMatch.id);
              console.log('[MatchModal] Match data:', {
                id: lastMatch.id,
                name: lastMatch.name,
                ownerName: lastMatch.ownerName,
                ownerId: lastMatch.ownerId
              });
              console.log('[MatchModal] Current user profile ID:', userProfile.id);
              
              // Check authentication status before proceeding
              console.log('[MatchModal] Auth check - User exists:', !!user);
              console.log('[MatchModal] Auth check - User ID:', user?.id);
              console.log('[MatchModal] Auth check - User email:', user?.email);
              console.log('[MatchModal] Auth check - Session exists:', !!session);
              console.log('[MatchModal] Auth check - Access token exists:', !!session?.access_token);
              console.log('[MatchModal] Auth check - User confirmed:', !!user?.email_confirmed_at);
              console.log('[MatchModal] Auth check - Session expires at:', session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'never');
              
              if (!user) {
                console.error('[MatchModal] No user found');
                throw new Error('Please sign in to continue');
              }
              
              // For development, allow both confirmed and unconfirmed users
              // In production, you should enforce email confirmation
              if (!user.email_confirmed_at) {
                console.warn('[MatchModal] User email not confirmed, but allowing for development');
                console.warn('[MatchModal] In production, you should require email confirmation');
              }
              
              if (!session?.access_token) {
                console.error('[MatchModal] No access token found');
                throw new Error('Session expired. Please sign in again');
              }
              
              // Check if token is expired
              if (session.expires_at && session.expires_at * 1000 < Date.now()) {
                console.error('[MatchModal] Session token is expired');
                throw new Error('Session expired. Please sign in again');
              }
              
              console.log('[MatchModal] All authentication checks passed, creating conversation...');
              
              const conversationId = await createConversation(lastMatch.id);
              console.log('[MatchModal] Conversation created:', conversationId);
              router.replace(`/chat/${conversationId}`);
            } catch (e: any) {
              console.error('[MatchModal] Error starting conversation:', e);
              console.error('[MatchModal] Full error details:', JSON.stringify(e, Object.getOwnPropertyNames(e)));
              
              // Show user-friendly error message
              if (e?.message?.includes('UNAUTHORIZED') || e?.message?.includes('Authentication required')) {
                console.error('[MatchModal] Authentication error - user should sign in again');
                // You could show an alert here or redirect to login
              } else if (e?.message?.includes('confirm your email')) {
                console.error('[MatchModal] Email confirmation required');
                // You could show an alert here about email confirmation
              } else {
                console.error('[MatchModal] Generic error:', e?.message || 'Unknown error');
                // You could show a generic error alert here
              }
            }
          }}
          testID="start-conversation-button"
        >
          <MessageCircle color="#fff" size={20} />
          <Text style={styles.messageButtonText}>Send a Message</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.keepSwipingText}>Keep Swiping</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: 50,
    right: 20,
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    zIndex: 1,
  },
  content: {
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: "bold" as const,
    color: "#fff",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: "rgba(255,255,255,0.9)",
    marginBottom: 40,
    textAlign: "center",
  },
  imagesContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 30,
  },
  userImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: "#fff",
  },
  matchImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: "#fff",
  },
  heartContainer: {
    marginHorizontal: -20,
    zIndex: 1,
  },
  heartEmoji: {
    fontSize: 40,
  },
  ownerInfo: {
    fontSize: 16,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    marginBottom: 30,
    paddingHorizontal: 40,
  },
  messageButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 30,
    marginBottom: 20,
    gap: 10,
  },
  messageButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600" as const,
  },
  keepSwipingText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    textDecorationLine: "underline",
  },
});