import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, Dimensions } from 'react-native';
import { Image, type ImageSource } from 'expo-image';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window'); // Get screen size

type Props = {
  imgSource: ImageSource;
  blurIntensity?: number;
};

export default function ImageViewer({ imgSource, blurIntensity = 10 }: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        // Horizontal movement
        Animated.sequence([
          Animated.timing(translateX, {
            toValue: 20, // Move right
            duration: 3000,
            useNativeDriver: true,
          }),
          Animated.timing(translateX, {
            toValue: -20, // Move left
            duration: 3000,
            useNativeDriver: true,
          }),
        ]),
        // Vertical movement
        Animated.sequence([
          Animated.timing(translateY, {
            toValue: 20, // Move down
            duration: 3000,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: -20, // Move up
            duration: 3000,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.backgroundContainer}>
      {/* Animated Background Image */}
      <Animated.View
        style={[
          styles.animatedContainer,
          { transform: [{ translateX }, { translateY }] },
        ]}
      >
        <Image source={imgSource} style={styles.image} />
        <BlurView intensity={blurIntensity} style={styles.blur} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backgroundContainer: {
    position: 'absolute', // Keep it in the background
    width: width,
    height: height,
    top: 0,
    left: 0,
    zIndex: -1, // Push behind other elements
  },
  animatedContainer: {
    width: width * 1.2, // Slightly larger than screen for smooth motion
    height: height * 0.7, // Ensure it doesn't cover full screen
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
    opacity: 0.5, // Ensure text is readable
  },
  blur: {
    ...StyleSheet.absoluteFillObject,
  },
});