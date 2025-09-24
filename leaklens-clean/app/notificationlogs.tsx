import React, { useState, useCallback } from 'react';
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

export default function NotificationLogsScreen() {
  const router = useRouter();
  const [statusIndex, setStatusIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string>(new Date().toLocaleTimeString());

  const statusStates = [
    { label: 'Good', color: '#28a745', icon: 'check' as const },
    { label: 'Caution', color: '#ffc107', icon: 'exclamation-triangle' as const },
    { label: 'Critical', color: '#dc3545', icon: 'times' as const },
  ];

  const currentStatus = statusStates[statusIndex];

  const handleStatusPress = () => {
    setStatusIndex((prevIndex) => (prevIndex + 1) % statusStates.length);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setLastRefresh(new Date().toLocaleTimeString());
      setRefreshing(false);
    }, 800);
  }, []);

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

      {/* Card: Future Data */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>All Notifications</Text>
        <Text style={styles.cardText}>Last refresh: {lastRefresh}</Text>
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
  backButton: {
    paddingRight: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  subheading: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 15,
    marginLeft: 5,
  },
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
  badgeText: {
    color: 'white',
    fontSize: 12,
    marginLeft: 6,
  },
  statusContainerWrapper: {
    alignItems: 'center',
    marginVertical: 30,
  },
  statusContainer: {
    width: 300,
    height: 60,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    elevation: 4,
  },
  statusText: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#1e1e1e',
    padding: 20,
    marginTop: 30,
    borderRadius: 10,
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    color: '#0bfffe',
    marginBottom: 5,
  },
  cardText: {
    color: '#ccc',
    fontSize: 14,
  },
});

