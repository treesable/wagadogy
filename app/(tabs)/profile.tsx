import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  Switch,
  Modal,
  Dimensions,
} from "react-native";
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from "react-native-safe-area-context";
import { Camera, Edit2, MapPin, Heart, Star, LogOut, User, Settings, Activity, Shield, Calendar, Bell, Eye, Sliders, Play, X } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { useStats } from "@/contexts/StatsContext";
import { UserPreferences, UserSettings, DogProfileData, DogPhoto } from "@/types/app";
import Dropdown from "@/components/Dropdown";
import MultiSelect from "@/components/MultiSelect";
import PhotoGallery from "@/components/PhotoGallery";
import DogProfileSelector from "@/components/DogProfileSelector";
import { uploadImageToSupabaseAuth } from '@/utils/imageUtils';
import ApiTest from '@/components/ApiTest';

type EditMode = 'none' | 'dog' | 'user' | 'preferences' | 'settings' | 'health' | 'behavior' | 'photos' | 'dogs';

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

interface ProfilePreviewModalProps {
  visible: boolean;
  onClose: () => void;
  dogProfile?: DogProfileData;
  userProfile: any;
}

const ProfilePreviewModal: React.FC<ProfilePreviewModalProps> = ({ visible, onClose, dogProfile, userProfile }) => {
  const displayDog = dogProfile || {
    name: userProfile.dogName,
    breed: userProfile.breed,
    age: userProfile.age,
    size: userProfile.size,
    bio: userProfile.dogBio,
    photos: userProfile.dogPhoto ? [{ photoUrl: userProfile.dogPhoto, isPrimary: true }] : [],
  };

  const primaryPhoto = displayDog.photos?.find(photo => photo.isPrimary) || displayDog.photos?.[0];
  const photoUrl = primaryPhoto?.photoUrl || userProfile.dogPhoto;
  const distance = "2.5 km away"; // Mock distance

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={previewStyles.container}>
        <View style={previewStyles.header}>
          <Text style={previewStyles.headerTitle}>Profile Preview</Text>
          <TouchableOpacity style={previewStyles.closeButton} onPress={onClose}>
            <Text style={previewStyles.closeButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView
          style={previewStyles.body}
          contentContainerStyle={previewStyles.bodyContent}
          showsVerticalScrollIndicator
          testID="profile-preview-scroll"
        >
          <Text style={previewStyles.subtitle}>This is how your profile appears to others</Text>
          
          <View style={previewStyles.cardContainer}>
            <View style={previewStyles.card}>
              <Image source={{ uri: photoUrl }} style={previewStyles.cardImage} />
              
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.8)"]}
                style={previewStyles.cardGradient}
              />
              
              <View style={previewStyles.cardInfo}>
                <Text style={previewStyles.cardName}>
                  {displayDog.name}, {displayDog.age}
                </Text>
                <Text style={previewStyles.cardBreed}>{displayDog.breed}</Text>
                <View style={previewStyles.cardDetails}>
                  <View style={previewStyles.detailItem}>
                    <MapPin color="#fff" size={16} />
                    <Text style={previewStyles.detailText}>{distance}</Text>
                  </View>
                  <View style={previewStyles.detailItem}>
                    <Calendar color="#fff" size={16} />
                    <Text style={previewStyles.detailText}>{displayDog.size}</Text>
                  </View>
                </View>
                <Text style={previewStyles.cardBio} numberOfLines={2}>
                  {displayDog.bio || "No bio available"}
                </Text>
              </View>
            </View>
          </View>
          
          <View style={previewStyles.infoContainer}>
            <Text style={previewStyles.infoTitle}>Profile Tips</Text>
            <Text style={previewStyles.infoText}>• Add multiple photos to showcase your dog's personality</Text>
            <Text style={previewStyles.infoText}>• Write an engaging bio that highlights what makes your dog special</Text>
            <Text style={previewStyles.infoText}>• Keep your profile information up to date</Text>
            <Text style={previewStyles.infoText}>• The first photo is your primary photo that others see first</Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

export default function ProfileScreen() {
  const { userProfile, updateUserProfile } = useApp();
  const { user, signOut, updateUserProfile: updateSupabaseProfile, session } = useAuth();
  const { stats, refreshStats } = useStats();
  const [editMode, setEditMode] = useState<EditMode>('none');
  const [editedProfile, setEditedProfile] = useState(userProfile);
  const [saving, setSaving] = useState(false);
  const [activeDogId, setActiveDogId] = useState<string | undefined>(userProfile.activeDogId);
  const [dogProfiles, setDogProfiles] = useState<DogProfileData[]>(userProfile.dogProfiles || []);
  const [showPreview, setShowPreview] = useState(false);
  const [showApiTest, setShowApiTest] = useState(false);
  
  // Get the active dog for display
  const activeDog = dogProfiles.length > 0 ? (dogProfiles.find(dog => dog.id === activeDogId) || dogProfiles.find(dog => dog.isPrimary) || dogProfiles[0]) : undefined;
  
  // Get the primary photo from the active dog
  const getActiveDogPhoto = () => {
    if (!activeDog || !activeDog.photos || activeDog.photos.length === 0) {
      return userProfile.dogPhoto || "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400";
    }
    const primaryPhoto = activeDog.photos.find(photo => photo.isPrimary) || activeDog.photos[0];
    return primaryPhoto?.photoUrl || userProfile.dogPhoto || "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400";
  };

  useEffect(() => {
    setEditedProfile(userProfile);
    setDogProfiles(userProfile.dogProfiles || []);
    setActiveDogId(userProfile.activeDogId);
  }, [userProfile]);
  
  // Update the main profile photo when active dog changes
  useEffect(() => {
    if (activeDog) {
      const primaryPhoto = activeDog.photos.find(photo => photo.isPrimary) || activeDog.photos[0];
      if (primaryPhoto && primaryPhoto.photoUrl !== editedProfile.dogPhoto) {
        setEditedProfile(prev => ({ ...prev, dogPhoto: primaryPhoto.photoUrl }));
      }
    }
  }, [activeDog, editedProfile.dogPhoto]);

  const handleSave = async () => {
    setSaving(true);
    try {
      console.log('Saving profile changes:', editedProfile);
      console.log('Saving dog profiles:', dogProfiles);
      
      // Update the profile with the current dog profiles and active dog
      const updatedProfile = {
        ...editedProfile,
        dogProfiles,
        activeDogId,
      };
      
      // Update profile (this now handles both Supabase and local updates)
      await updateUserProfile(updatedProfile);
      
      // Also update user_profiles table if user info changed
      if (editMode === 'user') {
        const { error } = await updateSupabaseProfile({
          full_name: editedProfile.fullName,
          phone: editedProfile.phone,
          avatar_url: editedProfile.avatarUrl,
          date_of_birth: editedProfile.dateOfBirth,
          address: editedProfile.address,
          city: editedProfile.city,
          state: editedProfile.state,
          country: editedProfile.country,
          bio: editedProfile.bio,
        });
        
        if (error) {
          console.error('Error updating user_profiles table:', JSON.stringify(error, null, 2));
          // Don't fail the whole operation for this
        }
      }
      
      setEditMode('none');
      
      if (Platform.OS !== "web") {
        import("expo-haptics").then((Haptics) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        });
      }
      
      console.log('Profile saved successfully');
    } catch (error) {
      console.error('Error saving profile:', JSON.stringify(error, null, 2));
      Alert.alert('Error', 'Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedProfile(userProfile);
    setEditMode('none');
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: signOut },
      ]
    );
  };

  const handlePhotoUpload = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to upload photos.');
        return;
      }

      // Show action sheet
      Alert.alert(
        'Update Photo',
        'Choose how you want to update your dog\'s photo',
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
                quality: 0.8,
              });
              
              if (!result.canceled && result.assets[0]) {
                console.log('Camera photo selected:', result.assets[0].uri);
                
                try {
                  // Upload to Supabase Storage first
                  let uploadedUrl: string;
                  if (session?.access_token) {
                    console.log('Uploading camera image to Supabase Storage...');
                    uploadedUrl = await uploadImageToSupabaseAuth(
                      result.assets[0].uri,
                      session.access_token,
                      'dog-photos',
                      'uploads'
                    );
                    console.log('Camera image uploaded successfully:', uploadedUrl);
                  } else {
                    throw new Error('No authentication token available');
                  }
                  
                  // Update the active dog's photos with uploaded URL
                  if (activeDog) {
                    const newPhoto: DogPhoto = {
                      photoUrl: uploadedUrl, // Use uploaded URL instead of local URI
                      isPrimary: activeDog.photos.length === 0, // First photo is primary
                      orderIndex: activeDog.photos.length,
                      localUri: result.assets[0].uri,
                    };
                    
                    const updatedDogs = dogProfiles.map(dog => 
                      dog.id === activeDog.id 
                        ? { ...dog, photos: [...dog.photos, newPhoto] }
                        : dog
                    );
                    setDogProfiles(updatedDogs);
                    
                    // Update main profile photo if this is the primary dog
                    if (activeDog.isPrimary || newPhoto.isPrimary) {
                      setEditedProfile({ ...editedProfile, dogPhoto: uploadedUrl });
                    }
                    
                    // Auto-save the changes
                    const updatedProfile = {
                      ...editedProfile,
                      dogProfiles: updatedDogs,
                      dogPhoto: (activeDog.isPrimary || newPhoto.isPrimary) ? uploadedUrl : editedProfile.dogPhoto,
                    };
                    await updateUserProfile(updatedProfile);
                  } else {
                    // Fallback to old system
                    setEditedProfile({ ...editedProfile, dogPhoto: uploadedUrl });
                    await updateUserProfile({ ...editedProfile, dogPhoto: uploadedUrl });
                  }
                } catch (uploadError) {
                  console.error('Error uploading camera photo:', uploadError);
                  Alert.alert('Upload Error', 'Failed to upload photo to cloud storage. Please check your internet connection and try again.');
                }
                
                if (Platform.OS !== "web") {
                  import("expo-haptics").then((Haptics) => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  });
                }
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
                quality: 0.8,
              });
              
              if (!result.canceled && result.assets[0]) {
                console.log('Library photo selected:', result.assets[0].uri);
                
                try {
                  // Upload to Supabase Storage first
                  let uploadedUrl: string;
                  if (session?.access_token) {
                    console.log('Uploading library image to Supabase Storage...');
                    uploadedUrl = await uploadImageToSupabaseAuth(
                      result.assets[0].uri,
                      session.access_token,
                      'dog-photos',
                      'uploads'
                    );
                    console.log('Library image uploaded successfully:', uploadedUrl);
                  } else {
                    throw new Error('No authentication token available');
                  }
                  
                  // Update the active dog's photos with uploaded URL
                  if (activeDog) {
                    const newPhoto: DogPhoto = {
                      photoUrl: uploadedUrl, // Use uploaded URL instead of local URI
                      isPrimary: activeDog.photos.length === 0, // First photo is primary
                      orderIndex: activeDog.photos.length,
                      localUri: result.assets[0].uri,
                    };
                    
                    const updatedDogs = dogProfiles.map(dog => 
                      dog.id === activeDog.id 
                        ? { ...dog, photos: [...dog.photos, newPhoto] }
                        : dog
                    );
                    setDogProfiles(updatedDogs);
                    
                    // Update main profile photo if this is the primary dog
                    if (activeDog.isPrimary || newPhoto.isPrimary) {
                      setEditedProfile({ ...editedProfile, dogPhoto: uploadedUrl });
                    }
                    
                    // Auto-save the changes
                    const updatedProfile = {
                      ...editedProfile,
                      dogProfiles: updatedDogs,
                      dogPhoto: (activeDog.isPrimary || newPhoto.isPrimary) ? uploadedUrl : editedProfile.dogPhoto,
                    };
                    await updateUserProfile(updatedProfile);
                  } else {
                    // Fallback to old system
                    setEditedProfile({ ...editedProfile, dogPhoto: uploadedUrl });
                    await updateUserProfile({ ...editedProfile, dogPhoto: uploadedUrl });
                  }
                } catch (uploadError) {
                  console.error('Error uploading library photo:', uploadError);
                  Alert.alert('Upload Error', 'Failed to upload photo to cloud storage. Please check your internet connection and try again.');
                }
                
                if (Platform.OS !== "web") {
                  import("expo-haptics").then((Haptics) => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  });
                }
              }
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } catch (error) {
      console.error('Error uploading photo:', error);
      Alert.alert('Error', 'Failed to upload photo. Please try again.');
    }
  };

  const updateActiveDog = (updates: Partial<DogProfileData>) => {
    if (!activeDog) return;
    
    const updatedDogs = dogProfiles.map(dog => 
      dog.id === activeDog.id ? { ...dog, ...updates } : dog
    );
    setDogProfiles(updatedDogs);
    
    // Also update the legacy fields in editedProfile for consistency
    setEditedProfile(prev => ({
      ...prev,
      dogName: updates.name ?? prev.dogName,
      breed: updates.breed ?? prev.breed,
      age: updates.age ?? prev.age,
      weight: updates.weight ?? prev.weight,
      gender: updates.gender ?? prev.gender,
      isNeutered: updates.isNeutered ?? prev.isNeutered,
      size: updates.size ?? prev.size,
      dogBio: updates.bio ?? prev.dogBio,
    }));
  };

  const renderDogSection = () => {
    const displayDog = activeDog || {
      name: userProfile.dogName,
      breed: userProfile.breed,
      age: userProfile.age,
      weight: userProfile.weight,
      gender: userProfile.gender,
      isNeutered: userProfile.isNeutered,
      size: userProfile.size,
      bio: userProfile.dogBio,
    };
    
    return (
      <View style={styles.infoSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>About {displayDog.name}</Text>
          <TouchableOpacity 
            style={styles.editSectionButton} 
            onPress={() => setEditMode(editMode === 'dog' ? 'none' : 'dog')}
          >
            <Edit2 color="#FF6B6B" size={18} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Name</Text>
          {editMode === 'dog' ? (
            <TextInput
              style={styles.infoInput}
              value={displayDog.name}
              onChangeText={(text) => updateActiveDog({ name: text })}
              placeholder="Dog's name"
            />
          ) : (
            <Text style={styles.infoValue}>{displayDog.name}</Text>
          )}
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Breed</Text>
          {editMode === 'dog' ? (
            <TextInput
              style={styles.infoInput}
              value={displayDog.breed}
              onChangeText={(text) => updateActiveDog({ breed: text })}
            />
          ) : (
            <Text style={styles.infoValue}>{displayDog.breed}</Text>
          )}
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Age</Text>
          {editMode === 'dog' ? (
            <TextInput
              style={styles.infoInput}
              value={displayDog.age?.toString() || ''}
              onChangeText={(text) => updateActiveDog({ age: parseInt(text) || 0 })}
              keyboardType="numeric"
              placeholder="Age in years"
            />
          ) : (
            <Text style={styles.infoValue}>{displayDog.age} years</Text>
          )}
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Weight</Text>
          {editMode === 'dog' ? (
            <TextInput
              style={styles.infoInput}
              value={displayDog.weight?.toString() || ''}
              onChangeText={(text) => updateActiveDog({ weight: parseFloat(text) || undefined })}
              keyboardType="decimal-pad"
              placeholder="Weight in kg"
            />
          ) : (
            <Text style={styles.infoValue}>{displayDog.weight ? `${displayDog.weight} kg` : 'Not set'}</Text>
          )}
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Gender</Text>
          {editMode === 'dog' ? (
            <Dropdown
              label=""
              value={displayDog.gender}
              options={["Male", "Female"]}
              onSelect={(gender) => updateActiveDog({ gender })}
            />
          ) : (
            <Text style={styles.infoValue}>{displayDog.gender}</Text>
          )}
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Neutered/Spayed</Text>
          {editMode === 'dog' ? (
            <Switch
              value={displayDog.isNeutered}
              onValueChange={(value: boolean) => updateActiveDog({ isNeutered: value })}
              trackColor={{ false: '#ccc', true: '#FF6B6B' }}
              thumbColor={displayDog.isNeutered ? '#fff' : '#f4f3f4'}
            />
          ) : (
            <Text style={styles.infoValue}>{displayDog.isNeutered ? 'Yes' : 'No'}</Text>
          )}
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Size</Text>
          {editMode === 'dog' ? (
            <Dropdown
              label=""
              value={displayDog.size}
              options={["Small", "Medium", "Large"]}
              onSelect={(size) => updateActiveDog({ size })}
            />
          ) : (
            <Text style={styles.infoValue}>{displayDog.size}</Text>
          )}
        </View>

        <View style={styles.bioSection}>
          <Text style={styles.infoLabel}>Bio</Text>
          {editMode === 'dog' ? (
            <TextInput
              style={styles.bioInput}
              value={displayDog.bio}
              onChangeText={(text) => updateActiveDog({ bio: text })}
              multiline
              numberOfLines={4}
            />
          ) : (
            <Text style={styles.bioText}>{displayDog.bio}</Text>
          )}
        </View>
      </View>
    );
  };

  const renderUserSection = () => (
    <View style={styles.infoSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Owner Profile</Text>
        <TouchableOpacity 
          style={styles.editSectionButton} 
          onPress={() => setEditMode(editMode === 'user' ? 'none' : 'user')}
        >
          <User color="#FF6B6B" size={18} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Full Name</Text>
        {editMode === 'user' ? (
          <TextInput
            style={styles.infoInput}
            value={editedProfile.fullName || ''}
            onChangeText={(text) => setEditedProfile({ ...editedProfile, fullName: text })}
            placeholder="Your full name"
          />
        ) : (
          <Text style={styles.infoValue}>{userProfile.fullName || 'Not set'}</Text>
        )}
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Email</Text>
        <Text style={styles.infoValue}>{userProfile.email || 'Not available'}</Text>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Phone</Text>
        {editMode === 'user' ? (
          <TextInput
            style={styles.infoInput}
            value={editedProfile.phone || ''}
            onChangeText={(text) => setEditedProfile({ ...editedProfile, phone: text })}
            placeholder="Your phone number"
            keyboardType="phone-pad"
          />
        ) : (
          <Text style={styles.infoValue}>{userProfile.phone || 'Not set'}</Text>
        )}
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Date of Birth</Text>
        {editMode === 'user' ? (
          <TextInput
            style={styles.infoInput}
            value={editedProfile.dateOfBirth || ''}
            onChangeText={(text) => setEditedProfile({ ...editedProfile, dateOfBirth: text })}
            placeholder="YYYY-MM-DD"
          />
        ) : (
          <Text style={styles.infoValue}>{userProfile.dateOfBirth || 'Not set'}</Text>
        )}
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>City</Text>
        {editMode === 'user' ? (
          <TextInput
            style={styles.infoInput}
            value={editedProfile.city || ''}
            onChangeText={(text) => setEditedProfile({ ...editedProfile, city: text })}
            placeholder="Your city"
          />
        ) : (
          <Text style={styles.infoValue}>{userProfile.city || 'Not set'}</Text>
        )}
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>State</Text>
        {editMode === 'user' ? (
          <TextInput
            style={styles.infoInput}
            value={editedProfile.state || ''}
            onChangeText={(text) => setEditedProfile({ ...editedProfile, state: text })}
            placeholder="Your state"
          />
        ) : (
          <Text style={styles.infoValue}>{userProfile.state || 'Not set'}</Text>
        )}
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Country</Text>
        {editMode === 'user' ? (
          <TextInput
            style={styles.infoInput}
            value={editedProfile.country || ''}
            onChangeText={(text) => setEditedProfile({ ...editedProfile, country: text })}
            placeholder="Your country"
          />
        ) : (
          <Text style={styles.infoValue}>{userProfile.country || 'Not set'}</Text>
        )}
      </View>

      <View style={styles.bioSection}>
        <Text style={styles.infoLabel}>About You</Text>
        {editMode === 'user' ? (
          <TextInput
            style={styles.bioInput}
            value={editedProfile.bio || ''}
            onChangeText={(text) => setEditedProfile({ ...editedProfile, bio: text })}
            multiline
            numberOfLines={4}
            placeholder="Tell us about yourself..."
          />
        ) : (
          <Text style={styles.bioText}>{userProfile.bio || 'No bio set'}</Text>
        )}
      </View>
    </View>
  );

  const renderPreferencesSection = () => {
    const preferences = editMode === 'preferences' ? editedProfile.preferences : userProfile.preferences;
    
    return (
      <View style={styles.infoSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <TouchableOpacity 
            style={styles.editSectionButton} 
            onPress={() => setEditMode(editMode === 'preferences' ? 'none' : 'preferences')}
          >
            <Settings color="#FF6B6B" size={18} />
          </TouchableOpacity>
        </View>
        
        {editMode === 'preferences' ? (
          <View style={styles.preferencesForm}>
            <Dropdown
              label="Looking for"
              value={preferences.lookingFor}
              options={["Playdates", "Friends", "Walking Partners", "All"]}
              onSelect={(lookingFor) => setEditedProfile({ 
                ...editedProfile, 
                preferences: { ...editedProfile.preferences, lookingFor } 
              })}
            />
            
            <Dropdown
              label="Preferred size"
              value={preferences.preferredSize}
              options={["Small", "Medium", "Large", "All sizes"]}
              onSelect={(preferredSize) => setEditedProfile({ 
                ...editedProfile, 
                preferences: { ...editedProfile.preferences, preferredSize } 
              })}
            />
            
            <Dropdown
              label="Max distance"
              value={`${preferences.maxDistance}`}
              options={["1", "3", "5", "10", "25"]}
              onSelect={(distance) => setEditedProfile({ 
                ...editedProfile, 
                preferences: { ...editedProfile.preferences, maxDistance: parseInt(distance) as 1 | 3 | 5 | 10 | 25 } 
              })}
            />
            
            <Dropdown
              label="Age range"
              value={preferences.ageRange}
              options={["Puppy (0-1)", "Young (1-3)", "Adult (3-7)", "Senior (7+)", "All ages"]}
              onSelect={(ageRange) => setEditedProfile({ 
                ...editedProfile, 
                preferences: { ...editedProfile.preferences, ageRange } 
              })}
            />
            
            <Dropdown
              label="Activity level"
              value={preferences.activityLevel}
              options={["Low", "Moderate", "High", "Very High"]}
              onSelect={(activityLevel) => setEditedProfile({ 
                ...editedProfile, 
                preferences: { ...editedProfile.preferences, activityLevel } 
              })}
            />
            
            <Dropdown
              label="Play style"
              value={preferences.playStyle}
              options={["Gentle", "Moderate", "Rough", "All styles"]}
              onSelect={(playStyle) => setEditedProfile({ 
                ...editedProfile, 
                preferences: { ...editedProfile.preferences, playStyle } 
              })}
            />
            
            <MultiSelect
              label="Available times"
              values={preferences.availableTimes || []}
              options={["Early Morning", "Morning", "Afternoon", "Evening", "Night", "Weekends"]}
              onSelect={(availableTimes) => setEditedProfile({ 
                ...editedProfile, 
                preferences: { ...editedProfile.preferences, availableTimes } 
              })}
            />
          </View>
        ) : (
          <View>
            <View style={styles.preferenceItem}>
              <Text style={styles.preferenceLabel}>Looking for</Text>
              <Text style={styles.preferenceValue}>{preferences.lookingFor}</Text>
            </View>
            
            <View style={styles.preferenceItem}>
              <Text style={styles.preferenceLabel}>Preferred size</Text>
              <Text style={styles.preferenceValue}>{preferences.preferredSize}</Text>
            </View>
            
            <View style={styles.preferenceItem}>
              <Text style={styles.preferenceLabel}>Distance</Text>
              <Text style={styles.preferenceValue}>Within {preferences.maxDistance} miles</Text>
            </View>
            
            <View style={styles.preferenceItem}>
              <Text style={styles.preferenceLabel}>Age range</Text>
              <Text style={styles.preferenceValue}>{preferences.ageRange}</Text>
            </View>
            
            <View style={styles.preferenceItem}>
              <Text style={styles.preferenceLabel}>Activity level</Text>
              <Text style={styles.preferenceValue}>{preferences.activityLevel}</Text>
            </View>
            
            <View style={styles.preferenceItem}>
              <Text style={styles.preferenceLabel}>Play style</Text>
              <Text style={styles.preferenceValue}>{preferences.playStyle}</Text>
            </View>
            
            <View style={styles.preferenceItem}>
              <Text style={styles.preferenceLabel}>Available times</Text>
              <Text style={styles.preferenceValue}>{preferences.availableTimes?.join(', ') || 'Not set'}</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderBehaviorSection = () => {
    const displayDog = activeDog || {
      personalityTraits: userProfile.personalityTraits,
      energyLevel: userProfile.energyLevel,
      friendlinessLevel: userProfile.friendlinessLevel,
      trainingLevel: userProfile.trainingLevel,
    };
    
    return (
      <View style={styles.infoSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Behavior & Personality</Text>
          <TouchableOpacity 
            style={styles.editSectionButton} 
            onPress={() => setEditMode(editMode === 'behavior' ? 'none' : 'behavior')}
          >
            <Activity color="#FF6B6B" size={18} />
          </TouchableOpacity>
        </View>
        
        {editMode === 'behavior' ? (
          <View style={styles.behaviorForm}>
            <MultiSelect
              label="Personality Traits"
              values={displayDog.personalityTraits || []}
              options={["Friendly", "Energetic", "Calm", "Playful", "Loyal", "Independent", "Protective", "Social", "Gentle", "Curious", "Obedient", "Adventurous"]}
              onSelect={(personalityTraits) => updateActiveDog({ personalityTraits })}
            />
            
            <View style={styles.sliderSection}>
              <Text style={styles.sliderLabel}>Energy Level: {displayDog.energyLevel}/5</Text>
              <View style={styles.ratingContainer}>
                {[1, 2, 3, 4, 5].map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.ratingButton,
                      displayDog.energyLevel >= level && styles.ratingButtonActive
                    ]}
                    onPress={() => updateActiveDog({ energyLevel: level })}
                  >
                    <Text style={[
                      styles.ratingText,
                      displayDog.energyLevel >= level && styles.ratingTextActive
                    ]}>{level}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={styles.sliderSection}>
              <Text style={styles.sliderLabel}>Friendliness Level: {displayDog.friendlinessLevel}/5</Text>
              <View style={styles.ratingContainer}>
                {[1, 2, 3, 4, 5].map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.ratingButton,
                      displayDog.friendlinessLevel >= level && styles.ratingButtonActive
                    ]}
                    onPress={() => updateActiveDog({ friendlinessLevel: level })}
                  >
                    <Text style={[
                      styles.ratingText,
                      displayDog.friendlinessLevel >= level && styles.ratingTextActive
                    ]}>{level}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={styles.sliderSection}>
              <Text style={styles.sliderLabel}>Training Level: {displayDog.trainingLevel}/5</Text>
              <View style={styles.ratingContainer}>
                {[1, 2, 3, 4, 5].map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.ratingButton,
                      displayDog.trainingLevel >= level && styles.ratingButtonActive
                    ]}
                    onPress={() => updateActiveDog({ trainingLevel: level })}
                  >
                    <Text style={[
                      styles.ratingText,
                      displayDog.trainingLevel >= level && styles.ratingTextActive
                    ]}>{level}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        ) : (
          <View>
            <View style={styles.preferenceItem}>
              <Text style={styles.preferenceLabel}>Personality</Text>
              <Text style={styles.preferenceValue}>{displayDog.personalityTraits?.join(', ') || 'Not set'}</Text>
            </View>
            
            <View style={styles.preferenceItem}>
              <Text style={styles.preferenceLabel}>Energy Level</Text>
              <Text style={styles.preferenceValue}>{displayDog.energyLevel}/5</Text>
            </View>
            
            <View style={styles.preferenceItem}>
              <Text style={styles.preferenceLabel}>Friendliness</Text>
              <Text style={styles.preferenceValue}>{displayDog.friendlinessLevel}/5</Text>
            </View>
            
            <View style={styles.preferenceItem}>
              <Text style={styles.preferenceLabel}>Training Level</Text>
              <Text style={styles.preferenceValue}>{displayDog.trainingLevel}/5</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderHealthSection = () => {
    const displayDog = activeDog || {
      vaccinationStatus: userProfile.vaccinationStatus,
      vaccinationDate: userProfile.vaccinationDate,
      healthNotes: userProfile.healthNotes,
    };
    
    return (
      <View style={styles.infoSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Health & Medical</Text>
          <TouchableOpacity 
            style={styles.editSectionButton} 
            onPress={() => setEditMode(editMode === 'health' ? 'none' : 'health')}
          >
            <Shield color="#FF6B6B" size={18} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Vaccination Status</Text>
          {editMode === 'health' ? (
            <Switch
              value={displayDog.vaccinationStatus}
              onValueChange={(value: boolean) => updateActiveDog({ vaccinationStatus: value })}
              trackColor={{ false: '#ccc', true: '#4ECDC4' }}
              thumbColor={displayDog.vaccinationStatus ? '#fff' : '#f4f3f4'}
            />
          ) : (
            <Text style={styles.infoValue}>{displayDog.vaccinationStatus ? 'Up to date' : 'Needs update'}</Text>
          )}
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Last Vaccination</Text>
          {editMode === 'health' ? (
            <TextInput
              style={styles.infoInput}
              value={displayDog.vaccinationDate || ''}
              onChangeText={(text) => updateActiveDog({ vaccinationDate: text })}
              placeholder="YYYY-MM-DD"
            />
          ) : (
            <Text style={styles.infoValue}>{displayDog.vaccinationDate || 'Not set'}</Text>
          )}
        </View>

        <View style={styles.bioSection}>
          <Text style={styles.infoLabel}>Health Notes</Text>
          {editMode === 'health' ? (
            <TextInput
              style={styles.bioInput}
              value={displayDog.healthNotes || ''}
              onChangeText={(text) => updateActiveDog({ healthNotes: text })}
              multiline
              numberOfLines={4}
              placeholder="Any health conditions, allergies, medications, or special care instructions..."
            />
          ) : (
            <Text style={styles.bioText}>{displayDog.healthNotes || 'No health notes'}</Text>
          )}
        </View>
      </View>
    );
  };

  const renderDogProfilesSection = () => (
    <View style={styles.infoSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Dog Profile Images ({dogProfiles.length})</Text>
        <TouchableOpacity 
          style={styles.editSectionButton} 
          onPress={() => setEditMode(editMode === 'dogs' ? 'none' : 'dogs')}
        >
          <Edit2 color="#FF6B6B" size={18} />
        </TouchableOpacity>
      </View>
      
      <Text style={styles.encouragementText}>
        {dogProfiles.length === 0 
          ? "Create your first dog profile to start connecting with other dog lovers! 🐕" 
          : dogProfiles.length === 1 
          ? "Why not add another furry friend? Multiple profiles help you find the perfect playmates! 🐾" 
          : "Great collection! Each dog profile opens up new opportunities for connections and adventures! ✨"
        }
      </Text>
      
      <DogProfileSelector
        dogProfiles={dogProfiles}
        activeDogId={activeDogId}
        onDogSelect={(dogId) => {
          console.log('Selecting dog:', dogId);
          setActiveDogId(dogId);
          
          // Update the main profile to reflect the selected dog
          const selectedDog = dogProfiles.find(dog => dog.id === dogId);
          if (selectedDog) {
            const primaryPhoto = selectedDog.photos.find(photo => photo.isPrimary) || selectedDog.photos[0];
            setEditedProfile(prev => ({
              ...prev,
              dogName: selectedDog.name,
              dogPhoto: primaryPhoto?.photoUrl || prev.dogPhoto,
              breed: selectedDog.breed,
              age: selectedDog.age,
              size: selectedDog.size,
              weight: selectedDog.weight,
              gender: selectedDog.gender,
              isNeutered: selectedDog.isNeutered,
              dogBio: selectedDog.bio,
              personalityTraits: selectedDog.personalityTraits,
              energyLevel: selectedDog.energyLevel,
              friendlinessLevel: selectedDog.friendlinessLevel,
              trainingLevel: selectedDog.trainingLevel,
              healthNotes: selectedDog.healthNotes,
              vaccinationStatus: selectedDog.vaccinationStatus,
              vaccinationDate: selectedDog.vaccinationDate,
              activeDogId: dogId,
            }));
          }
        }}
        onAddDog={() => {
          // Create new dog profile
          const newDog: DogProfileData = {
            id: `temp-${Date.now()}`,
            name: dogProfiles.length === 0 ? 'Max' : 'New Dog', // Use default name for first dog
            breed: dogProfiles.length === 0 ? 'Golden Retriever' : '',
            age: dogProfiles.length === 0 ? 3 : 1,
            size: dogProfiles.length === 0 ? 'Large' : 'Medium',
            weight: dogProfiles.length === 0 ? 30.5 : undefined,
            gender: 'Male',
            isNeutered: dogProfiles.length === 0 ? true : false,
            bio: dogProfiles.length === 0 ? 'Friendly golden who loves fetch and swimming! Looking for playmates who enjoy outdoor adventures.' : '',
            personalityTraits: dogProfiles.length === 0 ? ['Friendly', 'Energetic', 'Loyal'] : [],
            energyLevel: dogProfiles.length === 0 ? 4 : 3,
            friendlinessLevel: dogProfiles.length === 0 ? 5 : 3,
            trainingLevel: 3,
            healthNotes: dogProfiles.length === 0 ? 'No known health issues. Regular vet checkups.' : undefined,
            vaccinationStatus: dogProfiles.length === 0 ? true : false,
            vaccinationDate: dogProfiles.length === 0 ? '2024-01-15' : undefined,
            isPrimary: dogProfiles.length === 0, // First dog is always primary
            isActive: true,
            photos: dogProfiles.length === 0 ? [{
              photoUrl: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400",
              isPrimary: true,
              orderIndex: 0,
            }] : [],
            ownerId: userProfile.id,
            createdAt: new Date().toISOString(),
          };
          setDogProfiles([...dogProfiles, newDog]);
          setActiveDogId(newDog.id);
          setEditMode('dog');
        }}
        onEditDog={(dogId) => {
          setActiveDogId(dogId);
          setEditMode('dog');
        }}
        onDeleteDog={(dogId) => {
          const updatedDogs = dogProfiles.filter(dog => dog.id !== dogId);
          // If we deleted the active dog, select the first remaining or primary
          if (activeDogId === dogId) {
            const newActive = updatedDogs.find(dog => dog.isPrimary) || updatedDogs[0];
            setActiveDogId(newActive?.id);
          }
          setDogProfiles(updatedDogs);
        }}
        onSetPrimary={(dogId) => {
          const updatedDogs = dogProfiles.map(dog => ({
            ...dog,
            isPrimary: dog.id === dogId,
          }));
          setDogProfiles(updatedDogs);
          
          // Update the main profile to use the new primary dog
          const newPrimaryDog = updatedDogs.find(dog => dog.isPrimary);
          if (newPrimaryDog) {
            const primaryPhoto = newPrimaryDog.photos.find(photo => photo.isPrimary) || newPrimaryDog.photos[0];
            setEditedProfile(prev => ({
              ...prev,
              dogName: newPrimaryDog.name,
              dogPhoto: primaryPhoto?.photoUrl || prev.dogPhoto,
              breed: newPrimaryDog.breed,
              age: newPrimaryDog.age,
              size: newPrimaryDog.size,
              weight: newPrimaryDog.weight,
              gender: newPrimaryDog.gender,
              isNeutered: newPrimaryDog.isNeutered,
              dogBio: newPrimaryDog.bio,
              personalityTraits: newPrimaryDog.personalityTraits,
              energyLevel: newPrimaryDog.energyLevel,
              friendlinessLevel: newPrimaryDog.friendlinessLevel,
              trainingLevel: newPrimaryDog.trainingLevel,
              healthNotes: newPrimaryDog.healthNotes,
              vaccinationStatus: newPrimaryDog.vaccinationStatus,
              vaccinationDate: newPrimaryDog.vaccinationDate,
              isPrimary: true,
              activeDogId: newPrimaryDog.id,
            }));
          }
        }}
        editable={editMode === 'dogs'}
      />
    </View>
  );

  const renderPhotosSection = () => {
    const activeDog = dogProfiles.find(dog => dog.id === activeDogId) || dogProfiles[0];
    if (!activeDog) return null;

    return (
      <View style={styles.infoSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Photos - {activeDog.name} ({activeDog.photos.length}/{6})</Text>
          <TouchableOpacity 
            style={styles.editSectionButton} 
            onPress={() => setEditMode(editMode === 'photos' ? 'none' : 'photos')}
          >
            <Camera color="#FF6B6B" size={18} />
          </TouchableOpacity>
        </View>
        
        <PhotoGallery
          photos={activeDog.photos}
          onPhotosChange={(photos) => {
            const updatedDogs = dogProfiles.map(dog => 
              dog.id === activeDog.id ? { ...dog, photos } : dog
            );
            setDogProfiles(updatedDogs);
            
            // Update main profile photo if this is the primary dog
            if (activeDog.isPrimary) {
              const primaryPhoto = photos.find(p => p.isPrimary) || photos[0];
              if (primaryPhoto) {
                setEditedProfile({ ...editedProfile, dogPhoto: primaryPhoto.photoUrl });
              }
            }
          }}
          maxPhotos={6}
          editable={editMode === 'photos'}
        />
      </View>
    );
  };

  const renderSettingsSection = () => {
    const settings = editMode === 'settings' ? editedProfile.userSettings : userProfile.userSettings;
    const defaultSettings = {
      distancePreference: 25,
      ageRangeMin: 1,
      ageRangeMax: 15,
      sizePreferences: ['Small', 'Medium', 'Large'],
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
    const currentSettings = settings || defaultSettings;
    
    return (
      <View style={styles.infoSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>App Settings</Text>
          <TouchableOpacity 
            style={styles.editSectionButton} 
            onPress={() => setEditMode(editMode === 'settings' ? 'none' : 'settings')}
          >
            <Sliders color="#FF6B6B" size={18} />
          </TouchableOpacity>
        </View>
        
        {editMode === 'settings' ? (
          <View style={styles.settingsForm}>
            <View style={styles.settingGroup}>
              <Text style={styles.settingGroupTitle}>Search Preferences</Text>
              
              <View style={styles.sliderSection}>
                <Text style={styles.sliderLabel}>Distance Preference: {currentSettings.distancePreference} km</Text>
                <View style={styles.ratingContainer}>
                  {[5, 10, 25, 50, 100].map((distance) => (
                    <TouchableOpacity
                      key={distance}
                      style={[
                        styles.ratingButton,
                        currentSettings.distancePreference === distance && styles.ratingButtonActive
                      ]}
                      onPress={() => setEditedProfile({ 
                        ...editedProfile, 
                        userSettings: { 
                          ...currentSettings, 
                          distancePreference: distance,
                          userId: userProfile.id 
                        } 
                      })}
                    >
                      <Text style={[
                        styles.ratingText,
                        currentSettings.distancePreference === distance && styles.ratingTextActive
                      ]}>{distance}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              <View style={styles.ageRangeContainer}>
                <Text style={styles.sliderLabel}>Age Range: {currentSettings.ageRangeMin} - {currentSettings.ageRangeMax} years</Text>
                <View style={styles.ageRangeRow}>
                  <View style={styles.ageRangeInput}>
                    <Text style={styles.ageRangeLabel}>Min:</Text>
                    <TextInput
                      style={styles.ageInput}
                      value={currentSettings.ageRangeMin?.toString() || '1'}
                      onChangeText={(text) => setEditedProfile({ 
                        ...editedProfile, 
                        userSettings: { 
                          ...currentSettings, 
                          ageRangeMin: parseInt(text) || 1,
                          userId: userProfile.id 
                        } 
                      })}
                      keyboardType="numeric"
                      placeholder="1"
                    />
                  </View>
                  <View style={styles.ageRangeInput}>
                    <Text style={styles.ageRangeLabel}>Max:</Text>
                    <TextInput
                      style={styles.ageInput}
                      value={currentSettings.ageRangeMax?.toString() || '15'}
                      onChangeText={(text) => setEditedProfile({ 
                        ...editedProfile, 
                        userSettings: { 
                          ...currentSettings, 
                          ageRangeMax: parseInt(text) || 15,
                          userId: userProfile.id 
                        } 
                      })}
                      keyboardType="numeric"
                      placeholder="15"
                    />
                  </View>
                </View>
              </View>
              
              <MultiSelect
                label="Size Preferences"
                values={currentSettings.sizePreferences || []}
                options={['Small', 'Medium', 'Large']}
                onSelect={(sizePreferences) => setEditedProfile({ 
                  ...editedProfile, 
                  userSettings: { 
                    ...currentSettings, 
                    sizePreferences,
                    userId: userProfile.id 
                  } 
                })}
              />
            </View>
            
            <View style={styles.settingGroup}>
              <Text style={styles.settingGroupTitle}>Notifications</Text>
              
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Match Notifications</Text>
                <Switch
                  value={currentSettings.notificationPreferences?.matches ?? true}
                  onValueChange={(value: boolean) => setEditedProfile({ 
                    ...editedProfile, 
                    userSettings: { 
                      ...currentSettings, 
                      notificationPreferences: {
                        ...currentSettings.notificationPreferences,
                        matches: value
                      },
                      userId: userProfile.id 
                    } 
                  })}
                  trackColor={{ false: '#ccc', true: '#4ECDC4' }}
                  thumbColor={currentSettings.notificationPreferences?.matches ? '#fff' : '#f4f3f4'}
                />
              </View>
              
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Message Notifications</Text>
                <Switch
                  value={currentSettings.notificationPreferences?.messages ?? true}
                  onValueChange={(value: boolean) => setEditedProfile({ 
                    ...editedProfile, 
                    userSettings: { 
                      ...currentSettings, 
                      notificationPreferences: {
                        ...currentSettings.notificationPreferences,
                        messages: value
                      },
                      userId: userProfile.id 
                    } 
                  })}
                  trackColor={{ false: '#ccc', true: '#4ECDC4' }}
                  thumbColor={currentSettings.notificationPreferences?.messages ? '#fff' : '#f4f3f4'}
                />
              </View>
              
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Walk Reminders</Text>
                <Switch
                  value={currentSettings.notificationPreferences?.walkReminders ?? true}
                  onValueChange={(value: boolean) => setEditedProfile({ 
                    ...editedProfile, 
                    userSettings: { 
                      ...currentSettings, 
                      notificationPreferences: {
                        ...currentSettings.notificationPreferences,
                        walkReminders: value
                      },
                      userId: userProfile.id 
                    } 
                  })}
                  trackColor={{ false: '#ccc', true: '#4ECDC4' }}
                  thumbColor={currentSettings.notificationPreferences?.walkReminders ? '#fff' : '#f4f3f4'}
                />
              </View>
            </View>
            
            <View style={styles.settingGroup}>
              <Text style={styles.settingGroupTitle}>Privacy</Text>
              
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Show Location</Text>
                <Switch
                  value={currentSettings.privacySettings?.showLocation ?? true}
                  onValueChange={(value: boolean) => setEditedProfile({ 
                    ...editedProfile, 
                    userSettings: { 
                      ...currentSettings, 
                      privacySettings: {
                        ...currentSettings.privacySettings,
                        showLocation: value
                      },
                      userId: userProfile.id 
                    } 
                  })}
                  trackColor={{ false: '#ccc', true: '#4ECDC4' }}
                  thumbColor={currentSettings.privacySettings?.showLocation ? '#fff' : '#f4f3f4'}
                />
              </View>
              
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Show Last Seen</Text>
                <Switch
                  value={currentSettings.privacySettings?.showLastSeen ?? true}
                  onValueChange={(value: boolean) => setEditedProfile({ 
                    ...editedProfile, 
                    userSettings: { 
                      ...currentSettings, 
                      privacySettings: {
                        ...currentSettings.privacySettings,
                        showLastSeen: value
                      },
                      userId: userProfile.id 
                    } 
                  })}
                  trackColor={{ false: '#ccc', true: '#4ECDC4' }}
                  thumbColor={currentSettings.privacySettings?.showLastSeen ? '#fff' : '#f4f3f4'}
                />
              </View>
            </View>
          </View>
        ) : (
          <View>
            <View style={styles.settingGroup}>
              <Text style={styles.settingGroupTitle}>Search Preferences</Text>
              
              <View style={styles.preferenceItem}>
                <Text style={styles.preferenceLabel}>Distance</Text>
                <Text style={styles.preferenceValue}>{currentSettings.distancePreference} km</Text>
              </View>
              
              <View style={styles.preferenceItem}>
                <Text style={styles.preferenceLabel}>Age Range</Text>
                <Text style={styles.preferenceValue}>{currentSettings.ageRangeMin} - {currentSettings.ageRangeMax} years</Text>
              </View>
              
              <View style={styles.preferenceItem}>
                <Text style={styles.preferenceLabel}>Size Preferences</Text>
                <Text style={styles.preferenceValue}>{currentSettings.sizePreferences?.join(', ') || 'All sizes'}</Text>
              </View>
            </View>
            
            <View style={styles.settingGroup}>
              <Text style={styles.settingGroupTitle}>Notifications</Text>
              
              <View style={styles.preferenceItem}>
                <Text style={styles.preferenceLabel}>Matches</Text>
                <Text style={styles.preferenceValue}>{currentSettings.notificationPreferences?.matches ? 'On' : 'Off'}</Text>
              </View>
              
              <View style={styles.preferenceItem}>
                <Text style={styles.preferenceLabel}>Messages</Text>
                <Text style={styles.preferenceValue}>{currentSettings.notificationPreferences?.messages ? 'On' : 'Off'}</Text>
              </View>
              
              <View style={styles.preferenceItem}>
                <Text style={styles.preferenceLabel}>Walk Reminders</Text>
                <Text style={styles.preferenceValue}>{currentSettings.notificationPreferences?.walkReminders ? 'On' : 'Off'}</Text>
              </View>
            </View>
            
            <View style={styles.settingGroup}>
              <Text style={styles.settingGroupTitle}>Privacy</Text>
              
              <View style={styles.preferenceItem}>
                <Text style={styles.preferenceLabel}>Show Location</Text>
                <Text style={styles.preferenceValue}>{currentSettings.privacySettings?.showLocation ? 'Yes' : 'No'}</Text>
              </View>
              
              <View style={styles.preferenceItem}>
                <Text style={styles.preferenceLabel}>Show Last Seen</Text>
                <Text style={styles.preferenceValue}>{currentSettings.privacySettings?.showLastSeen ? 'Yes' : 'No'}</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={["#FF6B6B", "#FF8E53"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.header}>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <LogOut color="#fff" size={20} />
            </TouchableOpacity>
            
            <View style={styles.profileImageContainer}>
              <Image
                source={{ uri: getActiveDogPhoto() }}
                style={styles.profileImage}
              />
              <View style={styles.starBadge}>
                <Star color="#FFD700" size={16} fill="#FFD700" />
              </View>
            </View>

            {editMode === 'dog' ? (
              <TextInput
                style={styles.nameInput}
                value={activeDog?.name || editedProfile.dogName}
                onChangeText={(text) => {
                  if (activeDog) {
                    const updatedDogs = dogProfiles.map(dog => 
                      dog.id === activeDog.id ? { ...dog, name: text } : dog
                    );
                    setDogProfiles(updatedDogs);
                  }
                  setEditedProfile({ ...editedProfile, dogName: text });
                }}
                placeholder="Dog's name"
                placeholderTextColor="rgba(255,255,255,0.7)"
              />
            ) : (
              <Text style={styles.dogName}>{activeDog?.name || userProfile.dogName || 'Add Your Dog'}</Text>
            )}
            
            <Text style={styles.ownerName}>Owner: {userProfile.fullName || userProfile.displayName || userProfile.ownerName}</Text>
            
            <TouchableOpacity 
              style={styles.previewButton} 
              onPress={() => setShowPreview(true)}
            >
              <Eye color="#fff" size={18} />
              <Text style={styles.previewButtonText}>Preview Profile</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <TouchableOpacity 
          style={styles.statsRow} 
          onPress={() => {
            console.log('Refreshing stats manually');
            refreshStats();
          }}
          testID="stats-refresh"
        >
          <View style={styles.statBox}>
            <Heart color="#FF6B6B" size={24} />
            <Text style={styles.statNumber}>
              {stats.loading ? '...' : stats.likes}
            </Text>
            <Text style={styles.statLabel}>Likes</Text>
          </View>
          <View style={styles.statBox}>
            <Star color="#FFD700" size={24} />
            <Text style={styles.statNumber}>
              {stats.loading ? '...' : stats.matches}
            </Text>
            <Text style={styles.statLabel}>Matches</Text>
          </View>
          <View style={styles.statBox}>
            <MapPin color="#4ECDC4" size={24} />
            <Text style={styles.statNumber}>
              {stats.loading ? '...' : stats.walks}
            </Text>
            <Text style={styles.statLabel}>Walks</Text>
          </View>
          {stats.error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Tap to retry</Text>
            </View>
          )}
        </TouchableOpacity>

        {renderPhotosSection()}
        {renderDogProfilesSection()}
        {renderDogSection()}
        {renderPreferencesSection()}
        {renderBehaviorSection()}
        {renderHealthSection()}
        {renderUserSection()}
        {renderSettingsSection()}
        
        <View style={styles.infoSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>API Test</Text>
            <TouchableOpacity 
              style={styles.editSectionButton} 
              onPress={() => setShowApiTest(!showApiTest)}
            >
              <Settings color="#FF6B6B" size={18} />
            </TouchableOpacity>
          </View>
          
          {showApiTest ? (
            <ApiTest />
          ) : (
            <TouchableOpacity 
              style={styles.preferenceItem}
              onPress={() => setShowApiTest(true)}
            >
              <Text style={styles.preferenceLabel}>Test backend connectivity</Text>
              <Text style={styles.preferenceValue}>Tap to test</Text>
            </TouchableOpacity>
          )}
        </View>

        {editMode !== 'none' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.cancelButton]} 
              onPress={handleCancel}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.saveButton]} 
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
      
      {showPreview && (
        <ProfilePreviewModal 
          visible={showPreview}
          onClose={() => setShowPreview(false)}
          dogProfile={activeDog}
          userProfile={userProfile}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  headerGradient: {
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    paddingTop: 20,
  },
  logoutButton: {
    position: "absolute",
    right: 20,
    top: 20,
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
  },
  profileImageContainer: {
    position: "relative",
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: "#fff",
  },
  starBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#fff",
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  dogName: {
    fontSize: 28,
    fontWeight: "bold" as const,
    color: "#fff",
    marginTop: 15,
  },
  nameInput: {
    fontSize: 28,
    fontWeight: "bold" as const,
    color: "#fff",
    marginTop: 15,
    borderBottomWidth: 2,
    borderBottomColor: "rgba(255,255,255,0.5)",
    paddingHorizontal: 20,
    paddingBottom: 5,
    textAlign: "center",
  },
  ownerName: {
    fontSize: 16,
    color: "rgba(255,255,255,0.9)",
    marginTop: 5,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginTop: -15,
    borderRadius: 15,
    paddingVertical: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statBox: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold" as const,
    color: "#333",
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  infoSection: {
    backgroundColor: "#fff",
    margin: 20,
    padding: 20,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: "#333",
  },
  editSectionButton: {
    padding: 8,
    backgroundColor: "rgba(255, 107, 107, 0.1)",
    borderRadius: 20,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  infoLabel: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500" as const,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: "#333",
    flex: 2,
    textAlign: "right",
  },
  infoInput: {
    fontSize: 14,
    color: "#333",
    borderBottomWidth: 1,
    borderBottomColor: "#FF6B6B",
    paddingBottom: 2,
    flex: 2,
    textAlign: "right",
  },
  bioSection: {
    paddingTop: 20,
  },
  bioText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
    marginTop: 10,
  },
  bioInput: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#FF6B6B",
    borderRadius: 10,
    padding: 10,
    minHeight: 80,
    textAlignVertical: "top",
  },
  preferencesForm: {
    marginTop: 10,
  },
  behaviorForm: {
    marginTop: 10,
  },
  sliderSection: {
    marginVertical: 15,
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#333",
    marginBottom: 10,
  },
  ratingContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 10,
  },
  ratingButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#e0e0e0",
  },
  ratingButtonActive: {
    backgroundColor: "#FF6B6B",
    borderColor: "#FF6B6B",
  },
  ratingText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#666",
  },
  ratingTextActive: {
    color: "#fff",
  },
  preferenceItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  preferenceLabel: {
    fontSize: 14,
    color: "#666",
    flex: 1,
  },
  preferenceValue: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500" as const,
    flex: 2,
    textAlign: "right",
  },
  actionButtons: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 30,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#f0f0f0",
  },
  cancelButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600" as const,
  },
  saveButton: {
    backgroundColor: "#FF6B6B",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600" as const,
  },
  settingsForm: {
    marginTop: 10,
  },
  settingGroup: {
    marginBottom: 25,
  },
  settingGroupTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#333",
    marginBottom: 15,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  ageRangeContainer: {
    marginVertical: 15,
  },
  ageRangeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  ageRangeInput: {
    flex: 1,
    marginHorizontal: 5,
  },
  ageRangeLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 5,
  },
  ageInput: {
    borderWidth: 1,
    borderColor: "#FF6B6B",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    textAlign: "center",
  },
  errorContainer: {
    position: "absolute",
    bottom: -25,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  errorText: {
    fontSize: 12,
    color: "#FF6B6B",
    fontWeight: "500" as const,
  },
  previewButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    marginTop: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    gap: 8,
  },
  previewButtonText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#fff",
  },
  encouragementText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginBottom: 15,
    paddingHorizontal: 5,
    fontStyle: "italic" as const,
    textAlign: "center",
  },
});

const previewStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: "#333",
  },
  closeButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: "#FF6B6B",
    borderRadius: 20,
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600" as const,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginTop: 15,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  cardContainer: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  card: {
    width: screenWidth - 60,
    height: screenHeight * 0.55,
    borderRadius: 20,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
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
    height: 180,
  },
  cardInfo: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
  },
  cardName: {
    fontSize: 26,
    fontWeight: "bold" as const,
    color: "#fff",
  },
  cardBreed: {
    fontSize: 16,
    color: "#fff",
    opacity: 0.9,
    marginTop: 4,
  },
  cardDetails: {
    flexDirection: "row",
    marginTop: 8,
    gap: 15,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailText: {
    color: "#fff",
    fontSize: 13,
  },
  cardBio: {
    color: "#fff",
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
  },
  infoContainer: {
    backgroundColor: "#fff",
    margin: 20,
    padding: 20,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#333",
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginBottom: 8,
  },
});