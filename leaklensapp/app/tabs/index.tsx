import { Text, View, StyleSheet, Alert } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import ImageViewer from '@/components/ImageViewer';
import Button from '@/components/Button';
import ButtonAR from '@/components/ButtonAR';
import ar from '@/app/ar';
import { Camera } from 'expo-camera';
import React, { useState, useEffect } from 'react';
import Button2 from '@/components/ButtonAR';

const PlaceholderImage = require('@/assets/images/background-image.jpg');

export default function Index() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const router = useRouter(); // Use Router for navigation

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
  };
}
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Leak Lens</Text>
      <Link href="/tabs/about" style={styles.button}>
        Settings
      </Link>
      <View style={styles.imageContainer}>
        <ImageViewer imgSource={PlaceholderImage} />
      </View>

      <View style={styles.footerContainer}>
        <Button theme="primary" label="Real Time Data" />
        <Button theme="primary" label="Notification Logs" />
        <Link href="//ar" asChild>
          <Button2 theme2="secondary" label="AR" />
        </Link>
        <Button label="Logout" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#25292e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    flex: 0.5,
  },
  text: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  button: {
    fontSize: 20,
    textDecorationLine: 'underline',
    color: '#fff',
    marginBottom: 20,
  },
  footerContainer: {
    flex: 1,
    alignItems: 'center',
  },
});