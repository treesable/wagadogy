import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  Image,
  Animated,
  PanResponder,
  Dimensions,
  TouchableOpacity,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Heart, X, Star, MapPin, Calendar } from "lucide-react-native";
import { useApp } from "@/contexts/AppContext";
import { useStats } from "@/contexts/StatsContext";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { DogProfile } from "@/types/app";

type DiscoverProfile = DogProfile & { ownerUserId: string; dogId: string };

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const SWIPE_THRESHOLD = screenWidth * 0.25;
const SWIPE_OUT_DURATION = 250;

export default function DiscoverScreen() {
  const { addMatch, likedProfiles, addLikedProfile } = useApp();
  const { incrementLikes, incrementMatches } = useStats();
  const { user, supabase } = useAuth();
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const position = useRef(new Animated.ValueXY()).current;
  const [profiles, setProfiles] = useState<DiscoverProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadDiscover() {
      if (!supabase || !user?.id) return;
      setLoading(true);
      setError(null);
      try {
        // First, get all user swipes to filter out already swiped profiles
        const { data: userSwipes, error: swipesError } = await supabase
          .from('user_swipes')
          .select('swiped_id')
          .eq('swiper_id', user.id);
        
        if (swipesError) {
          console.error('Error fetching user swipes:', swipesError);
        }
        
        const swipedUserIds = new Set((userSwipes || []).map(swipe => swipe.swiped_id));
        console.log('Already swiped user IDs:', Array.from(swipedUserIds));

        let query = supabase
          .from('dog_profiles')
          .select('*')
          .eq('is_active', true)
          .neq('owner_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        const { data: dogs, error: dogsErr } = await query;
        if (dogsErr) {
          throw dogsErr;
        }
        const dogList = dogs ?? [];
        
        // Filter out dogs whose owners have already been swiped on
        const unswipedDogs = dogList.filter((dog: any) => !swipedUserIds.has(dog.owner_id));
        console.log('Total dogs:', dogList.length, 'Unswiped dogs:', unswipedDogs.length);
        
        if (unswipedDogs.length === 0) {
          if (isMounted) {
            setProfiles([]);
            setLoading(false);
          }
          return;
        }
        
        const dogIds: string[] = unswipedDogs.map((d: any) => d.id);
        const ownerIds: string[] = Array.from(new Set(unswipedDogs.map((d: any) => d.owner_id)));

        const [photosRes, ownersRes] = await Promise.all([
          dogIds.length > 0
            ? supabase
                .from('dog_photos')
                .select('*')
                .in('dog_id', dogIds)
                .order('order_index', { ascending: true })
            : Promise.resolve({ data: [], error: null } as any),
          ownerIds.length > 0
            ? supabase
                .from('user_profiles')
                .select('id, full_name')
                .in('id', ownerIds)
            : Promise.resolve({ data: [], error: null } as any),
        ]);

        const photos = (photosRes as any).data ?? [];
        const owners = (ownersRes as any).data ?? [];

        const ownerMap = new Map<string, string>();
        (owners as any[]).forEach((o: any) => ownerMap.set(o.id as string, (o.full_name ?? '') as string));

        const photosByDog = new Map<string, { url: string; is_primary: boolean; order_index: number }[]>();
        (photos as any[]).forEach((p: any) => {
          const dogId = p.dog_id as string;
          const arr = photosByDog.get(dogId) ?? [];
          arr.push({ url: String(p.photo_url), is_primary: Boolean(p.is_primary), order_index: Number(p.order_index ?? 0) });
          photosByDog.set(dogId, arr);
        });

        const mapped: DiscoverProfile[] = (unswipedDogs as any[]).map((dog: any) => {
          const dogId = dog.id as string;
          const dogPhotos = (photosByDog.get(dogId) ?? []).sort((a, b) => {
            if (a.is_primary && !b.is_primary) return -1;
            if (!a.is_primary && b.is_primary) return 1;
            return a.order_index - b.order_index;
          });
          const photoUrls = dogPhotos.map(p => p.url);
          const ageStr = typeof dog.age === 'number' ? `${dog.age} years` : String(dog.age ?? '');
          return {
            id: dogId,
            dogId,
            ownerUserId: String(dog.owner_id),
            name: String(dog.name),
            age: ageStr,
            breed: String(dog.breed),
            size: String(dog.size),
            photos: photoUrls.length > 0 ? photoUrls : [
              'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800'
            ],
            bio: String(dog.bio ?? ''),
            distance: 'near you',
            ownerName: ownerMap.get(String(dog.owner_id)) ?? 'Owner',
          } as DiscoverProfile;
        });

        if (isMounted) {
          setProfiles(mapped);
          setCurrentIndex(0);
          setLoading(false);
        }
      } catch (e: any) {
        console.error('Failed to load discover dogs:', JSON.stringify(e, null, 2));
        if (isMounted) {
          setError(e?.message ?? 'Unknown error');
          setLoading(false);
        }
      }
    }

    loadDiscover();
    return () => {
      isMounted = false;
    };
  }, [supabase, user?.id]);

  const rotate = position.x.interpolate({
    inputRange: [-screenWidth / 2, 0, screenWidth / 2],
    outputRange: ["-10deg", "0deg", "10deg"],
    extrapolate: "clamp",
  });

  const likeOpacity = position.x.interpolate({
    inputRange: [0, screenWidth / 4],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const nopeOpacity = position.x.interpolate({
    inputRange: [-screenWidth / 4, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const nextCardScale = position.x.interpolate({
    inputRange: [-screenWidth / 2, 0, screenWidth / 2],
    outputRange: [1, 0.95, 1],
    extrapolate: "clamp",
  });

  const handleSwipeComplete = useCallback(
    async (direction: "left" | "right") => {
      try {
        const profile = profiles[currentIndex];
        if (!profile) {
          console.log('No profile found at current index:', currentIndex);
          return;
        }
        if (!user) {
          console.log('No user found in auth context');
          return;
        }
        
        console.log('Swiping', direction, 'on profile:', profile.name, 'owner:', profile.ownerUserId);
        
        if (direction === "right") {
          if (Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          addLikedProfile(profile.id);
          console.log('User liked profile:', profile.name, 'incrementing likes stat');
          incrementLikes();

          try {
            // Record like swipe
            console.log('Recording like swipe', { swiper_id: user.id, swiped_id: profile.ownerUserId });
            const { error: swipeErr } = await supabase
              .from('user_swipes')
              .insert({
                swiper_id: user.id,
                swiped_id: profile.ownerUserId,
                action: 'like',
                created_at: new Date().toISOString(),
              });
            if (swipeErr) {
              if ((swipeErr as any).code === '23505') {
                console.log('Duplicate like ignored');
              } else if ((swipeErr as any).code === '42501') {
                console.error('RLS blocked inserting like. Please add an insert policy for user_swipes.');
              } else {
                console.error('Error inserting user_swipes:', JSON.stringify(swipeErr, null, 2));
              }
            } else {
              console.log('Like swipe recorded successfully');
            }

            // Check reciprocal like to create a match
            if (profile.ownerUserId) {
              const otherUserId = profile.ownerUserId as string;
              const { data: reciprocal, error: recipErr } = await supabase
                .from('user_swipes')
                .select('id')
                .eq('swiper_id', otherUserId)
                .eq('swiped_id', user.id)
                .in('action', ['like', 'super_like'])
                .maybeSingle();
              if (recipErr) {
                console.error('Error checking reciprocal like:', JSON.stringify(recipErr, null, 2));
              }
              if (reciprocal) {
                const [user1, user2] = [user.id, otherUserId].sort();
                const { error: matchErr } = await supabase
                  .from('matches')
                  .upsert({
                    user1_id: user1,
                    user2_id: user2,
                    is_active: true,
                    matched_at: new Date().toISOString(),
                  }, { onConflict: 'user1_id,user2_id' });
                if (matchErr) {
                  console.error('Error creating match:', JSON.stringify(matchErr, null, 2));
                } else {
                  console.log('Match created! Incrementing matches stat');
                  addMatch(profile);
                  incrementMatches();
                  setTimeout(() => {
                    router.push('/match-modal');
                  }, 300);
                }
              }
            }
          } catch (dbErr) {
            console.error('Swipe DB error:', JSON.stringify(dbErr, null, 2));
          }
        } else if (direction === 'left') {
          try {
            console.log('Recording pass swipe', { swiper_id: user.id, swiped_id: profile.ownerUserId });
            const { error: passErr } = await supabase
              .from('user_swipes')
              .insert({
                swiper_id: user.id,
                swiped_id: profile.ownerUserId,
                action: 'pass',
                created_at: new Date().toISOString(),
              });
            if (passErr) {
              if ((passErr as any).code === '23505') {
                console.log('Duplicate pass ignored');
              } else if ((passErr as any).code === '42501') {
                console.error('RLS blocked inserting pass. Please add an insert policy for user_swipes.');
              } else {
                console.error('Error inserting pass swipe:', JSON.stringify(passErr, null, 2));
              }
            } else {
              console.log('Pass swipe recorded successfully');
            }
          } catch (dbErr2) {
            console.error('Pass swipe DB error:', JSON.stringify(dbErr2, null, 2));
          }
        }

        // Move to next profile
        const nextIndex = currentIndex + 1;
        console.log('Moving to next index:', nextIndex, 'total profiles:', profiles.length);
        setCurrentIndex(nextIndex);
        position.setValue({ x: 0, y: 0 });
        
        // If we're running low on profiles, reload discover
        if (nextIndex >= profiles.length - 2) {
          console.log('Running low on profiles, will reload on next render');
        }
      } catch (err) {
        console.error('Error in handleSwipeComplete:', JSON.stringify(err, null, 2));
      }
    },
    [currentIndex, profiles, addLikedProfile, addMatch, position, incrementLikes, incrementMatches, supabase, user]
  );

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // More sensitive gesture detection for web
        const threshold = Platform.OS === 'web' ? 2 : 5;
        return Math.abs(gestureState.dx) > threshold || Math.abs(gestureState.dy) > threshold;
      },
      onPanResponderGrant: () => {
        console.log('Swipe started');
        position.setOffset({
          x: (position.x as any)._value || 0,
          y: (position.y as any)._value || 0,
        });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: position.x, dy: position.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (evt, gestureState) => {
        position.flattenOffset();
        
        // Lower threshold for web to make swiping easier
        const swipeThreshold = Platform.OS === 'web' ? screenWidth * 0.15 : SWIPE_THRESHOLD;
        console.log('Swipe released - dx:', gestureState.dx, 'vx:', gestureState.vx, 'threshold:', swipeThreshold);
        
        // Check both distance and velocity for better swipe detection
        const isSwipeRight = gestureState.dx > swipeThreshold || (gestureState.dx > 50 && gestureState.vx > 0.3);
        const isSwipeLeft = gestureState.dx < -swipeThreshold || (gestureState.dx < -50 && gestureState.vx < -0.3);
        
        if (isSwipeRight) {
          console.log('Swiping right (like) - threshold met or velocity sufficient');
          Animated.timing(position, {
            toValue: { x: screenWidth + 100, y: gestureState.dy },
            duration: SWIPE_OUT_DURATION,
            useNativeDriver: false,
          }).start(() => {
            console.log('Right swipe animation complete, calling handleSwipeComplete');
            handleSwipeComplete("right");
          });
        } else if (isSwipeLeft) {
          console.log('Swiping left (pass) - threshold met or velocity sufficient');
          Animated.timing(position, {
            toValue: { x: -screenWidth - 100, y: gestureState.dy },
            duration: SWIPE_OUT_DURATION,
            useNativeDriver: false,
          }).start(() => {
            console.log('Left swipe animation complete, calling handleSwipeComplete');
            handleSwipeComplete("left");
          });
        } else {
          console.log('Swipe not far enough (dx:', gestureState.dx, 'vx:', gestureState.vx, '), returning to center');
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            friction: 4,
            useNativeDriver: false,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        console.log('Pan responder terminated');
        position.flattenOffset();
        Animated.spring(position, {
          toValue: { x: 0, y: 0 },
          friction: 4,
          useNativeDriver: false,
        }).start();
      },
    }),
    [position, handleSwipeComplete]
  );

  const handleButtonPress = (action: "pass" | "like" | "super") => {
    if (action === "pass") {
      Animated.timing(position, {
        toValue: { x: -screenWidth - 100, y: 0 },
        duration: SWIPE_OUT_DURATION,
        useNativeDriver: false,
      }).start(() => handleSwipeComplete("left"));
    } else {
      Animated.timing(position, {
        toValue: { x: screenWidth + 100, y: 0 },
        duration: SWIPE_OUT_DURATION,
        useNativeDriver: false,
      }).start(() => handleSwipeComplete("right"));
    }
  };

  const renderCard = (profile: DiscoverProfile, index: number) => {
    if (index < currentIndex) {
      return null;
    }

    if (index === currentIndex) {
      return (
        <Animated.View
          key={profile.id}
          style={[
            styles.card,
            {
              transform: [
                { translateX: position.x },
                { translateY: position.y },
                { rotate },
              ],
            },
          ]}
          {...panResponder.panHandlers}
        >
          <Image source={{ uri: profile.photos[0] || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800' }} style={styles.cardImage} />
          
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.8)"]}
            style={styles.cardGradient}
          />

          <Animated.View style={[styles.likeLabel, { opacity: likeOpacity }]}>
            <Text style={styles.likeLabelText}>LIKE</Text>
          </Animated.View>

          <Animated.View style={[styles.nopeLabel, { opacity: nopeOpacity }]}>
            <Text style={styles.nopeLabelText}>NOPE</Text>
          </Animated.View>

          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>
              {profile.name}, {profile.age}
            </Text>
            <Text style={styles.cardBreed}>{profile.breed}</Text>
            <View style={styles.cardDetails}>
              <View style={styles.detailItem}>
                <MapPin color="#fff" size={16} />
                <Text style={styles.detailText}>{profile.distance}</Text>
              </View>
              <View style={styles.detailItem}>
                <Calendar color="#fff" size={16} />
                <Text style={styles.detailText}>{profile.size}</Text>
              </View>
            </View>
            <Text style={styles.cardBio} numberOfLines={2}>
              {profile.bio}
            </Text>
          </View>
        </Animated.View>
      );
    }

    return (
      <Animated.View
        key={profile.id}
        style={[
          styles.card,
          {
            transform: [{ scale: nextCardScale }],
          },
        ]}
      >
        <Image source={{ uri: profile.photos[0] || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800' }} style={styles.cardImage} />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.8)"]}
          style={styles.cardGradient}
        />
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>
            {profile.name}, {profile.age}
          </Text>
          <Text style={styles.cardBreed}>{profile.breed}</Text>
        </View>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Loading pups...</Text>
          <Text style={styles.emptyText}>Fetching nearby dogs</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Could not load dogs</Text>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (currentIndex >= profiles.length) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No more pups nearby! 🐕</Text>
          <Text style={styles.emptyText}>
            Check back later for more furry friends
          </Text>
          <TouchableOpacity 
            style={styles.reloadButton}
            onPress={() => {
              setCurrentIndex(0);
              setProfiles([]);
              setLoading(true);
              // Trigger reload by changing a dependency
              if (Platform.OS === 'web') {
                setTimeout(() => {
                  window.location.reload();
                }, 100);
              } else {
                // For mobile, just reset the state to trigger useEffect
                setTimeout(() => {
                  setLoading(false);
                  setLoading(true);
                }, 100);
              }
            }}
          >
            <Text style={styles.reloadButtonText}>Reload</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>Wagadogy Match</Text>
        <Text style={styles.subtitle}>Find your pup's perfect playdate</Text>
      </View>

      <View style={styles.cardsContainer}>
        {profiles.map((profile, index) => renderCard(profile, index)).reverse()}
      </View>

      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[styles.button, styles.passButton]}
          onPress={() => handleButtonPress("pass")}
          testID="pass-button"
          accessibilityLabel="Pass"
        >
          <X color="#FF4458" size={30} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.superButton]}
          onPress={() => handleButtonPress("super")}
          testID="super-button"
          accessibilityLabel="Super like"
        >
          <Star color="#44A8FF" size={25} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.likeButton]}
          onPress={() => handleButtonPress("like")}
          testID="like-button"
          accessibilityLabel="Like"
        >
          <Heart color="#4FC76E" size={30} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    alignItems: "center",
    paddingVertical: 20,
  },
  logo: {
    fontSize: 32,
    fontWeight: "bold" as const,
    color: "#FF6B6B",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  cardsContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    position: "absolute",
    width: screenWidth - 40,
    height: screenHeight * 0.65,
    borderRadius: 20,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: "hidden",
  },
  cardImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  cardGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  cardInfo: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
  },
  cardName: {
    fontSize: 28,
    fontWeight: "bold" as const,
    color: "#fff",
  },
  cardBreed: {
    fontSize: 18,
    color: "#fff",
    opacity: 0.9,
    marginTop: 4,
  },
  cardDetails: {
    flexDirection: "row",
    marginTop: 10,
    gap: 20,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  detailText: {
    color: "#fff",
    fontSize: 14,
  },
  cardBio: {
    color: "#fff",
    fontSize: 14,
    marginTop: 10,
    lineHeight: 20,
  },
  likeLabel: {
    position: "absolute",
    top: 50,
    left: 20,
    padding: 10,
    borderWidth: 4,
    borderColor: "#4FC76E",
    borderRadius: 10,
    transform: [{ rotate: "-20deg" }],
  },
  likeLabelText: {
    fontSize: 32,
    fontWeight: "bold" as const,
    color: "#4FC76E",
  },
  nopeLabel: {
    position: "absolute",
    top: 50,
    right: 20,
    padding: 10,
    borderWidth: 4,
    borderColor: "#FF4458",
    borderRadius: 10,
    transform: [{ rotate: "20deg" }],
  },
  nopeLabelText: {
    fontSize: 32,
    fontWeight: "bold" as const,
    color: "#FF4458",
  },
  buttonsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
    gap: 30,
  },
  button: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
    elevation: 5,
  },
  passButton: {
    borderWidth: 2,
    borderColor: "#FF4458",
  },
  superButton: {
    borderWidth: 2,
    borderColor: "#44A8FF",
    width: 50,
    height: 50,
  },
  likeButton: {
    borderWidth: 2,
    borderColor: "#4FC76E",
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
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  reloadButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#FF6B6B",
    borderRadius: 20,
  },
  reloadButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold" as const,
  },
});