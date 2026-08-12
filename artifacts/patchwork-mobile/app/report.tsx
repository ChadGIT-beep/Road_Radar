import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCreatePothole,
  useListPotholes,
  type Pothole,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = 'minor' | 'moderate' | 'severe';

type LatLng = { latitude: number; longitude: number };

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

// ─── Severity config ─────────────────────────────────────────────────────────

const SEVERITIES: { value: Severity; label: string; description: string; color: string }[] = [
  { value: 'minor', label: 'Minor', description: 'Small crack or bump', color: '#f59e0b' },
  { value: 'moderate', label: 'Moderate', description: 'Notable damage, slow down', color: '#ff751a' },
  { value: 'severe', label: 'Severe', description: 'Dangerous, avoid if possible', color: '#ef4444' },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ReportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  // Params passed from map screen (user's location at time of tap)
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();

  const [location, setLocation] = useState<LatLng | null>(
    params.lat && params.lng
      ? { latitude: Number(params.lat), longitude: Number(params.lng) }
      : null
  );
  const [locLoading, setLocLoading] = useState(!params.lat);
  const [streetName, setStreetName] = useState('Unknown Street');
  const [neighborhood, setNeighborhood] = useState('Unknown Area');
  const [severity, setSeverity] = useState<Severity>('moderate');
  const [notes, setNotes] = useState('');

  const { data: potholes = [] } = useListPotholes();

  // ─── Nearby duplicate ────────────────────────────────────────────────────────

  const nearbyPothole: Pothole | undefined = location
    ? potholes.find(
        (p) =>
          p.status !== 'fixed' &&
          haversine(location.latitude, location.longitude, p.lat, p.lng) <= 50
      )
    : undefined;

  // ─── Location + reverse geocode ──────────────────────────────────────────────

  useEffect(() => {
    if (location) {
      reverseGeocode(location);
      return;
    }
    setLocLoading(true);
    (async () => {
      try {
        let loc: LatLng | null = null;
        if (Platform.OS === 'web') {
          if ('geolocation' in navigator) {
            loc = await new Promise<LatLng | null>((resolve) =>
              navigator.geolocation.getCurrentPosition(
                (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
                () => resolve(null)
              )
            );
          }
        } else {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const pos = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          }
        }
        if (loc) {
          setLocation(loc);
          await reverseGeocode(loc);
        }
      } finally {
        setLocLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function reverseGeocode(loc: LatLng) {
    if (Platform.OS === 'web') return;
    try {
      const results = await Location.reverseGeocodeAsync(loc);
      if (results[0]) {
        const r = results[0];
        setStreetName([r.streetNumber, r.street].filter(Boolean).join(' ') || 'Unknown Street');
        setNeighborhood(r.subregion || r.district || r.city || 'Unknown Area');
      }
    } catch {
      // Ignore geocoding errors
    }
  }

  // ─── Submission ──────────────────────────────────────────────────────────────

  const createMutation = useCreatePothole({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/potholes'] });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
      },
    },
  });

  function handleSubmit() {
    if (!location) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    createMutation.mutate({
      data: {
        lat: location.latitude,
        lng: location.longitude,
        severity,
        notes: notes.trim() || undefined,
        streetName,
        neighborhood,
      },
    });
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  const bottomPad = insets.bottom + (Platform.OS === 'web' ? 34 : 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Drag handle */}
      <View style={[styles.handle, { backgroundColor: colors.border }]} />

      {/* Title row */}
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: colors.foreground }]}>Report a Pothole</Text>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        >
          <Ionicons name="close" size={22} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 100 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Nearby duplicate warning */}
        {nearbyPothole && (
          <View style={[styles.warningCard, { backgroundColor: '#f59e0b22', borderColor: '#f59e0b' }]}>
            <Ionicons name="warning" size={18} color="#f59e0b" />
            <Text style={[styles.warningText, { color: colors.foreground }]}>
              A report already exists within 50m — consider confirming it instead.
            </Text>
          </View>
        )}

        {/* Location */}
        <View style={[styles.section, { borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location" size={16} color={colors.primary} />
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>LOCATION</Text>
          </View>
          {locLoading ? (
            <View style={styles.locLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.locText, { color: colors.mutedForeground }]}>
                Getting your location…
              </Text>
            </View>
          ) : location ? (
            <>
              <Text style={[styles.locStreet, { color: colors.foreground }]}>{streetName}</Text>
              <Text style={[styles.locSub, { color: colors.mutedForeground }]}>
                {neighborhood} · {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
              </Text>
            </>
          ) : (
            <Text style={[styles.locText, { color: colors.mutedForeground }]}>
              Location unavailable
            </Text>
          )}
        </View>

        {/* Severity picker */}
        <Text style={[styles.label, { color: colors.foreground }]}>Severity</Text>
        <View style={styles.severityRow}>
          {SEVERITIES.map((s) => {
            const selected = severity === s.value;
            return (
              <Pressable
                key={s.value}
                onPress={() => {
                  setSeverity(s.value);
                  Haptics.selectionAsync();
                }}
                style={[
                  styles.severityCard,
                  {
                    borderColor: selected ? s.color : colors.border,
                    backgroundColor: selected ? s.color + '15' : colors.card,
                    flex: 1,
                  },
                ]}
              >
                <View style={[styles.severityDot, { backgroundColor: s.color }]} />
                <Text
                  style={[
                    styles.severityLabel,
                    { color: selected ? s.color : colors.foreground },
                  ]}
                >
                  {s.label}
                </Text>
                <Text
                  style={[styles.severityDesc, { color: colors.mutedForeground }]}
                  numberOfLines={2}
                >
                  {s.description}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Notes */}
        <Text style={[styles.label, { color: colors.foreground }]}>
          Notes{' '}
          <Text style={[styles.optional, { color: colors.mutedForeground }]}>(optional)</Text>
        </Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Describe the pothole size, location details…"
          placeholderTextColor={colors.mutedForeground}
          multiline
          numberOfLines={3}
          style={[
            styles.notesInput,
            {
              color: colors.foreground,
              backgroundColor: colors.muted,
              borderColor: colors.border,
            },
          ]}
        />
      </ScrollView>

      {/* Submit */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: bottomPad + 8,
          },
        ]}
      >
        <Pressable
          onPress={handleSubmit}
          disabled={!location || createMutation.isPending}
          style={({ pressed }) => [
            styles.submitBtn,
            {
              backgroundColor: location ? colors.primary : colors.muted,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons
                name="send"
                size={18}
                color={location ? '#fff' : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.submitText,
                  { color: location ? '#fff' : colors.mutedForeground },
                ]}
              >
                Submit Report
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  title: { fontSize: 22, fontWeight: '700' as const, fontFamily: 'Outfit_700Bold', letterSpacing: -0.4 },

  scrollContent: { paddingHorizontal: 20, paddingTop: 4, gap: 16 },

  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  warningText: { flex: 1, fontSize: 14, fontFamily: 'Outfit_400Regular', lineHeight: 20 },

  section: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '600' as const, fontFamily: 'Outfit_600SemiBold', letterSpacing: 0.8 },
  locLoading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  locText: { fontSize: 14, fontFamily: 'Outfit_400Regular' },
  locStreet: { fontSize: 17, fontWeight: '600' as const, fontFamily: 'Outfit_600SemiBold', marginBottom: 2 },
  locSub: { fontSize: 13, fontFamily: 'Outfit_400Regular' },

  label: { fontSize: 16, fontWeight: '600' as const, fontFamily: 'Outfit_600SemiBold' },
  optional: { fontWeight: '400' as const, fontFamily: 'Outfit_400Regular', fontSize: 14 },

  severityRow: { flexDirection: 'row', gap: 10 },
  severityCard: {
    borderWidth: 2,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  severityDot: { width: 12, height: 12, borderRadius: 6 },
  severityLabel: { fontSize: 13, fontWeight: '700' as const, fontFamily: 'Outfit_700Bold' },
  severityDesc: { fontSize: 11, fontFamily: 'Outfit_400Regular', textAlign: 'center' },

  notesInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    fontFamily: 'Outfit_400Regular',
    minHeight: 90,
    textAlignVertical: 'top',
  },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
  },
  submitText: { fontSize: 16, fontWeight: '600' as const, fontFamily: 'Outfit_600SemiBold' },
});
