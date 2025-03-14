import React, { useState, useEffect, useRef } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { View, Text, Button, StyleSheet } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Camera } from 'expo-camera';
import { Link } from 'expo-router';

const Stack = createStackNavigator();

const HomeScreen = ({ navigation }: { navigation: any }) => (
  <View style={styles.container}>
    <Text style={styles.header}>Leak Lens V1.0</Text>
    <Text>Welcome back "User"</Text>
    <Button title="Real Time Data" onPress={() => navigation.navigate('RealTime')} />
    <Button title="Notification Logs" onPress={() => navigation.navigate('Logs')} />
    <Button title="AR" onPress={() => navigation.navigate('AR')} />
    <Button title="Settings" onPress={() => navigation.navigate('Settings')} />
  </View>
);


const RealTimeScreen = () => (
  <View style={styles.container}>
    <Text>Real Time Data</Text>
  </View>
);

const LogsScreen = () => (
  <View style={styles.container}>
    <Text>Notification Logs</Text>
  </View>
);

const ARScreen = () => {
  
  
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const cameraRef = useRef<CameraView | null>(null); 

  useEffect(() => {
    const getPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };
    getPermissions();
  }, []);

  if (hasPermission === null) {
    return <Text>Requesting camera permission...</Text>;
  }

  if (hasPermission === false) {
    return <Text>No access to camera</Text>;
  }

  return (
    <View style={styles.cameraContainer}>
      <CameraView style={styles.camera} ref={cameraRef} />
    </View>
  ); 
};

const SettingsScreen = () => (
  <View style={styles.container}>
    <Text>Settings</Text>
  </View>
);

const AboutScreen = () => (
  <View style={styles.container}>
    <Text style={styles.text}>This is the About screen</Text>
  </View>
);

const App = () => (
  <Stack.Navigator initialRouteName="Home">
    <Stack.Screen name="Home" component={HomeScreen} />
    <Stack.Screen name="RealTime" component={RealTimeScreen} />
    <Stack.Screen name="Logs" component={LogsScreen} />
    <Stack.Screen name="AR" component={ARScreen} />
    <Stack.Screen name="Settings" component={SettingsScreen} />
    <Stack.Screen name="About" component={AboutScreen} />
  </Stack.Navigator>
);

// Named export for Index
export function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Home screen</Text>
      <Link href="/about" style={styles.button}>
        Go to About screen
      </Link>
    </View>
  );
}

export default App;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'powderblue',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: 'slategray',
  },
  header: {
    fontSize: 40,
    fontFamily: 'Damascus',
    marginBottom: 20,
  },
  cameraContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  button: {
    fontSize: 20,
    textDecorationLine: 'underline',
    color: '#fff',
  },
});
