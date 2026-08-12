/**
 * Web stub for react-native-maps.
 * The real map runs in Expo Go on device. On web (preview), show a placeholder.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = null;

const MapView = React.forwardRef(function MapView({ style, children }, _ref) {
  return React.createElement(
    View,
    { style: [styles.map, style] },
    React.createElement(
      View,
      { style: styles.overlay },
      React.createElement(Text, { style: styles.icon }, '🗺'),
      React.createElement(Text, { style: styles.title }, 'Map'),
      React.createElement(Text, { style: styles.sub }, 'Scan the QR code in Expo Go to see the live map on your device.')
    ),
    children
  );
});

MapView.displayName = 'MapView';

export default MapView;

// No-op sub-components
export const Marker = () => null;
Marker.displayName = 'Marker';

export const Callout = () => null;
export const Polyline = () => null;
export const Polygon = () => null;
export const Circle = () => null;
export const Heatmap = () => null;
export const UrlTile = () => null;
export const Overlay = () => null;

const styles = StyleSheet.create({
  map: {
    flex: 1,
    backgroundColor: '#d4e4bc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    padding: 24,
    maxWidth: 280,
  },
  icon: { fontSize: 40 },
  title: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  sub: { fontSize: 13, color: '#666', textAlign: 'center', lineHeight: 18 },
});
