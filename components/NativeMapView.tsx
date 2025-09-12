import { Platform } from 'react-native';

let NativeMapView: any;

if (Platform.OS === 'web') {
  NativeMapView = require('./NativeMapView.web').NativeMapView;
} else {
  NativeMapView = require('./NativeMapView.native').NativeMapView;
}

export { NativeMapView };