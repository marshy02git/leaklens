import React, { useRef, useEffect } from "react";
import { View, Animated, ImageBackground, StyleSheet, Dimensions } from "react-native";

const { width, height } = Dimensions.get("window");

export default function IndexScreen() {
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: -width / 4, // Move left
          duration: 5000, // 5 seconds
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: 0, // Move back to original position
          duration: 5000, // 5 seconds
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.background, { transform: [{ translateX }] }]}>
        <ImageBackground
          source={{ uri: "https://static.wikia.nocookie.net/garfield/images/9/9f/GarfieldCharacter.jpg/revision/latest?cb=20180421131132" }} // Replace with your image
          style={styles.image}
          resizeMode="cover"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  background: {
    position: "absolute",
    width: width * 1.5, // Slightly larger than the screen for smooth movement
    height: height,
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
