/**
 * Web stub for @maplibre/maplibre-react-native.
 *
 * The package is native-only (it wraps the MapLibre Android/iOS SDKs), so the
 * Expo web build gets a placeholder. The real map runs on device; the browser
 * client is artifacts/pothole-reporter, which uses maplibre-gl directly.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const MapView = React.forwardRef(function MapView({ style, children }, _ref) {
  return React.createElement(
    View,
    { style: [styles.map, style] },
    React.createElement(
      View,
      { style: styles.overlay },
      React.createElement(Text, { style: styles.icon }, '🗺'),
      React.createElement(Text, { style: styles.title }, 'Map'),
      React.createElement(
        Text,
        { style: styles.sub },
        'Open this build on a device to see the live map.'
      )
    ),
    children
  );
});

MapView.displayName = 'MapView';

export { MapView };
export default MapView;

// No-op sub-components so imports resolve on web.
export const Camera = () => null;
export const MarkerView = ({ children }) => children ?? null;
export const PointAnnotation = ({ children }) => children ?? null;
export const ShapeSource = ({ children }) => children ?? null;
export const HeatmapLayer = () => null;
export const CircleLayer = () => null;
export const SymbolLayer = () => null;
export const UserLocation = () => null;
export const Images = () => null;

export const setAccessToken = () => {};

const styles = StyleSheet.create({
  map: { flex: 1, backgroundColor: '#e9eef3', alignItems: 'center', justifyContent: 'center' },
  overlay: { alignItems: 'center', padding: 24 },
  icon: { fontSize: 40, marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 4, color: '#0f172a' },
  sub: { fontSize: 13, textAlign: 'center', color: '#64748b', maxWidth: 260 },
});
