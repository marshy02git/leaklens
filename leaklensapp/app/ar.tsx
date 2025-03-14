import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Camera, CameraType as CameraTypes, CameraView } from 'expo-camera'; // Fix Import
import { useRouter } from 'expo-router';

export default function ARScreen() {
  const [hasPermission, setHasPermission] = useState<null | boolean>(null);
  const [cameraType, setCameraType] = useState<CameraTypes>('back');
  const cameraRef = useRef< CameraView | null>(null);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  if (hasPermission === null) {
    return <View style={styles.container}><Text>Requesting camera permission...</Text></View>;
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Permission Denied</Text>
        <TouchableOpacity style={styles.button} onPress={() => Alert.alert("Go to settings and enable camera access")}>
          <Text style={styles.buttonText}>Enable Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} ref={cameraRef} />
      
      {/* Flip Camera Button */}
      <TouchableOpacity 
        style={styles.flipButton} 
        onPress={() => setCameraType(cameraType === 'back' ? 'front' : 'back')}
      >
        <Text style={styles.buttonText}>Flip Camera</Text>
      </TouchableOpacity>

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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  permissionText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  flipButton: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 10,
    borderRadius: 5,
  },
  backButton: {
    position: 'absolute',
    bottom: 20,
    backgroundColor: 'red',
    padding: 10,
    borderRadius: 5,
  },
});