import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Pressable,
  ActivityIndicator,
  Text,
  Platform,
  useColorScheme,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListPotholes,
  useConfirmPothole,
  type Pothole,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

// ─── Constants ────────────────────────────────────────────────────────────────

const SF_CENTER: Region = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.03,
  longitudeDelta: 0.03,
};

const PANEL_HEIGHT = 280;
const CONFIRM_RADIUS_M = 50;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function statusLabel(s: Pothole['status']): string {
  return s === 'in-progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Type ─────────────────────────────────────────────────────────────────────

type LatLng = { latitude: number; longitude: number };

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';

  const queryClient = useQueryClient();
  const { data: potholes = [], isLoading, refetch } = useListPotholes();

  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [selectedPothole, setSelectedPothole] = useState<Pothole | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const panelAnim = useRef(new Animated.Value(0)).current;
  const mapRef = useRef<MapView>(null);

  // ─── Location ──────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      if (Platform.OS === 'web') {
        if (!('geolocation' in navigator)) return;
        navigator.geolocation.getCurrentPosition(
          (pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          () => {}
        );
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setUserLocation(loc);
      mapRef.current?.animateToRegion({ ...loc, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 800);
    })();
  }, []);

  // ─── Panel animation ───────────────────────────────────────────────────────

  useEffect(() => {
    Animated.spring(panelAnim, {
      toValue: selectedPothole ? 1 : 0,
      useNativeDriver: true,
      damping: 18,
      stiffness: 200,
    }).start();
  }, [selectedPothole, panelAnim]);

  const fabBottom = panelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [insets.bottom + (Platform.OS === 'web' ? 50 : 16), PANEL_HEIGHT + (insets.bottom || 16) + 16],
  });

  // ─── Actions ───────────────────────────────────────────────────────────────

  const selectPothole = useCallback((p: Pothole) => {
    setSelectedPothole(p);
    Haptics.selectionAsync();
  }, []);

  const closePanel = useCallback(() => {
    setSelectedPothole(null);
  }, []);

  const confirmMutation = useConfirmPothole({
    mutation: {
      onSuccess: (updated) => {
        queryClient.invalidateQueries({ queryKey: ['/api/potholes'] });
        setSelectedPothole(updated);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
    },
  });

  const handleConfirm = useCallback(() => {
    if (!selectedPothole) return;
    confirmMutation.mutate({ id: selectedPothole.id });
  }, [selectedPothole, confirmMutation]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  }, [refetch]);

  const handleFABPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/report',
      params: userLocation
        ? { lat: userLocation.latitude, lng: userLocation.longitude }
        : {},
    });
  }, [userLocation]);

  // ─── Derived ───────────────────────────────────────────────────────────────

  const distanceToSelected =
    selectedPothole && userLocation
      ? haversine(userLocation.latitude, userLocation.longitude, selectedPothole.lat, selectedPothole.lng)
      : null;

  const canConfirm =
    !!selectedPothole &&
    selectedPothole.status !== 'fixed' &&
    !!userLocation &&
    distanceToSelected !== null &&
    distanceToSelected <= CONFIRM_RADIUS_M;

  function severityColor(severity: Pothole['severity']): string {
    if (severity === 'severe') return colors.severitySevere;
    if (severity === 'moderate') return colors.severityModerate;
    return colors.severityMinor;
  }

  function severityLabel(s: Pothole['severity']): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={SF_CENTER}
        showsUserLocation={Platform.OS !== 'web'}
        showsMyLocationButton={false}
        customMapStyle={isDark ? darkMapStyle : []}
      >
        {potholes.map((p) => (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            onPress={() => selectPothole(p)}
          >
            <View
              style={[
                styles.markerOuter,
                {
                  borderColor: severityColor(p.severity),
                  backgroundColor:
                    selectedPothole?.id === p.id
                      ? severityColor(p.severity)
                      : 'rgba(255,255,255,0.9)',
                },
              ]}
            >
              <View
                style={[
                  styles.markerInner,
                  { backgroundColor: severityColor(p.severity) },
                ]}
              />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Loading overlay */}
      {isLoading && (
        <View style={[styles.loadingOverlay, { backgroundColor: colors.background + 'cc' }]}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      )}

      {/* Header bar */}
      <View
        style={[
          styles.header,
          {
            top: insets.top + (Platform.OS === 'web' ? 67 : 0),
            backgroundColor: colors.card + 'ee',
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="road-variant" size={20} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>PatchWork</Text>
        </View>
        <Pressable
          onPress={handleRefresh}
          style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.6 }]}
        >
          {isRefreshing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="refresh" size={20} color={colors.foreground} />
          )}
        </Pressable>
      </View>

      {/* Legend */}
      <View
        style={[
          styles.legend,
          {
            top: insets.top + (Platform.OS === 'web' ? 67 : 0) + 56,
            backgroundColor: colors.card + 'ee',
            borderColor: colors.border,
          },
        ]}
      >
        {(['minor', 'moderate', 'severe'] as Pothole['severity'][]).map((s) => (
          <View key={s} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: severityColor(s) }]} />
            <Text style={[styles.legendText, { color: colors.mutedForeground }]}>
              {severityLabel(s)}
            </Text>
          </View>
        ))}
      </View>

      {/* Detail panel */}
      <Animated.View
        style={[
          styles.panel,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 8,
            transform: [
              {
                translateY: panelAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [PANEL_HEIGHT + 100, 0],
                }),
              },
            ],
          },
        ]}
        pointerEvents={selectedPothole ? 'auto' : 'none'}
      >
        {selectedPothole && (
          <>
            <View style={styles.panelHandle} />
            <View style={styles.panelHeader}>
              <View
                style={[
                  styles.severityBadge,
                  { backgroundColor: severityColor(selectedPothole.severity) + '22' },
                ]}
              >
                <View
                  style={[
                    styles.severityDot,
                    { backgroundColor: severityColor(selectedPothole.severity) },
                  ]}
                />
                <Text
                  style={[
                    styles.severityText,
                    { color: severityColor(selectedPothole.severity) },
                  ]}
                >
                  {severityLabel(selectedPothole.severity)}
                </Text>
              </View>
              <Pressable onPress={closePanel} style={styles.closeBtn} hitSlop={12}>
                <Ionicons name="close" size={18} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <Text style={[styles.panelStreet, { color: colors.foreground }]}>
              {selectedPothole.streetName}
            </Text>
            <Text style={[styles.panelNeighborhood, { color: colors.mutedForeground }]}>
              {selectedPothole.neighborhood} · {timeAgo(selectedPothole.createdAt)}
            </Text>

            <View style={styles.panelMeta}>
              <View style={styles.metaItem}>
                <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                <Text style={[styles.metaText, { color: colors.foreground }]}>
                  {selectedPothole.confirmations} confirmation
                  {selectedPothole.confirmations !== 1 ? 's' : ''}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={16} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {statusLabel(selectedPothole.status)}
                </Text>
              </View>
              {distanceToSelected !== null && (
                <View style={styles.metaItem}>
                  <Ionicons name="navigate-outline" size={16} color={colors.mutedForeground} />
                  <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                    {distanceToSelected < 1000
                      ? `${Math.round(distanceToSelected)}m away`
                      : `${(distanceToSelected / 1000).toFixed(1)}km away`}
                  </Text>
                </View>
              )}
            </View>

            {!userLocation && distanceToSelected === null && (
              <Text style={[styles.locationNote, { color: colors.mutedForeground }]}>
                Enable location to confirm reports nearby
              </Text>
            )}
            {userLocation && distanceToSelected !== null && distanceToSelected > CONFIRM_RADIUS_M && (
              <Text style={[styles.locationNote, { color: colors.mutedForeground }]}>
                You need to be within 50m to confirm
              </Text>
            )}

            <Pressable
              onPress={handleConfirm}
              disabled={!canConfirm || confirmMutation.isPending || selectedPothole.status === 'fixed'}
              style={({ pressed }) => [
                styles.confirmBtn,
                {
                  backgroundColor:
                    canConfirm && selectedPothole.status !== 'fixed'
                      ? colors.primary
                      : colors.muted,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              {confirmMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons
                    name={selectedPothole.status === 'fixed' ? 'checkmark-done' : 'checkmark'}
                    size={18}
                    color={canConfirm && selectedPothole.status !== 'fixed' ? '#fff' : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.confirmBtnText,
                      {
                        color:
                          canConfirm && selectedPothole.status !== 'fixed'
                            ? '#fff'
                            : colors.mutedForeground,
                      },
                    ]}
                  >
                    {selectedPothole.status === 'fixed' ? 'Already Fixed' : 'Confirm This Pothole'}
                  </Text>
                </>
              )}
            </Pressable>
          </>
        )}
      </Animated.View>

      {/* FAB */}
      <Animated.View style={[styles.fabWrapper, { bottom: fabBottom, right: 20 }]}>
        <Pressable
          onPress={handleFABPress}
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── Dark map style (matches dark background #020817) ─────────────────────────

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1a2035' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#748aab' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a2035' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d59563' }],
  },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c3a55' }] },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#3a5070' }],
  },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1f33' }] },
];

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },

  header: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.3,
  },
  refreshBtn: { padding: 4 },

  legend: {
    position: 'absolute',
    left: 16,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, fontFamily: 'Outfit_400Regular' },

  markerOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  markerInner: { width: 8, height: 8, borderRadius: 4 },

  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    minHeight: PANEL_HEIGHT,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  panelHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e2e8f0',
    alignSelf: 'center',
    marginBottom: 16,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  severityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  severityDot: { width: 8, height: 8, borderRadius: 4 },
  severityText: { fontSize: 13, fontWeight: '600' as const, fontFamily: 'Outfit_600SemiBold' },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  panelStreet: {
    fontSize: 22,
    fontWeight: '700' as const,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  panelNeighborhood: {
    fontSize: 14,
    fontFamily: 'Outfit_400Regular',
    marginBottom: 14,
  },
  panelMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 13, fontFamily: 'Outfit_400Regular' },
  locationNote: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
    marginBottom: 8,
    fontStyle: 'italic',
  },

  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    fontFamily: 'Outfit_600SemiBold',
  },

  fabWrapper: { position: 'absolute' },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ff751a',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
});
