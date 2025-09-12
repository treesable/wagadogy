import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MapPin } from 'lucide-react-native';

interface NativeMapProps {
  currentLocation?: any;
  startLocation?: any;
  walkPath?: any[];
  walkStatus?: string;
}

export const NativeMapView: React.FC<NativeMapProps> = ({ currentLocation, startLocation, walkPath, walkStatus }) => {
  return (
    <View style={styles.mapPlaceholder}>
      <MapPin size={48} color="#666" />
      <Text style={styles.mapPlaceholderText}>Map view available on mobile</Text>
      {currentLocation && (
        <View style={styles.webLocationInfo}>
          <Text style={styles.webLocationText}>
            📍 Lat: {currentLocation.coords.latitude.toFixed(6)}
          </Text>
          <Text style={styles.webLocationText}>
            📍 Lng: {currentLocation.coords.longitude.toFixed(6)}
          </Text>
          {startLocation && (
            <Text style={styles.webLocationText}>
              🏁 Start: {startLocation.coords.latitude.toFixed(6)}, {startLocation.coords.longitude.toFixed(6)}
            </Text>
          )}
          {walkPath && walkPath.length > 0 && (
            <Text style={styles.webLocationText}>
              🛤️ Path points: {walkPath.length}
            </Text>
          )}
          {walkStatus && (
            <Text style={styles.webLocationText}>
              📊 Status: {walkStatus}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E8E8E8',
  },
  mapPlaceholderText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  webLocationInfo: {
    marginTop: 20,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    alignItems: 'center',
  },
  webLocationText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
});