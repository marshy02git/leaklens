import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { getFirestore, collection, onSnapshot } from 'firebase/firestore';
import { firebaseApp } from '@/firebase/config';

type LogEntry = {
  id: string;
  location: string;
  status: string;
  timestamp: string;
  flowrate: string;
  temp: string;
  pressure: string;
};

export default function RealTimeDataScreen() {
  const router = useRouter();
  const [kitchenLogs, setKitchenLogs] = useState<LogEntry[]>([]);
  const db = getFirestore(firebaseApp);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'logs'), (snapshot) => {
      const logs = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<LogEntry, 'id'>), 
        }))
        .filter((log) => log.location === 'kitchen');
  
      setKitchenLogs(logs);
    });
  
    return () => unsubscribe();
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome name="arrow-left" size={25} color="white" />
        </TouchableOpacity>
        <Text style={styles.title}>Real-Time Data</Text>
      </View>

      {/* Section Buttons */}
      <View style={styles.elementsContainer}>
        <TouchableOpacity>
          <Text style={styles.elements}>Kitchen</Text>
        </TouchableOpacity>
        <TouchableOpacity>
          <Text style={styles.elements}>Bathroom1</Text>
        </TouchableOpacity>
        <TouchableOpacity>
          <Text style={styles.elements}>MasterBedroom</Text>
        </TouchableOpacity>
        <TouchableOpacity>
          <Text style={styles.elements}>Garage</Text>
        </TouchableOpacity>
      </View>

      {/* Kitchen Data Section */}
      <View style={styles.dataContainer}>
        <Text style={styles.sectionTitle}>Kitchen Logs</Text>
        <FlatList
          data={kitchenLogs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.logItem}>
              <Text style={styles.logText}>Status: {item.status}</Text>
              <Text style={styles.timestamp}>{item.timestamp || 'No timestamp'}</Text>
              <Text style={styles.logText}>Flow Rate: {item.flowrate || 'N/A'}</Text>
              <Text style={styles.logText}>Pressure: {item.pressure || 'N/A'}</Text>
              <Text style={styles.logText}>Temperature: {item.temp || 'N/A'}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No logs yet.</Text>}
        />
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  backButton: {
    paddingHorizontal: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 10,
  },
  elementsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginBottom: 10,
  },
  elements: {
    fontSize: 18,
    color: 'white',
  },
  dataContainer: {
    flex: 1,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 20,
    color: '#0bfffe',
    marginBottom: 10,
    fontWeight: 'bold',
  },
  logItem: {
    backgroundColor: '#1f1f1f',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  logText: {
    color: 'white',
    fontSize: 16,
  },
  timestamp: {
    color: 'gray',
    fontSize: 12,
  },
  empty: {
    color: 'gray',
    textAlign: 'center',
    marginTop: 20,
  },
});
