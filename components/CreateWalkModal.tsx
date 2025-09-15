import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  X,
  Plus,
  Check,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { trpc } from '@/lib/trpc';

interface CreateWalkModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (schedule: any) => void;
  partnerId?: string;
  conversationId?: string;
}

export default function CreateWalkModal({
  visible,
  onClose,
  onSuccess,
  partnerId,
  conversationId,
}: CreateWalkModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    scheduled_date: '',
    scheduled_time: '',
    duration_minutes: 30,
    location_name: '',
    location_address: '',
    max_participants: 2,
    is_group_walk: false,
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createScheduleMutation = trpc.walks.createSchedule.useMutation({
    onSuccess: (data) => {
      console.log('[CreateWalkModal] Schedule created successfully:', data);
      Alert.alert('Success', 'Walk scheduled successfully!');
      onSuccess?.(data);
      resetForm();
      onClose();
    },
    onError: (error) => {
      console.error('[CreateWalkModal] Error creating schedule:', error);
      Alert.alert('Error', error.message || 'Failed to create walk schedule');
      setIsSubmitting(false);
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      scheduled_date: '',
      scheduled_time: '',
      duration_minutes: 30,
      location_name: '',
      location_address: '',
      max_participants: 2,
      is_group_walk: false,
      notes: '',
    });
    setErrors({});
    setIsSubmitting(false);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.scheduled_date) {
      newErrors.scheduled_date = 'Date is required';
    } else {
      const selectedDate = new Date(formData.scheduled_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        newErrors.scheduled_date = 'Date cannot be in the past';
      }
    }

    if (!formData.scheduled_time) {
      newErrors.scheduled_time = 'Time is required';
    }

    if (!formData.location_name.trim()) {
      newErrors.location_name = 'Location is required';
    }

    if (formData.duration_minutes < 15 || formData.duration_minutes > 300) {
      newErrors.duration_minutes = 'Duration must be between 15 and 300 minutes';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await createScheduleMutation.mutateAsync({
        ...formData,
        partner_id: partnerId,
        conversation_id: conversationId,
      });
    } catch (error) {
      console.error('[CreateWalkModal] Submit error:', error);
    }
  };

  const handleClose = () => {
    if (isSubmitting) {
      return;
    }
    resetForm();
    onClose();
  };

  const formatDateForInput = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  };

  const formatTimeForInput = (timeString: string) => {
    if (!timeString) return '';
    return timeString;
  };

  const generateSuggestedTimes = () => {
    const times = [];
    const now = new Date();
    const currentHour = now.getHours();
    
    // Suggest times starting from next hour
    for (let i = 1; i <= 12; i++) {
      const hour = (currentHour + i) % 24;
      const timeString = `${hour.toString().padStart(2, '0')}:00`;
      const displayTime = new Date(`2000-01-01T${timeString}`).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      times.push({ value: timeString, display: displayTime });
    }
    
    return times;
  };

  const suggestedTimes = generateSuggestedTimes();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            disabled={isSubmitting}
          >
            <X size={24} color="#666" />
          </TouchableOpacity>
          <Text style={styles.title}>Schedule a Walk</Text>
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Text style={styles.submitButtonText}>Creating...</Text>
            ) : (
              <>
                <Check size={20} color="#fff" />
                <Text style={styles.submitButtonText}>Create</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Walk Details</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={[styles.input, errors.title && styles.inputError]}
                value={formData.title}
                onChangeText={(text) => setFormData({ ...formData, title: text })}
                placeholder="e.g., Morning walk in Central Park"
                placeholderTextColor="#999"
                editable={!isSubmitting}
              />
              {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="Optional description..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
                editable={!isSubmitting}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>When</Text>
            
            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={styles.label}>Date *</Text>
                <TextInput
                  style={[styles.input, errors.scheduled_date && styles.inputError]}
                  value={formatDateForInput(formData.scheduled_date)}
                  onChangeText={(text) => setFormData({ ...formData, scheduled_date: text })}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#999"
                  editable={!isSubmitting}
                />
                {errors.scheduled_date && <Text style={styles.errorText}>{errors.scheduled_date}</Text>}
              </View>
              
              <View style={[styles.inputGroup, styles.flex1, styles.marginLeft]}>
                <Text style={styles.label}>Time *</Text>
                <TextInput
                  style={[styles.input, errors.scheduled_time && styles.inputError]}
                  value={formatTimeForInput(formData.scheduled_time)}
                  onChangeText={(text) => setFormData({ ...formData, scheduled_time: text })}
                  placeholder="HH:MM"
                  placeholderTextColor="#999"
                  editable={!isSubmitting}
                />
                {errors.scheduled_time && <Text style={styles.errorText}>{errors.scheduled_time}</Text>}
              </View>
            </View>

            <View style={styles.suggestedTimes}>
              <Text style={styles.suggestedLabel}>Suggested times:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.timeChips}>
                  {suggestedTimes.slice(0, 6).map((time, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.timeChip,
                        formData.scheduled_time === time.value && styles.timeChipSelected,
                      ]}
                      onPress={() => setFormData({ ...formData, scheduled_time: time.value })}
                      disabled={isSubmitting}
                    >
                      <Text
                        style={[
                          styles.timeChipText,
                          formData.scheduled_time === time.value && styles.timeChipTextSelected,
                        ]}
                      >
                        {time.display}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Duration (minutes)</Text>
              <View style={styles.durationContainer}>
                {[15, 30, 45, 60, 90, 120].map((duration) => (
                  <TouchableOpacity
                    key={duration}
                    style={[
                      styles.durationChip,
                      formData.duration_minutes === duration && styles.durationChipSelected,
                    ]}
                    onPress={() => setFormData({ ...formData, duration_minutes: duration })}
                    disabled={isSubmitting}
                  >
                    <Text
                      style={[
                        styles.durationChipText,
                        formData.duration_minutes === duration && styles.durationChipTextSelected,
                      ]}
                    >
                      {duration}m
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {errors.duration_minutes && <Text style={styles.errorText}>{errors.duration_minutes}</Text>}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Where</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Location Name *</Text>
              <TextInput
                style={[styles.input, errors.location_name && styles.inputError]}
                value={formData.location_name}
                onChangeText={(text) => setFormData({ ...formData, location_name: text })}
                placeholder="e.g., Central Park, Dog Park"
                placeholderTextColor="#999"
                editable={!isSubmitting}
              />
              {errors.location_name && <Text style={styles.errorText}>{errors.location_name}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Address (Optional)</Text>
              <TextInput
                style={styles.input}
                value={formData.location_address}
                onChangeText={(text) => setFormData({ ...formData, location_address: text })}
                placeholder="Full address for easier navigation"
                placeholderTextColor="#999"
                editable={!isSubmitting}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Options</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.notes}
                onChangeText={(text) => setFormData({ ...formData, notes: text })}
                placeholder="Any special instructions or notes..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={2}
                editable={!isSubmitting}
              />
            </View>

            <TouchableOpacity
              style={styles.toggleOption}
              onPress={() => setFormData({ ...formData, is_group_walk: !formData.is_group_walk })}
              disabled={isSubmitting}
            >
              <View style={styles.toggleLeft}>
                <Users size={20} color="#666" />
                <Text style={styles.toggleLabel}>Group Walk</Text>
                <Text style={styles.toggleDescription}>Allow more than 2 participants</Text>
              </View>
              <View style={[styles.toggle, formData.is_group_walk && styles.toggleActive]}>
                {formData.is_group_walk && <View style={styles.toggleDot} />}
              </View>
            </TouchableOpacity>

            {formData.is_group_walk && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Max Participants</Text>
                <View style={styles.participantContainer}>
                  {[2, 3, 4, 5, 6, 8, 10].map((count) => (
                    <TouchableOpacity
                      key={count}
                      style={[
                        styles.participantChip,
                        formData.max_participants === count && styles.participantChipSelected,
                      ]}
                      onPress={() => setFormData({ ...formData, max_participants: count })}
                      disabled={isSubmitting}
                    >
                      <Text
                        style={[
                          styles.participantChipText,
                          formData.max_participants === count && styles.participantChipTextSelected,
                        ]}
                      >
                        {count}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>

          <View style={styles.bottomPadding} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#333',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 20,
    padding: 20,
    borderRadius: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#333',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#FF5722',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 12,
    color: '#FF5722',
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
  },
  flex1: {
    flex: 1,
  },
  marginLeft: {
    marginLeft: 12,
  },
  suggestedTimes: {
    marginBottom: 16,
  },
  suggestedLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  timeChips: {
    flexDirection: 'row',
    gap: 8,
  },
  timeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  timeChipSelected: {
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
  },
  timeChipText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500' as const,
  },
  timeChipTextSelected: {
    color: '#fff',
  },
  durationContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  durationChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  durationChipSelected: {
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
  },
  durationChipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500' as const,
  },
  durationChipTextSelected: {
    color: '#fff',
  },
  toggleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  toggleLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: '#333',
  },
  toggleDescription: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: '#FF6B6B',
    alignItems: 'flex-end',
  },
  toggleDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
  },
  participantContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  participantChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minWidth: 44,
    alignItems: 'center',
  },
  participantChipSelected: {
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
  },
  participantChipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500' as const,
  },
  participantChipTextSelected: {
    color: '#fff',
  },
  bottomPadding: {
    height: 40,
  },
});