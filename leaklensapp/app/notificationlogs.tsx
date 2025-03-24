import React, { useState } from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ScrollView} from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';

export default function NotificationLogsScreen() {
  const router = useRouter();
  const [statusIndex, setStatusIndex] = useState(0);

  const statusStates = [
    { label: 'Good', color: '#28a745', icon: 'check' as const},
    { label: 'Caution', color: '#ffc107', icon: 'exclamation-triangle' as const },
    { label: 'Critical', color: '#dc3545', icon: 'times' as const},
  ];

  const currentStatus = statusStates[statusIndex];

  const handleStatusPress = () => {
    setStatusIndex((prevIndex) => (prevIndex + 1) % statusStates.length);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#121212' }}
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

      {/* Connectivity Status Badge */}
      <View style={styles.connectionBadge}>
        <FontAwesome name="wifi" size={14} color="white" />
        <Text style={styles.badgeText}>Connected</Text>
      </View>

      {/* Status Box */}
      <View style={styles.statusContainerWrapper}>
        <TouchableOpacity
          style={[styles.statusContainer, { backgroundColor: currentStatus.color }]}
          onPress={handleStatusPress}>
          <FontAwesome name={currentStatus.icon} size={20} color="white" style={{ marginRight: 10 }} />
          <Text style={styles.statusText}>{currentStatus.label}</Text>
        </TouchableOpacity>
      </View>

      {/* Card: Future Data */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>All Notifications</Text>
        <Text style={styles.cardText}>Last refresh: 5h</Text>
      </View>
    </ScrollView>
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
