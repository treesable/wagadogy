import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';

import {
  Send,
  ArrowLeft,
  Calendar,
  MapPin,
  Clock,
  Check,
  X,
  Plus,
} from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { Message, PresetMessage, WalkDetails, DogProfile } from '@/types/app';
import { trpc } from '@/lib/trpc';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  onConfirmWalk?: (walkId: string) => void;
}

function MessageBubble({ message, isOwn, onConfirmWalk }: MessageBubbleProps) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderWalkRequest = () => {
    if (!message.walkDetails) return null;

    const { walkDetails } = message;
    const isConfirmed = walkDetails.status === 'confirmed';
    const isPending = walkDetails.status === 'pending';

    return (
      <View style={styles.walkRequestContainer}>
        <View style={styles.walkHeader}>
          <Calendar size={16} color="#666" />
          <Text style={styles.walkTitle}>Walk Request</Text>
        </View>
        
        <View style={styles.walkDetails}>
          <View style={styles.walkDetailRow}>
            <Calendar size={14} color="#888" />
            <Text style={styles.walkDetailText}>{walkDetails.date}</Text>
          </View>
          <View style={styles.walkDetailRow}>
            <Clock size={14} color="#888" />
            <Text style={styles.walkDetailText}>{walkDetails.time}</Text>
          </View>
          <View style={styles.walkDetailRow}>
            <MapPin size={14} color="#888" />
            <Text style={styles.walkDetailText}>{walkDetails.location}</Text>
          </View>
        </View>

        {isPending && !isOwn && onConfirmWalk && (
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={() => onConfirmWalk(walkDetails.id)}
          >
            <Check size={16} color="#fff" />
            <Text style={styles.confirmButtonText}>Confirm Walk</Text>
          </TouchableOpacity>
        )}

        {isConfirmed && (
          <View style={styles.confirmedBadge}>
            <Check size={14} color="#4CAF50" />
            <Text style={styles.confirmedText}>Confirmed</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.messageBubble, isOwn ? styles.ownMessage : styles.otherMessage]}>
      <Text style={[styles.messageText, isOwn ? styles.ownMessageText : styles.otherMessageText]}>
        {message.text}
      </Text>
      
      {message.type === 'walk_request' && renderWalkRequest()}
      
      <Text style={[styles.messageTime, isOwn ? styles.ownMessageTime : styles.otherMessageTime]}>
        {formatTime(message.timestamp)}
      </Text>
    </View>
  );
}

interface WalkScheduleModalProps {
  visible: boolean;
  onClose: () => void;
  onSchedule: (walkDetails: Omit<WalkDetails, 'id' | 'status'>) => void;
}

function WalkScheduleModal({ visible, onClose, onSchedule }: WalkScheduleModalProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [tempDate, setTempDate] = useState(new Date());
  const [tempTime, setTempTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [mode, setMode] = useState<'date' | 'time'>('date');
  const [location, setLocation] = useState('');
  const [duration, setDuration] = useState('30 mins');
  const [notes, setNotes] = useState('');


  const formatDate = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString([], { 
        weekday: 'long', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const formatTime = (time: Date) => {
    return time.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const handleDateTimeChange = (event: any, selectedDateTime?: Date) => {
    console.log('DateTime picker change:', { event, selectedDateTime, mode });
    
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      setShowTimePicker(false);
      
      if (selectedDateTime && event.type !== 'dismissed') {
        if (mode === 'date') {
          setSelectedDate(selectedDateTime);
          console.log('Date updated:', selectedDateTime);
        } else if (mode === 'time') {
          setSelectedTime(selectedDateTime);
          console.log('Time updated:', selectedDateTime);
        }
      }
    } else if (Platform.OS === 'ios') {
      // On iOS, update the temporary value while user is scrolling
      if (selectedDateTime) {
        if (mode === 'date') {
          setTempDate(selectedDateTime);
        } else if (mode === 'time') {
          setTempTime(selectedDateTime);
        }
      }
      
      // Handle dismissal
      if (event.type === 'dismissed') {
        setShowDatePicker(false);
        setShowTimePicker(false);
        // Reset temp values to current selected values
        setTempDate(selectedDate);
        setTempTime(selectedTime);
      }
    }
  };

  const showDatePickerModal = () => {
    console.log('Opening date picker');
    setMode('date');
    setTempDate(selectedDate); // Initialize temp value
    setShowDatePicker(true);
  };

  const showTimePickerModal = () => {
    console.log('Opening time picker');
    setMode('time');
    setTempTime(selectedTime); // Initialize temp value
    setShowTimePicker(true);
  };

  const hidePickers = () => {
    console.log('Hiding pickers');
    setShowDatePicker(false);
    setShowTimePicker(false);
  };

  const confirmDateTimePicker = () => {
    console.log('Confirming picker selection');
    if (mode === 'date') {
      setSelectedDate(tempDate);
      console.log('Date confirmed:', tempDate);
    } else if (mode === 'time') {
      setSelectedTime(tempTime);
      console.log('Time confirmed:', tempTime);
    }
    hidePickers();
  };

  const handleSchedule = () => {
    if (!location) {
      Alert.alert('Missing Information', 'Please select a location');
      return;
    }

    const dateStr = formatDate(selectedDate);
    const timeStr = formatTime(selectedTime);

    onSchedule({ 
      date: dateStr, 
      time: timeStr, 
      location, 
      duration, 
      notes 
    });
    
    // Reset form
    const now = new Date();
    setSelectedDate(now);
    setSelectedTime(now);
    setTempDate(now);
    setTempTime(now);
    setLocation('');
    setDuration('30 mins');
    setNotes('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <X size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Schedule Walk</Text>
          <TouchableOpacity onPress={handleSchedule}>
            <Text style={styles.scheduleButton}>Schedule</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView 
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView 
            style={styles.modalContent}
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Date</Text>
            <TouchableOpacity
              style={styles.dateTimeButton}
              onPress={showDatePickerModal}
            >
              <Calendar size={20} color="#666" />
              <Text style={styles.dateTimeButtonText}>
                {formatDate(selectedDate)}
              </Text>
            </TouchableOpacity>
            
            {showDatePicker && (
              <View style={styles.pickerContainer}>
                <DateTimePicker
                  testID="dateTimePicker"
                  value={Platform.OS === 'ios' ? tempDate : selectedDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleDateTimeChange}
                  minimumDate={new Date()}
                  maximumDate={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)}
                  style={Platform.OS === 'ios' ? styles.iosPicker : undefined}
                />
                {Platform.OS === 'ios' && (
                  <View style={styles.pickerActions}>
                    <TouchableOpacity
                      style={[styles.pickerButton, styles.cancelPickerButton]}
                      onPress={hidePickers}
                    >
                      <Text style={styles.cancelPickerButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.pickerButton}
                      onPress={confirmDateTimePicker}
                    >
                      <Text style={styles.pickerButtonText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Time</Text>
            <TouchableOpacity
              style={styles.dateTimeButton}
              onPress={showTimePickerModal}
            >
              <Clock size={20} color="#666" />
              <Text style={styles.dateTimeButtonText}>
                {formatTime(selectedTime)}
              </Text>
            </TouchableOpacity>
            
            {showTimePicker && (
              <View style={styles.pickerContainer}>
                <DateTimePicker
                  testID="timeTimePicker"
                  value={Platform.OS === 'ios' ? tempTime : selectedTime}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleDateTimeChange}
                  style={Platform.OS === 'ios' ? styles.iosPicker : undefined}
                />
                {Platform.OS === 'ios' && (
                  <View style={styles.pickerActions}>
                    <TouchableOpacity
                      style={[styles.pickerButton, styles.cancelPickerButton]}
                      onPress={hidePickers}
                    >
                      <Text style={styles.cancelPickerButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.pickerButton}
                      onPress={confirmDateTimePicker}
                    >
                      <Text style={styles.pickerButtonText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Location</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="Enter walk location (e.g., Central Park, Dog Park, etc.)"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Duration</Text>
            <View style={styles.durationOptions}>
              {['30 mins', '1 hour', '1.5 hours', '2 hours'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.durationOption,
                    duration === option && styles.selectedDuration,
                  ]}
                  onPress={() => setDuration(option)}
                >
                  <Text
                    style={[
                      styles.durationText,
                      duration === option && styles.selectedDurationText,
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Notes (Optional)</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any special notes or preferences..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
            />
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

interface HeaderMatch {
  id: string;
  name: string;
  ownerName?: string;
  photos: string[];
}

export default function ChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const {
    getConversation,
    loadConversationById,
    markAsRead,
    matches,
    userProfile,
    presetMessages,
    confirmWalk,
    scheduleWalk,
  } = useApp();
  
  const [inputText, setInputText] = useState<string>('');
  const [showPresets, setShowPresets] = useState<boolean>(false);
  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);
  const [headerMatch, setHeaderMatch] = useState<HeaderMatch | null>(null);
  const [loadingHeader, setLoadingHeader] = useState<boolean>(false);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  
  // Use tRPC queries for real-time data
  const messagesQuery = trpc.conversations.getMessages.useQuery(
    { conversationId: conversationId! },
    { 
      enabled: !!conversationId,
      refetchInterval: 2000, // Refetch every 2 seconds as fallback
      refetchOnWindowFocus: true,
    }
  );
  
  const sendMessageMutation = trpc.conversations.sendMessage.useMutation({
    onSuccess: () => {
      // Invalidate and refetch messages after successful send
      messagesQuery.refetch();
    },
    onError: (error) => {
      console.error('[Chat] Send message error:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    },
  });
  
  const conversation = getConversation(conversationId!);
  const matchFromContext: DogProfile | undefined = useMemo(() => {
    return conversation ? matches.find(m => m.id === conversation.matchId) : undefined;
  }, [matches, conversation]);
  
  // Get messages from tRPC query, fallback to local conversation
  const messages = useMemo(() => {
    if (messagesQuery.data?.messages) {
      return messagesQuery.data.messages.map((m: any) => ({
        id: m.id?.toString(),
        senderId: (m.sender_id ?? m.user_id ?? '').toString(),
        text: (m.content ?? m.text ?? ''),
        timestamp: new Date(m.created_at ?? new Date().toISOString()),
        type: ((m.message_type as Message['type']) ?? (m.type as Message['type']) ?? 'text'),
        walkDetails: m.walk_details ?? undefined,
      }));
    }
    return conversation?.messages || [];
  }, [messagesQuery.data?.messages, conversation?.messages]);

  useEffect(() => {
    if (!conversationId) return;
    
    console.log('[Chat] Effect triggered for conversation:', conversationId);
    console.log('[Chat] Current conversation exists:', !!conversation);
    console.log('[Chat] Current messages count:', messages?.length || 0);
    
    if (!conversation || (conversation.messages?.length ?? 0) === 0) {
      console.log('[Chat] Conversation not in memory or empty, loading by id', conversationId);
      loadConversationById(conversationId);
    }
  }, [conversationId, conversation?.id, conversation?.messages?.length, loadConversationById, messages?.length, conversation]);

  // Update header when tRPC data is available
  useEffect(() => {
    if (matchFromContext) {
      setHeaderMatch({ 
        id: matchFromContext.id, 
        name: matchFromContext.name, 
        ownerName: matchFromContext.ownerName, 
        photos: matchFromContext.photos 
      });
      setLoadingHeader(false);
      setHeaderError(null);
    } else if (messagesQuery.data?.dogProfile) {
      const dogProfile = messagesQuery.data.dogProfile;
      setHeaderMatch({
        id: dogProfile.id,
        name: dogProfile.name,
        ownerName: dogProfile.ownerName,
        photos: dogProfile.photos.length > 0 ? dogProfile.photos : ['https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800']
      });
      setLoadingHeader(false);
      setHeaderError(null);
      console.log('[Chat] Header loaded from tRPC:', { dogName: dogProfile.name, ownerName: dogProfile.ownerName, photoCount: dogProfile.photos.length });
    } else if (messagesQuery.isLoading) {
      setLoadingHeader(true);
      setHeaderError(null);
    } else if (messagesQuery.error) {
      setLoadingHeader(false);
      setHeaderError('Failed to load dog profile');
      console.error('[Chat] Error loading dog profile from tRPC:', messagesQuery.error);
    }
  }, [matchFromContext, messagesQuery.data?.dogProfile, messagesQuery.isLoading, messagesQuery.error]);

  useEffect(() => {
    if (conversation && conversation.unreadCount > 0) {
      markAsRead(conversationId!);
    }
  }, [conversation, conversationId, markAsRead]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (messages.length) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !conversationId || sendMessageMutation.isPending) return;

    try {
      console.log('[Chat] Sending message to conversation:', conversationId);
      console.log('[Chat] Current conversation exists:', !!conversation);
      console.log('[Chat] Conversation match ID:', conversation?.matchId);
      
      await sendMessageMutation.mutateAsync({
        conversationId,
        content: inputText.trim(),
        messageType: 'text',
      });

      setInputText('');
      setShowPresets(false);
    } catch (error) {
      console.error('[Chat] Error sending message:', error);
      // Error is handled in the mutation's onError callback
    }
  };

  const handlePresetMessage = async (preset: PresetMessage) => {
    if (!conversationId || sendMessageMutation.isPending) return;

    try {
      await sendMessageMutation.mutateAsync({
        conversationId,
        content: preset.text,
        messageType: 'preset',
      });
      setShowPresets(false);
    } catch (error) {
      console.error('[Chat] Error sending preset message:', error);
    }
  };

  const handleScheduleWalk = (walkDetails: Omit<WalkDetails, 'id' | 'status'>) => {
    if (!conversationId) return;
    scheduleWalk(conversationId, walkDetails);
  };

  const handleConfirmWalk = (walkId: string) => {
    if (!conversationId) return;
    confirmWalk(conversationId, walkId);
  };

  const handleRefresh = async () => {
    if (!conversationId) return;
    try {
      console.log('[Chat] Manual refresh triggered for:', conversationId);
      await Promise.all([
        messagesQuery.refetch(),
        loadConversationById(conversationId)
      ]);
    } catch (error) {
      console.error('[Chat] Error during refresh:', error);
    }
  };



  if (!conversation) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Conversation not found</Text>
        <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#FF6B6B', borderRadius: 10 }}
            testID="chat-go-back"
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' as const }}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const header = headerMatch ?? (matchFromContext ? { id: matchFromContext.id, name: matchFromContext.name, ownerName: matchFromContext.ownerName, photos: matchFromContext.photos } : null);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerLeft: () => (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <ArrowLeft size={24} color="#333" />
            </TouchableOpacity>
          ),
          headerTitle: () => (
            <View style={styles.headerTitle}>
              <Image source={{ uri: header?.photos?.[0] ?? 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=200' }} style={styles.headerAvatar} />
              <View>
                <Text style={styles.headerName}>{header?.name ?? 'Chat'}</Text>
                <Text style={styles.headerOwner}>{header?.ownerName ?? (loadingHeader ? 'Loading…' : headerError ? '—' : '')}</Text>
              </View>
            </View>
          ),
          headerStyle: {
            backgroundColor: '#fff',
          },
        }}
      />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >

        
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          contentContainerStyle={[styles.messagesContent, messages.length === 0 && styles.emptyMessagesContent]}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              isOwn={item.senderId === userProfile.id}
              onConfirmWalk={handleConfirmWalk}
            />
          )}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          refreshing={false}
          onRefresh={handleRefresh}
          ListEmptyComponent={() => {
            // Only show empty state when we're sure there are no messages
            // Don't show loading spinner to avoid screen distortion
            if (!messagesQuery.isLoading || messagesQuery.data) {
              return (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No messages yet</Text>
                  <Text style={styles.emptySubtext}>Start the conversation!</Text>
                </View>
              );
            }
            // Return null during initial loading to avoid layout shifts
            return null;
          }}
        />

        {showPresets && (
          <View style={styles.presetsContainer}>
            <FlatList
              data={presetMessages}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.presetsContent}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.presetButton}
                  onPress={() => handlePresetMessage(item)}
                >
                  <Text style={styles.presetText}>{item.text}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        <View style={styles.inputContainer}>
          <View style={styles.inputRow}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowPresets(!showPresets)}
            >
              <Plus size={20} color={showPresets ? '#FF6B6B' : '#666'} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowScheduleModal(true)}
            >
              <Calendar size={20} color="#666" />
            </TouchableOpacity>

            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type a message..."
              placeholderTextColor="#999"
              multiline
              maxLength={500}
              onSubmitEditing={handleSendMessage}
              blurOnSubmit={false}
              testID="chat-input"
            />

            <TouchableOpacity
              style={[
                styles.sendButton,
                inputText.trim() && !sendMessageMutation.isPending ? styles.sendButtonActive : styles.sendButtonInactive,
              ]}
              onPress={handleSendMessage}
              disabled={!inputText.trim() || sendMessageMutation.isPending}
            testID="chat-send"
            >
              <Send size={20} color={inputText.trim() && !sendMessageMutation.isPending ? '#fff' : '#999'} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <WalkScheduleModal
        visible={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onSchedule={handleScheduleWalk}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  keyboardContainer: {
    flex: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#333',
  },
  headerOwner: {
    fontSize: 12,
    color: '#666',
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageBubble: {
    maxWidth: '80%',
    marginVertical: 4,
    padding: 12,
    borderRadius: 18,
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#FF6B6B',
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e1e5e9',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  ownMessageTime: {
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'right',
  },
  otherMessageTime: {
    color: '#999',
  },
  walkRequestContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  walkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  walkTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  walkDetails: {
    gap: 4,
  },
  walkDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  walkDetailText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    padding: 8,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  confirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  confirmedText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  presetsContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e1e5e9',
    paddingVertical: 12,
  },
  presetsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  presetButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f1f3f4',
    borderRadius: 20,
    marginRight: 8,
  },
  presetText: {
    fontSize: 14,
    color: '#333',
  },
  inputContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e1e5e9',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f3f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    minHeight: 36,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f1f3f4',
    borderRadius: 18,
    fontSize: 16,
    color: '#333',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: {
    backgroundColor: '#FF6B6B',
  },
  sendButtonInactive: {
    backgroundColor: '#f1f3f4',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#333',
  },
  scheduleButton: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FF6B6B',
  },
  modalContent: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f8f9fa',
  },
  durationOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  durationOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e1e5e9',
    backgroundColor: '#f8f9fa',
  },
  selectedDuration: {
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
  },
  durationText: {
    fontSize: 14,
    color: '#666',
  },
  selectedDurationText: {
    color: '#fff',
  },

  notesInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#f8f9fa',
    gap: 12,
  },
  dateTimeButtonText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  pickerContainer: {
    marginTop: 8,
  },
  iosPicker: {
    height: 200,
  },
  pickerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    gap: 12,
  },
  pickerButton: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#FF6B6B',
    borderRadius: 8,
    alignItems: 'center',
  },
  pickerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  cancelPickerButton: {
    backgroundColor: '#f1f3f4',
  },
  cancelPickerButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 50,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
  subtleLoadingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    gap: 4,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF6B6B',
    opacity: 0.4,
  },
  loadingDotDelay1: {
    opacity: 0.7,
  },
  loadingDotDelay2: {
    opacity: 1,
  },
  loadingText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  emptyMessagesContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});