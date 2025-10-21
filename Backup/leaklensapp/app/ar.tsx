import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Camera, CameraType as CameraTypes, CameraView } from 'expo-camera';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function ARScreen() {
  const [hasPermission, setHasPermission] = useState<null | boolean>(null);
  const [cameraType, setCameraType] = useState<CameraTypes>('back');
  const cameraRef = useRef<CameraView | null>(null);
  const router = useRouter();
  const { room } = useLocalSearchParams(); // ← Get the room name from route

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.statusText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.statusText}>Permission Denied</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => Alert.alert("Go to settings and enable camera access")}
        >
          <Text style={styles.buttonText}>Enable Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} ref={cameraRef} />

      {/* Room Name Overlay */}
      <View style={styles.roomOverlay}>
        <Text style={styles.roomText}>{room} AR View</Text>
      </View>

      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.buttonText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  roomOverlay: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    backgroundColor: '#00000088',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  roomText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    alignSelf: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  backButton: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: 'red',
    padding: 12,
    borderRadius: 8,
  },
});
