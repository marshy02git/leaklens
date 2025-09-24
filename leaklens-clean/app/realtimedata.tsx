import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { getFirestore, collection, onSnapshot } from 'firebase/firestore';
import { firebaseApp } from '../firebase/config';
import { SafeAreaView } from 'react-native-safe-area-context'; // ✅ added

/*import FlowRateChart from '@/components/FlowRateChart';*/

function StatBlock({ label, stats, unit }: { label: string; stats: any; unit: string }) {
  return (
    <View style={{ marginVertical: 8 }}>
      <Text style={{ color: '#0bfffe', fontWeight: 'bold', fontSize: 16 }}>{label}</Text>
      <Text style={{ color: 'white' }}>
        Current: {stats.current} {unit} | Min: {stats.min} | Max: {stats.max} | Avg: {stats.avg}
      </Text>
    </View>
  );
}

function getStats(values: string[]) {
  const nums = values.map((v) => parseFloat(v)).filter((v) => !isNaN(v));
  if (nums.length === 0) return { min: '-', max: '-', avg: '-', current: '-' };
  const avg = (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1);
  return {
    current: nums[nums.length - 1].toFixed(1),
    min: Math.min(...nums).toFixed(1),
    max: Math.max(...nums).toFixed(1),
    avg,
  };
}

type LogEntry = {
  id: string;
  location: string;
  status: string;
  timestamp: string;
  flowrate: string;
  temp: string;
  pressure: string;
};

const locations = ['Kitchen', 'Bathroom1', 'MasterBedroom', 'Garage'] as const;
const chartTypes = ['flowrate', 'temp', 'pressure'] as const;

export default function RealTimeDataScreen() {
  const router = useRouter();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [timeframe, setTimeframe] = useState<'today' | 'hour'>('today');
  const [chartType, setChartType] = useState<typeof chartTypes[number]>('flowrate');
  const [refreshing, setRefreshing] = useState(false);

  const db = getFirestore(firebaseApp);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'logs'), (snapshot) => {
      const entries = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<LogEntry, 'id'>),
      }));
      setLogs(entries);
    });

    return () => unsubscribe();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 800); // Simulated refresh delay
  }, []);

  const renderDashboard = () => {
    const now = new Date();
    const filteredLogs = logs.filter((log) => {
      if (!log.timestamp) return false;
      const logTime = new Date(log.timestamp);
      if (timeframe === 'hour') {
        return now.getTime() - logTime.getTime() <= 3600000; // Last hour
      } else {
        return now.toDateString() === logTime.toDateString(); // Today
      }
    });

    const flowByRoom: Record<string, number[]> = {};
    const pressureByRoom: Record<string, number[]> = {};

    filteredLogs.forEach((log) => {
      const room = log.location;
      if (!room) return;

      const flow = parseFloat(log.flowrate || '0');
      const pressure = parseFloat(log.pressure || '0');

      if (!flowByRoom[room]) flowByRoom[room] = [];
      if (!pressureByRoom[room]) pressureByRoom[room] = [];

      if (!isNaN(flow)) flowByRoom[room].push(flow);
      if (!isNaN(pressure)) pressureByRoom[room].push(pressure);
    });

    let mostFlowRoom = 'N/A';
    let mostFlowValue = 0;
    for (const [room, values] of Object.entries(flowByRoom)) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      if (avg > mostFlowValue) {
        mostFlowValue = avg;
        mostFlowRoom = room;
      }
    }

    let maxPressureRoom = 'N/A';
    let maxPressureValue = 0;
    for (const [room, values] of Object.entries(pressureByRoom)) {
      const max = Math.max(...values);
      if (max > maxPressureValue) {
        maxPressureValue = max;
        maxPressureRoom = room;
      }
    }

    const criticalCount = filteredLogs.filter((l) => l.status === 'critical').length;

    return (
      <View style={styles.dashboard}>
        <View style={styles.card}>
          <Text style={styles.cardTitleCenter}>Most Flow</Text>
          <Text style={styles.cardValue}>{mostFlowRoom}</Text>
          <Text style={styles.cardSub}>{mostFlowValue.toFixed(1)} L/m</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitleCenter}>Highest Pressure</Text>
          <Text style={styles.cardValue}>{maxPressureRoom}</Text>
          <Text style={styles.cardSub}>{maxPressureValue.toFixed(1)} PSI</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitleCenter}>Critical Alerts</Text>
          <Text style={styles.cardValue}>{criticalCount}</Text>
        </View>
      </View>
    );
  };

  const renderLogSection = (location: string) => {
    const [showSummary, setShowSummary] = useState(false);

    const roomLogs = logs
      .filter((log) => log.location?.toLowerCase() === location.toLowerCase())
      .slice(-10); // Limit to last 10

    const flowStats = getStats(roomLogs.map((log) => log.flowrate));
    const pressureStats = getStats(roomLogs.map((log) => log.pressure));
    const tempStats = getStats(roomLogs.map((log) => log.temp));

    return (
      <View style={styles.dataContainer} key={location}>
        <Text style={styles.sectionTitle}> {location} Logs</Text>

        {roomLogs.length === 0 ? (
          <Text style={styles.empty}>No logs yet.</Text>
        ) : (
          <>
            {roomLogs.map((item) => (
              <View key={item.id} style={styles.logItem}>
                <Text style={styles.logText}>
                  Status:{' '}
                  <Text style={{ color: getStatusColor(item.status) }}>
                    {item.status}
                  </Text>
                </Text>
                <Text style={styles.timestamp}>{item.timestamp || 'No timestamp'}</Text>
                <Text style={styles.logText}>Flow Rate: {item.flowrate || 'N/A'}</Text>
                <Text style={styles.logText}>Pressure: {item.pressure || 'N/A'}</Text>
                <Text style={styles.logText}>Temperature: {item.temp || 'N/A'}</Text>
              </View>
            ))}

            {/* Dropdown Toggle Button */}
            <TouchableOpacity onPress={() => setShowSummary(!showSummary)} style={styles.dropdownToggle}>
              <Text style={styles.dropdownToggleText}>
                {showSummary ? 'Hide Summary ▲' : 'Show Summary ▼'}
              </Text>
            </TouchableOpacity>

            {/* Summary Section */}
            {showSummary && (
              <View style={styles.logItem}>
                <Text style={[styles.logText, { color: '#0bfffe', fontWeight: 'bold', marginBottom: 10 }]}>Summary</Text>

                {/* Header Row */}
                <View style={styles.statRow}>
                  <Text style={styles.statHeader}></Text>
                  <Text style={styles.statHeader}>Flow</Text>
                  <Text style={styles.statHeader}>Pressure</Text>
                  <Text style={styles.statHeader}>Temp</Text>
                </View>

                {/* Min */}
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Min</Text>
                  <Text style={styles.statValue}>{flowStats.min}</Text>
                  <Text style={styles.statValue}>{pressureStats.min}</Text>
                  <Text style={styles.statValue}>{tempStats.min}</Text>
                </View>

                {/* Max */}
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Max</Text>
                  <Text style={styles.statValue}>{flowStats.max}</Text>
                  <Text style={styles.statValue}>{pressureStats.max}</Text>
                  <Text style={styles.statValue}>{tempStats.max}</Text>
                </View>

                {/* Avg */}
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Avg</Text>
                  <Text style={styles.statValue}>{flowStats.avg}</Text>
                  <Text style={styles.statValue}>{pressureStats.avg}</Text>
                  <Text style={styles.statValue}>{tempStats.avg}</Text>
                </View>
              </View>
            )}
          </>
        )}
      </View>
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal':
        return 'lime';
      case 'warning':
        return 'orange';
      case 'critical':
        return 'red';
      default:
        return 'white';
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#121212' }} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <FontAwesome name="arrow-left" size={25} color="white" />
            </TouchableOpacity>
            <Text style={styles.title}>Real-Time Data</Text>
          </View>

          {/* Dashboard Summary */}
          {renderDashboard()}

          {/* Chart Toggle */}
          <View style={styles.chartSelector}>
            {chartTypes.map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.chartButton,
                  chartType === type && { backgroundColor: '#0bfffe' },
                ]}
                onPress={() => setChartType(type)}
              >
                <Text
                  style={{
                    color: chartType === type ? 'black' : 'white',
                    fontWeight: 'bold',
                  }}
                >
                  {type.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Room Navigation */}
          <View style={styles.elementsContainer}>
            {locations.map((room) => (
              <TouchableOpacity
                key={room}
                onPress={() => router.push({ pathname: '/ar', params: { room } })}
              >
                <Text style={styles.elements}>{room}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Log Sections */}
          {locations.map(renderLogSection)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 10 },
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  backButton: { paddingHorizontal: 10 },
  title: { fontSize: 24, fontWeight: 'bold', color: 'white', marginLeft: 10 },

  dashboard: { flexDirection: 'row', justifyContent: 'space-evenly', marginBottom: 10 },
  card: {
    backgroundColor: '#1f1f1f',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    width: 100,
  },
  cardTitle: { color: 'gray', fontSize: 14 },
  cardValue: { color: 'white', fontSize: 18, fontWeight: 'bold' },

  chartSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
    gap: 10,
  },
  chartButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#333',
    borderRadius: 8,
  },

  elementsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginBottom: 10,
  },
  elements: {
    fontSize: 16,
    padding: 6,
    paddingHorizontal: 12,
    color: 'white',
    backgroundColor: '#1e1e1e',
    borderRadius: 10,
  },

  dataContainer: { marginTop: 10 },
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
  logText: { color: 'white', fontSize: 16 },
  timestamp: { color: 'gray', fontSize: 12 },
  empty: { color: 'gray', textAlign: 'center', marginTop: 10 },

  arButton: {
    marginTop: 20,
    backgroundColor: '#0bfffe',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
  },
  arText: { color: '#121212', fontWeight: 'bold', fontSize: 16 },

  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  statHeader: {
    flex: 1,
    fontWeight: 'bold',
    fontSize: 14,
    color: '#0bfffe',
    textAlign: 'center',
  },
  statLabel: {
    flex: 1,
    fontWeight: 'bold',
    color: 'white',
  },
  statValue: {
    flex: 1,
    color: 'white',
    textAlign: 'center',
  },
  dropdownToggle: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 10,
    marginBottom: 5,
    backgroundColor: '#0bfffe20',
    borderRadius: 8,
  },
  dropdownToggleText: {
    color: '#0bfffe',
    fontWeight: 'bold',
  },
  cardSub: {
    color: 'gray',
    fontSize: 12,
    marginTop: 2,
  },
  timeToggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
    gap: 10,
  },
  timeButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: '#333',
    borderRadius: 8,
  },
  cardTitleCenter: {
    color: 'gray',
    fontSize: 14,
    textAlign: 'center',
  },
});
