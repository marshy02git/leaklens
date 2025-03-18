import { Text, View, StyleSheet, Alert } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import ImageViewer from '@/components/ImageViewer';
import Button from '@/components/Button';
import { Camera } from 'expo-camera';
import React, { useState, useEffect } from 'react';
import Button2 from '@/components/ButtonAR';
import Button3 from '@/components/ButtonRTD';

const PlaceholderImage = require('@/assets/images/houseplumb1.gif');

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
      <Text style={styles.text}>LeakLens</Text>
      
      <View style={styles.imageContainer}>
        <ImageViewer imgSource={PlaceholderImage} />
      </View>

      <View style={styles.footerContainer}>
        <Link href="/realtimedata" asChild>
          <Button3 theme3="third" label="Real Time Data" />
        </Link>
        <Button theme="primary" label="Notification Logs" />
        <Link href="/ar" asChild>
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
    color: '#0bfffe',
    fontSize: 60,
    fontFamily: 'American Typewriter',
    fontWeight: 'bold',
    
  },
  button: {
    fontSize: 20,
    textDecorationLine: 'underline',
    color: '#fff',
    marginBottom: 20,
  },
  button2: {
    fontSize: 20,
    textDecorationLine: 'underline',
    color: '#fff',
    marginBottom: 20,
  },
  footerContainer: {
    flex: 2,
    alignItems: 'center',
  },
});