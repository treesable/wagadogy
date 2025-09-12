export interface DogProfile {
  id: string;
  name: string;
  age: string;
  breed: string;
  size: "Small" | "Medium" | "Large";
  photos: string[];
  bio: string;
  distance: string;
  ownerName: string;
  ownerId?: string;
  energyLevel?: number;
}

export interface DogProfileData {
  id?: string;
  name: string;
  breed: string;
  age: number;
  size: "Small" | "Medium" | "Large";
  weight?: number;
  gender: "Male" | "Female";
  isNeutered: boolean;
  bio: string;
  personalityTraits: string[];
  energyLevel: number; // 1-5
  friendlinessLevel: number; // 1-5
  trainingLevel: number; // 1-5
  healthNotes?: string;
  vaccinationStatus: boolean;
  vaccinationDate?: string;
  isPrimary: boolean;
  isActive: boolean;
  photos: DogPhoto[];
  ownerId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DogPhoto {
  id?: string;
  dogId?: string;
  photoUrl: string;
  isPrimary: boolean;
  orderIndex: number;
  createdAt?: string;
  // For local state management
  isUploading?: boolean;
  uploadProgress?: number;
  localUri?: string; // Original local URI before upload
  compressed?: boolean;
}

export interface UserProfile {
  id: string;
  // User profile fields (from user_profiles table)
  email: string;
  fullName?: string;
  avatarUrl?: string;
  phone?: string;
  dateOfBirth?: string;
  location?: { lat: number; lng: number };
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  bio?: string;
  preferences: UserPreferences;
  userSettings?: UserSettings; // Database settings
  isActive: boolean;
  lastSeen?: string;
  // Multiple dog profiles
  dogProfiles: DogProfileData[];
  activeDogId?: string; // Currently selected dog for display
  // Legacy fields for backward compatibility (derived from active dog)
  dogName: string;
  dogPhoto: string;
  breed: string;
  age: number;
  size: "Small" | "Medium" | "Large";
  weight?: number;
  gender: "Male" | "Female";
  isNeutered: boolean;
  dogBio: string;
  personalityTraits: string[];
  energyLevel: number; // 1-5
  friendlinessLevel: number; // 1-5
  trainingLevel: number; // 1-5
  healthNotes?: string;
  vaccinationStatus: boolean;
  vaccinationDate?: string;
  isPrimary: boolean;
  dogIsActive: boolean;
  ownerName?: string;
  displayName?: string;
}

export interface UserPreferences {
  // Legacy preferences for app functionality
  lookingFor: "Playdates" | "Friends" | "Walking Partners" | "All";
  preferredSize: "Small" | "Medium" | "Large" | "All sizes";
  maxDistance: 1 | 3 | 5 | 10 | 25;
  ageRange: "Puppy (0-1)" | "Young (1-3)" | "Adult (3-7)" | "Senior (7+)" | "All ages";
  activityLevel: "Low" | "Moderate" | "High" | "Very High";
  playStyle: "Gentle" | "Moderate" | "Rough" | "All styles";
  availableTimes: string[];
}

// Database schema for user_settings table (matches Supabase schema exactly)
export interface UserSettings {
  id?: string;
  userId: string; // user_id in database
  distancePreference: number; // distance_preference in database, km, default 25
  ageRangeMin: number; // age_range_min in database, default 1
  ageRangeMax: number; // age_range_max in database, default 15
  sizePreferences: string[]; // size_preferences in database, ['Small', 'Medium', 'Large']
  notificationPreferences: {
    matches: boolean;
    messages: boolean;
    walkReminders: boolean; // walk_reminders in database
  };
  privacySettings: {
    showLocation: boolean; // show_location in database
    showLastSeen: boolean; // show_last_seen in database
  };
  createdAt?: string; // created_at in database
  updatedAt?: string; // updated_at in database
}

// Database row interface for user_settings (snake_case as stored in DB)
export interface UserSettingsRow {
  id?: string;
  user_id: string;
  distance_preference: number;
  age_range_min: number;
  age_range_max: number;
  size_preferences: string[];
  notification_preferences: {
    matches: boolean;
    messages: boolean;
    walk_reminders: boolean;
  };
  privacy_settings: {
    show_location: boolean;
    show_last_seen: boolean;
  };
  created_at?: string;
  updated_at?: string;
}

export interface WalkingStats {
  todayMinutes: number;
  todayDistance: number;
  weeklyMinutes: number;
  weeklyDistance: number;
  totalWalks: number;
  streak: number;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: Date;
  type: 'text' | 'preset' | 'walk_request' | 'walk_confirmation';
  walkDetails?: WalkDetails;
}

export interface WalkDetails {
  id: string;
  date: string;
  time: string;
  location: string;
  duration: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  partnerId?: string;
  partnerName?: string;
  partnerDogName?: string;
  partnerPhoto?: string;
  notes?: string;
  reminderSent?: boolean;
}

export interface ScheduledWalk {
  id: string;
  date: string;
  time: string;
  location: string;
  duration: string;
  partnerId: string;
  partnerName: string;
  partnerDogName: string;
  partnerPhoto: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  notes?: string;
  conversationId: string;
  createdAt: Date;
  reminderSent: boolean;
}

export interface Conversation {
  id: string;
  matchId: string;
  messages: Message[];
  lastMessage?: Message;
  unreadCount: number;
}

export interface PresetMessage {
  id: string;
  text: string;
  category: 'greeting' | 'walk_request' | 'scheduling' | 'casual';
}