import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const formatTimeWithMs = (ms: number) => {
  try {
    // @ts-ignore fractionalSecondDigits may not be typed in some RN envs
    return new Date(ms).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  } catch {
    const d = new Date(ms);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    const mmm = String(d.getMilliseconds()).padStart(3, '0');
    return `${hh}:${mm}:${ss}.${mmm}`;
  }
};

export default function NotificationLogsScreen() {
  const router = useRouter();
  const [statusIndex, setStatusIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshMs, setLastRefreshMs] = useState<number>(Date.now());
  const [lastSentMs, setLastSentMs] = useState<number | null>(null);

  // quick, safe permission/setup (ok even if you also set this in _layout)
  useEffect(() => {
    (async () => {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }
    })();
  }, []);

  const statusStates = [
    { label: 'Good',    color: '#28a745', icon: 'check' as const },
    { label: 'Caution', color: '#ffc107', icon: 'exclamation-triangle' as const },
    { label: 'Critical',color: '#dc3545', icon: 'times' as const },
  ];

  const currentStatus = statusStates[statusIndex];

  const handleStatusPress = () => {
    setStatusIndex((prevIndex) => (prevIndex + 1) % statusStates.length);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setLastRefreshMs(Date.now());
      setRefreshing(false);
    }, 800);
  }, []);

  // 🚀 Test local notification (works in Expo Go)
const sendTestLocal = async () => {
  // ensure permission
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    if (req.status !== "granted") {
      console.log("Notifications permission not granted");
      return;
    }
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "LeakLens Test",
      body: "This is a local notification 🚰",
      data: { room: "Room1", pipe: "Pipe3" },
    },
    trigger: null, // fire immediately
  });

  console.log("scheduleNotificationAsync id:", id);
};


  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#121212' }} edges={['top']}>
      <ScrollView
        style={{ flex: 1, backgroundColor: '#121212' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <FontAwesome name="arrow-left" size={25} color="white" />
          </TouchableOpacity>
          <Text style={styles.title}>Notifications</Text>
        </View>

        {/* Subheading */}
        <Text style={styles.subheading}>Quickly monitor device status and all alerts</Text>

        {/* Connectivity Badge */}
        <View style={styles.connectionBadge}>
          <FontAwesome name="wifi" size={14} color="white" />
          <Text style={styles.badgeText}>Connected</Text>
        </View>

        {/* Battery Badge */}
        <View style={styles.batteryBadge}>
          <FontAwesome name="battery-three-quarters" size={14} color="white" />
          <Text style={styles.badgeText}>Battery: 75%</Text>
        </View>

        {/* Status Box */}
        <View style={styles.statusContainerWrapper}>
          <TouchableOpacity
            style={[styles.statusContainer, { backgroundColor: currentStatus.color }]}
            onPress={handleStatusPress}
          >
            <FontAwesome name={currentStatus.icon} size={20} color="white" style={{ marginRight: 10 }} />
            <Text style={styles.statusText}>{currentStatus.label}</Text>
          </TouchableOpacity>
        </View>

        {/* Card: All Notifications + Test */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>All Notifications</Text>
          <Text style={styles.cardText}>Last refresh: {formatTimeWithMs(lastRefreshMs)}</Text>
          <Text style={styles.cardText}>
            Last test sent: {lastSentMs ? formatTimeWithMs(lastSentMs) : '—'}
          </Text>

          {/* Test button */}
          <TouchableOpacity style={styles.testBtn} onPress={sendTestLocal}>
            <Text style={styles.testBtnText}>Send Test Notification</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#121212',
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  backButton: { paddingRight: 10 },
  title: { fontSize: 24, fontWeight: 'bold', color: 'white' },
  subheading: { fontSize: 14, color: '#ccc', marginBottom: 15, marginLeft: 5 },
  connectionBadge: {
    backgroundColor: '#2ecc71',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginLeft: 5,
    marginBottom: 5,
  },
  batteryBadge: {
    backgroundColor: '#f39c12',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginLeft: 5,
    marginBottom: 20,
  },
  badgeText: { color: 'white', fontSize: 12, marginLeft: 6 },
  statusContainerWrapper: { alignItems: 'center', marginVertical: 30 },
  statusContainer: {
    width: 300, height: 60, borderRadius: 12, justifyContent: 'center',
    alignItems: 'center', flexDirection: 'row', elevation: 4,
  },
  statusText: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  card: {
    backgroundColor: '#1e1e1e', padding: 20, marginTop: 30, borderRadius: 10, alignItems: 'center',
  },
  cardTitle: { fontSize: 18, color: '#0bfffe', marginBottom: 5 },
  cardText: { color: '#ccc', fontSize: 14, marginBottom: 6 },
  testBtn: {
    marginTop: 12,
    backgroundColor: '#0bfffe',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  testBtnText: { color: '#000', fontWeight: 'bold' },
});
