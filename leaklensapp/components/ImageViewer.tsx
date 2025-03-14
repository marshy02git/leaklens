import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated } from 'react-native';
import { Image, type ImageSource } from 'expo-image';
import { BlurView } from 'expo-blur';

type Props = {
  imgSource: ImageSource;
  blurIntensity?: number;
};

export default function ImageViewer({ imgSource, blurIntensity = 10 }: Props) {
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: -5, // Move up slightly
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 5, // Move down slightly
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.container}>
      {/* Animated Image */}
      <Animated.View style={{ transform: [{ translateY }] }}>
        <Image source={imgSource} style={styles.image} />
        <BlurView intensity={blurIntensity} style={styles.blur} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: 420,
    height: 675,
    borderRadius: 18,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  blur: {
    ...StyleSheet.absoluteFillObject,
  },
});