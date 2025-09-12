import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { Plus, Star, MoreHorizontal } from 'lucide-react-native';
import { DogProfileData } from '@/types/app';

interface DogProfileSelectorProps {
  dogProfiles: DogProfileData[];
  activeDogId?: string;
  onDogSelect: (dogId: string) => void;
  onAddDog: () => void;
  onEditDog: (dogId: string) => void;
  onDeleteDog: (dogId: string) => void;
  onSetPrimary: (dogId: string) => void;
  maxDogs?: number;
  editable?: boolean;
}

export default function DogProfileSelector({
  dogProfiles,
  activeDogId,
  onDogSelect,
  onAddDog,
  onEditDog,
  onDeleteDog,
  onSetPrimary,
  maxDogs = 5,
  editable = true,
}: DogProfileSelectorProps) {
  const [showAllDogs, setShowAllDogs] = useState(false);

  const sortedDogs = useMemo(() => {
    return [...dogProfiles].sort((a, b) => {
      // Primary dog first
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      // Then by creation date (newest first)
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [dogProfiles]);

  const displayedDogs = useMemo(() => {
    if (showAllDogs || sortedDogs.length <= 3) {
      return sortedDogs;
    }
    return sortedDogs.slice(0, 2);
  }, [sortedDogs, showAllDogs]);

  const activeDog = useMemo(() => {
    return dogProfiles.find(dog => dog.id === activeDogId) || dogProfiles.find(dog => dog.isPrimary) || dogProfiles[0];
  }, [dogProfiles, activeDogId]);

  const handleDeleteDog = useCallback((dogId: string) => {
    const dog = dogProfiles.find(d => d.id === dogId);
    if (!dog) return;

    Alert.alert(
      'Delete Dog Profile',
      `Are you sure you want to delete ${dog.name}'s profile? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDeleteDog(dogId);
            
            if (Platform.OS !== 'web') {
              import('expo-haptics').then((Haptics) => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              });
            }
          },
        },
      ]
    );
  }, [dogProfiles, onDeleteDog]);

  const handleDogOptions = useCallback((dog: DogProfileData) => {
    const options = [
      {
        text: 'Edit Profile',
        onPress: () => onEditDog(dog.id!),
      },
    ];

    if (!dog.isPrimary && dogProfiles.length > 1) {
      options.push({
        text: 'Set as Primary',
        onPress: () => onSetPrimary(dog.id!),
      });
    }

    if (dogProfiles.length > 1) {
      options.push({
        text: 'Delete',
        onPress: () => handleDeleteDog(dog.id!),
      });
    }

    options.push({ text: 'Cancel', onPress: () => {} });

    Alert.alert('Dog Profile Options', `Options for ${dog.name}`, options);
  }, [dogProfiles.length, onEditDog, onSetPrimary, handleDeleteDog]);

  const handleAddDog = useCallback(() => {
    if (dogProfiles.length >= maxDogs) {
      Alert.alert('Dog Limit', `You can only have up to ${maxDogs} dog profiles.`);
      return;
    }

    onAddDog();
  }, [dogProfiles.length, maxDogs, onAddDog]);

  const renderDogCard = useCallback((dog: DogProfileData) => {
    const isActive = dog.id === activeDogId || (activeDog?.id === dog.id);
    const primaryPhoto = dog.photos.find(photo => photo.isPrimary) || dog.photos[0];

    return (
      <TouchableOpacity
        key={dog.id}
        style={[
          styles.dogCard,
          isActive && styles.activeDogCard,
        ]}
        onPress={() => onDogSelect(dog.id!)}
      >
        <View style={styles.dogImageContainer}>
          {primaryPhoto ? (
            <Image
              source={{ uri: primaryPhoto.photoUrl }}
              style={styles.dogImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.placeholderImage}>
              <Text style={styles.placeholderText}>📷</Text>
            </View>
          )}
          
          {/* Primary dog indicator */}
          {dog.isPrimary && (
            <View style={styles.primaryBadge}>
              <Star color="#FFD700" size={10} fill="#FFD700" />
            </View>
          )}
          
          {/* Active indicator */}
          {isActive && (
            <View style={styles.activeIndicator} />
          )}
        </View>

        <View style={styles.dogInfo}>
          <Text style={[styles.dogName, isActive && styles.activeDogName]} numberOfLines={1}>
            {dog.name}
          </Text>
          <Text style={styles.dogDetails} numberOfLines={1}>
            {dog.breed} • {dog.age}y
          </Text>
          <Text style={styles.dogSize}>{dog.size}</Text>
        </View>

        {/* Options button */}
        {editable && (
          <TouchableOpacity
            style={styles.optionsButton}
            onPress={(e) => {
              e.stopPropagation();
              handleDogOptions(dog);
            }}
          >
            <MoreHorizontal color="#666" size={16} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  }, [activeDogId, activeDog, editable, onDogSelect, handleDogOptions]);

  const renderAddButton = useCallback(() => {
    if (!editable || dogProfiles.length >= maxDogs) return null;

    return (
      <TouchableOpacity
        style={styles.addDogCard}
        onPress={handleAddDog}
      >
        <View style={styles.addDogIcon}>
          <Plus color="#666" size={24} />
        </View>
        <Text style={styles.addDogText}>Add Dog</Text>
      </TouchableOpacity>
    );
  }, [editable, dogProfiles.length, maxDogs, handleAddDog]);

  if (dogProfiles.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No dog profiles yet</Text>
        <Text style={styles.emptySubtitle}>
          Create your first dog profile to get started
        </Text>
        {editable && (
          <TouchableOpacity style={styles.emptyButton} onPress={handleAddDog}>
            <Text style={styles.emptyButtonText}>Create Dog Profile</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {dogProfiles.length > 2 && (
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setShowAllDogs(!showAllDogs)}
            style={styles.toggleButton}
          >
            <Text style={styles.toggleText}>
              {showAllDogs ? 'Show Less' : `Show All (${dogProfiles.length})`}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dogsContainer}
      >
        {displayedDogs.map(renderDogCard)}
        {renderAddButton()}
        
        {!showAllDogs && sortedDogs.length > 2 && (
          <TouchableOpacity
            style={styles.showMoreCard}
            onPress={() => setShowAllDogs(true)}
          >
            <Text style={styles.showMoreText}>
              +{sortedDogs.length - 2} more
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>


    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
  },
  toggleText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  dogsContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  dogCard: {
    width: 120,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  activeDogCard: {
    borderColor: '#FF6B6B',
    backgroundColor: '#FFF5F5',
  },
  dogImageContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  dogImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#f0f0f0',
  },
  placeholderImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 32,
  },
  primaryBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
    padding: 3,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF6B6B',
    borderWidth: 2,
    borderColor: '#fff',
  },
  dogInfo: {
    alignItems: 'center',
  },
  dogName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  activeDogName: {
    color: '#FF6B6B',
  },
  dogDetails: {
    fontSize: 11,
    color: '#666',
    marginBottom: 2,
  },
  dogSize: {
    fontSize: 10,
    color: '#999',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  optionsButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
  },
  addDogCard: {
    width: 120,
    height: 160,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  addDogIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  addDogText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  showMoreCard: {
    width: 80,
    height: 160,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  showMoreText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
  activeDogSummary: {
    marginTop: 20,
    marginHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  summaryContent: {
    flex: 1,
  },
  summaryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  summaryDetails: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  primaryLabel: {
    fontSize: 10,
    color: '#FFD700',
    fontWeight: '500',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  editButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});