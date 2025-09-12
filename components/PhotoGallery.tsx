import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Camera, Plus, MoreHorizontal, Star } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { DogPhoto } from '@/types/app';
import { optimizeImage, uploadImageToSupabaseAuth } from '@/utils/imageUtils';
import { useAuth } from '@/contexts/AuthContext';

const { width: screenWidth } = Dimensions.get('window');
const PHOTO_SIZE = (screenWidth - 60) / 3; // 3 photos per row with margins

interface PhotoGalleryProps {
  photos: DogPhoto[];
  onPhotosChange: (photos: DogPhoto[]) => void;
  maxPhotos?: number;
  editable?: boolean;
}

export default function PhotoGallery({ 
  photos, 
  onPhotosChange, 
  maxPhotos = 6,
  editable = true 
}: PhotoGalleryProps) {
  const { session } = useAuth();
  const [uploadingPhotos, setUploadingPhotos] = useState<Set<string>>(new Set());

  const sortedPhotos = useMemo(() => {
    return [...photos].sort((a, b) => {
      // Primary photo first
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      // Then by order index
      return a.orderIndex - b.orderIndex;
    });
  }, [photos]);

  const processNewPhoto = useCallback(async (uri: string) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      console.log('Processing new photo:', uri);
      setUploadingPhotos(prev => new Set(prev).add(tempId));

      // Optimize image for upload (similar to Instagram's approach)
      const optimizedImage = await optimizeImage(uri, 'profile');
      
      // Create temporary photo with local URI for immediate UI feedback
      const tempPhoto: DogPhoto = {
        id: tempId,
        photoUrl: optimizedImage.uri, // Use local URI temporarily
        isPrimary: photos.length === 0, // First photo is primary
        orderIndex: photos.length,
        localUri: uri,
        compressed: optimizedImage.compressed,
        isUploading: true,
      };

      // Add to photos immediately for UI feedback
      const updatedPhotos = [...photos, tempPhoto];
      onPhotosChange(updatedPhotos);

      // Upload to Supabase Storage
      let uploadedUrl: string;
      if (session?.access_token) {
        console.log('Uploading image to Supabase Storage...');
        uploadedUrl = await uploadImageToSupabaseAuth(
          optimizedImage.uri,
          session.access_token,
          'dog-photos',
          'uploads'
        );
        console.log('Image uploaded successfully:', uploadedUrl);
      } else {
        throw new Error('No authentication token available');
      }

      // Update photo with the uploaded URL
      const finalPhoto: DogPhoto = {
        ...tempPhoto,
        photoUrl: uploadedUrl, // Replace local URI with Supabase URL
        isUploading: false,
      };

      const finalPhotos = updatedPhotos.map(photo => 
        photo.id === tempId ? finalPhoto : photo
      );
      onPhotosChange(finalPhotos);

      setUploadingPhotos(prev => {
        const newSet = new Set(prev);
        newSet.delete(tempId);
        return newSet;
      });

      if (Platform.OS !== 'web') {
        import('expo-haptics').then((Haptics) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        });
      }

      console.log('Photo processed and uploaded successfully');
    } catch (error) {
      console.error('Error processing photo:', error);
      setUploadingPhotos(prev => {
        const newSet = new Set(prev);
        newSet.delete(tempId);
        return newSet;
      });
      
      // Remove failed photo
      const filteredPhotos = photos.filter(photo => photo.id !== tempId);
      onPhotosChange(filteredPhotos);
      
      Alert.alert('Upload Error', 'Failed to upload photo to cloud storage. Please check your internet connection and try again.');
    }
  }, [photos, onPhotosChange, session?.access_token]);

  const handleAddPhoto = useCallback(async () => {
    if (photos.length >= maxPhotos) {
      Alert.alert('Photo Limit', `You can only add up to ${maxPhotos} photos.`);
      return;
    }

    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to upload photos.');
        return;
      }

      // Show action sheet
      Alert.alert(
        'Add Photo',
        'Choose how you want to add a photo',
        [
          {
            text: 'Camera',
            onPress: async () => {
              const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
              if (cameraPermission.status !== 'granted') {
                Alert.alert('Permission needed', 'Please grant camera permissions to take photos.');
                return;
              }
              
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.9, // High quality for initial capture
              });
              
              if (!result.canceled && result.assets[0]) {
                await processNewPhoto(result.assets[0].uri);
              }
            },
          },
          {
            text: 'Photo Library',
            onPress: async () => {
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.9, // High quality for initial capture
                allowsMultipleSelection: true,
                selectionLimit: maxPhotos - photos.length,
              });
              
              if (!result.canceled && result.assets.length > 0) {
                for (const asset of result.assets) {
                  await processNewPhoto(asset.uri);
                }
              }
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } catch (error) {
      console.error('Error adding photo:', error);
      Alert.alert('Error', 'Failed to add photo. Please try again.');
    }
  }, [photos.length, maxPhotos, processNewPhoto]);

  const handleDeletePhoto = useCallback((photoId: string) => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updatedPhotos = photos.filter(photo => photo.id !== photoId);
            
            // If we deleted the primary photo, make the first remaining photo primary
            if (updatedPhotos.length > 0) {
              const deletedPhoto = photos.find(p => p.id === photoId);
              if (deletedPhoto?.isPrimary) {
                updatedPhotos[0] = { ...updatedPhotos[0], isPrimary: true };
              }
            }
            
            // Reorder indices
            const reorderedPhotos = updatedPhotos.map((photo, index) => ({
              ...photo,
              orderIndex: index,
            }));
            
            onPhotosChange(reorderedPhotos);
            
            if (Platform.OS !== 'web') {
              import('expo-haptics').then((Haptics) => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              });
            }
          },
        },
      ]
    );
  }, [photos, onPhotosChange]);

  const handleSetPrimary = useCallback((photoId: string) => {
    const updatedPhotos = photos.map(photo => ({
      ...photo,
      isPrimary: photo.id === photoId,
    }));
    
    onPhotosChange(updatedPhotos);
    
    if (Platform.OS !== 'web') {
      import('expo-haptics').then((Haptics) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      });
    }
  }, [photos, onPhotosChange]);

  const handlePhotoOptions = useCallback((photo: DogPhoto) => {
    Alert.alert(
      'Photo Options',
      `Options for ${photo.isPrimary ? 'primary' : ''} photo`,
      [
        ...(photo.isPrimary ? [] : [{
          text: 'Set as Primary',
          onPress: () => handleSetPrimary(photo.id!),
        }]),
        {
          text: 'Delete',
          style: 'destructive' as const,
          onPress: () => handleDeletePhoto(photo.id!),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, [handleSetPrimary, handleDeletePhoto]);

  const renderPhoto = useCallback((photo: DogPhoto, index: number) => {
    const isUploading = photo.isUploading || uploadingPhotos.has(photo.id!);
    
    return (
      <View key={photo.id || index} style={styles.photoContainer}>
        <Image
          source={{ uri: photo.photoUrl }}
          style={[
            styles.photo,
            isUploading && styles.uploadingPhoto,
          ]}
          resizeMode="cover"
        />
        
        {/* Primary photo indicator */}
        {photo.isPrimary && (
          <View style={styles.primaryBadge}>
            <Star color="#FFD700" size={12} fill="#FFD700" />
          </View>
        )}
        
        {/* Upload progress indicator */}
        {isUploading && (
          <View style={styles.uploadOverlay}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.uploadText}>Uploading...</Text>
          </View>
        )}
        
        {/* Photo options button */}
        {editable && !isUploading && (
          <TouchableOpacity
            style={styles.optionsButton}
            onPress={() => handlePhotoOptions(photo)}
          >
            <MoreHorizontal color="#fff" size={16} />
          </TouchableOpacity>
        )}
      </View>
    );
  }, [uploadingPhotos, editable, handlePhotoOptions]);

  const renderAddButton = useCallback(() => {
    if (!editable || photos.length >= maxPhotos) return null;
    
    return (
      <TouchableOpacity
        style={styles.addButton}
        onPress={handleAddPhoto}
      >
        <Plus color="#666" size={24} />
        <Text style={styles.addButtonText}>Add Photo</Text>
      </TouchableOpacity>
    );
  }, [editable, photos.length, maxPhotos, handleAddPhoto]);

  return (
    <View style={styles.container}>
      {photos.length > 0 && (
        <View style={styles.instructionsContainer}>
          <View style={styles.instructionsRow}>
            <Text style={styles.instructionText}>Tap </Text>
            <View style={styles.cameraIconContainer}>
              <Camera color="#fff" size={12} />
            </View>
            <Text style={styles.instructionText}> to edit and </Text>
            <View style={styles.moreDotsContainer}>
              <MoreHorizontal color="#fff" size={12} />
            </View>
            <Text style={styles.instructionText}> for options.</Text>
          </View>
          <View style={styles.instructionsRow}>
            <View style={styles.starIconContainer}>
              <Star color="#FFD700" size={12} fill="#FFD700" />
            </View>
            <Text style={styles.instructionText}> = Primary photo</Text>
          </View>
        </View>
      )}
      
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.photosContainer}
      >
        {sortedPhotos.map(renderPhoto)}
        {renderAddButton()}
      </ScrollView>
      
      {photos.length === 0 && editable && (
        <View style={styles.emptyState}>
          <Camera color="#ccc" size={48} />
          <Text style={styles.emptyTitle}>No photos yet</Text>
          <Text style={styles.emptySubtitle}>
            Add photos to showcase your dog&apos;s personality
          </Text>
          <TouchableOpacity style={styles.emptyButton} onPress={handleAddPhoto}>
            <Text style={styles.emptyButtonText}>Add First Photo</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 20,
  },
  instructionsContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  instructionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  instructionText: {
    fontSize: 12,
    color: '#000',
    fontWeight: '500',
  },
  cameraIconContainer: {
    backgroundColor: '#FF6B6B',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  moreDotsContainer: {
    backgroundColor: '#FF6B6B',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  starIconContainer: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderRadius: 10,
    padding: 4,
    marginHorizontal: 2,
  },
  photosContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  photoContainer: {
    position: 'relative',
  },
  photo: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  uploadingPhoto: {
    opacity: 0.7,
  },
  primaryBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 4,
  },
  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
  },
  optionsButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 4,
  },
  addButton: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  addButtonText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
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
    marginTop: 16,
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