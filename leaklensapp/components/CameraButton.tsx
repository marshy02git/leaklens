import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Camera } from 'expo-camera';

export default function CameraButton() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    // Request permission when the component mounts
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const openCamera = async () => {
    if (hasPermission === null) {
      Alert.alert("Camera Access", "Requesting permission...");
    } else if (!hasPermission) {
      Alert.alert("Permission Denied", "Enable camera access in settings.");
    } else {
      Alert.alert("Camera Opened", "You can now capture photos!");
      // TODO: Navigate to Camera Screen or Open Camera
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={openCamera}>
        <Text style={styles.buttonText}>Open Camera</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});