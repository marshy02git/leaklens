import React, { useState, useEffect } from 'react';
import { Text, View, StyleSheet, Alert, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Camera } from 'expo-camera';
import { Link, useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';

const screenWidth = Dimensions.get('window').width;

export default function Index() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleARButtonPress = async () => {
    if (hasPermission === null) {
      Alert.alert("Camera Access", "Requesting permission...");
    } else if (!hasPermission) {
      Alert.alert("Permission Denied", "Enable camera access in settings.");
    } else {
      router.push('/ar');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Leaklens</Text>
      <Text style={styles.subtitle}>Diagnostics Made Easy</Text>

      <View style={styles.cardContainer}>
        <Link href="/realtimedata" asChild>
          <TouchableOpacity style={styles.card}>
            <FontAwesome name="tachometer" size={20} color="#0bfffe" style={styles.cardIcon} />
            <Text style={styles.cardLabel}>Real Time Data</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/notificationlogs" asChild>
          <TouchableOpacity style={styles.card}>
            <FontAwesome name="bell" size={20} color="#0bfffe" style={styles.cardIcon} />
            <Text style={styles.cardLabel}>Notification Logs</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/ar" asChild>
          <TouchableOpacity style={styles.card}>
            <FontAwesome name="camera" size={20} color="#0bfffe" style={styles.cardIcon} />
            <Text style={styles.cardLabel}>AR View</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  title: {
    color: '#0bfffe',
    fontSize: 48,
    fontWeight: 'bold',
    fontFamily: 'American Typewriter', // Optional: match previous style
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#aaa',
    fontSize: 16,
    marginBottom: 30,
    textAlign: 'center',
  },
  cardContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  card: {
    width: screenWidth * 0.85,
    backgroundColor: '#1f1f1f',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  cardIcon: {
    marginRight: 12,
  },
  cardLabel: {
    fontSize: 18,
    color: '#0bfffe',
    fontWeight: '600',
  },
});
