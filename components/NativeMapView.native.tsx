import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MapPin, Navigation, Flag } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface NativeMapProps {
  currentLocation?: any;
  startLocation?: any;
  walkPath?: any[];
  walkStatus?: string;
}

export const NativeMapView: React.FC<NativeMapProps> = ({ currentLocation, startLocation, walkPath, walkStatus }) => {
  if (!currentLocation) {
    return (
      <View style={styles.mapPlaceholder}>
        <MapPin size={48} color="#666" />
        <Text style={styles.mapPlaceholderText}>Getting location...</Text>
      </View>
    );
  }

  // Since react-native-maps is not available in Expo Go,
  // we'll show a beautiful fallback with location info
  return (
    <LinearGradient
      colors={['#4ECDC4', '#44A08D']}
      style={styles.mapFallback}
    >
      <View style={styles.locationHeader}>
        <Navigation size={24} color="white" />
        <Text style={styles.locationTitle}>GPS Tracking Active</Text>
      </View>

      <View style={styles.coordinatesContainer}>
        <View style={styles.coordinateCard}>
          <Text style={styles.coordinateLabel}>Current Location</Text>
          <Text style={styles.coordinateValue}>
            {currentLocation.coords.latitude.toFixed(6)}°,
          </Text>
          <Text style={styles.coordinateValue}>
            {currentLocation.coords.longitude.toFixed(6)}°
          </Text>
        </View>

        {startLocation && (
          <View style={styles.coordinateCard}>
            <Text style={styles.coordinateLabel}>Start Point</Text>
            <Text style={styles.coordinateValue}>
              {startLocation.coords.latitude.toFixed(6)}°,
            </Text>
            <Text style={styles.coordinateValue}>
              {startLocation.coords.longitude.toFixed(6)}°
            </Text>
          </View>
        )}
      </View>

      {walkPath && walkPath.length > 0 && (
        <View style={styles.pathInfo}>
          <View style={styles.pathInfoItem}>
            <Flag size={20} color="white" />
            <Text style={styles.pathInfoText}>
              {walkPath.length} GPS points recorded
            </Text>
          </View>
        </View>
      )}

      <View style={styles.statusIndicator}>
        <View style={[styles.statusDot, { backgroundColor: walkStatus === 'active' ? '#4CAF50' : '#FFA726' }]} />
        <Text style={styles.statusText}>
          {walkStatus === 'active' ? 'Tracking your walk' : walkStatus === 'paused' ? 'Tracking paused' : 'Ready to track'}
        </Text>
      </View>

      <Text style={styles.mapNote}>
        Map view requires a custom development build.
        Your walk is being tracked with GPS.
      </Text>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    backgroundColor: '#E8E8E8',
  },
  mapPlaceholderText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
    textAlign: 'center' as const,
  },
  mapFallback: {
    flex: 1,
    padding: 20,
    justifyContent: 'center' as const,
  },
  locationHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 20,
  },
  locationTitle: {
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: 'white',
    marginLeft: 10,
  },
  coordinatesContainer: {
    flexDirection: 'row' as const,
    justifyContent: 'space-around' as const,
    marginBottom: 20,
  },
  coordinateCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center' as const,
    minWidth: 140,
  },
  coordinateLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 5,
  },
  coordinateValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: 'white',
  },
  pathInfo: {
    alignItems: 'center' as const,
    marginBottom: 20,
  },
  pathInfoItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
  },
  pathInfoText: {
    color: 'white',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500' as const,
  },
  statusIndicator: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 20,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '500' as const,
  },
  mapNote: {
    textAlign: 'center' as const,
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontStyle: 'italic' as const,
  },
});