import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';

export default function RealTimeDataScreen() {
  const router = useRouter(); // For navigation

  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome name="arrow-left" size={25} color="white" />
        </TouchableOpacity>
        
        {/* Title Text Aligned with Arrow */}
        <Text style={styles.title}>Real-Time Data</Text>
      </View>

      <View style={styles.elementsContainer}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.elements}>Kitchen</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.elements}>Bathroom1</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.elements}>MasterBedroom</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.elements}>Garage</Text>
        </TouchableOpacity>
        
      </View>

      {/* Data Display Section */}
      <View style={styles.dataContainer}>
        <Text style={styles.data}>📡 Future Data </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, 
    backgroundColor: '#121212',
    padding: 10, 
  },
  header: {
    flexDirection: 'row', // ✅ Puts the arrow and text in the same row
    alignItems: 'center', // ✅ Ensures both are vertically centered
    paddingVertical: 10,
  },
  backButton: {
    backgroundColor: 'transparent', // No background color
    paddingHorizontal: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 10, // ✅ Space between arrow and text
  },
  dataContainer: {
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  data: {
    fontSize: 20,
    color: '#fff',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  elementsContainer: {
    flex: 0.5,
    justifyContent: 'space-evenly',
    alignItems: 'center',
    flexDirection: 'row',
  },
  elements: {
    fontSize: 18,
    color: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  button: {
    backgroundColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  }
});
