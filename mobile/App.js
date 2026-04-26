import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { checkBackendConnection } from './api';
import SplashScreen from './SplashScreen';
import QAScreen from './QAScreen';
import ReportAnalysisScreen from './ReportAnalysisScreen';

const Tab = createBottomTabNavigator();
const RETRY_INTERVAL_MS = 30000; // retry every 30 s

export default function App() {
  const [backendConnected, setBackendConnected] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const retryRef = useRef(null);

  const attemptConnection = async () => {
    const connected = await checkBackendConnection();
    setBackendConnected(connected);
    return connected;
  };

  useEffect(() => {
    // Initial check
    attemptConnection();

    // Poll every 30 s so the UI recovers automatically when the server wakes up
    retryRef.current = setInterval(attemptConnection, RETRY_INTERVAL_MS);
    return () => clearInterval(retryRef.current);
  }, []);

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <SafeAreaProvider>
    <NavigationContainer>
      <StatusBar style="dark" />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>OncoConnect</Text>
            <Text style={styles.headerSubtitle}>Your Health Assistant</Text>
          </View>
          <View style={[styles.statusIndicator, backendConnected ? styles.statusConnected : styles.statusDisconnected]}>
            <View style={backendConnected ? styles.statusDotConnected : styles.statusDotDisconnected} />
            <Text style={backendConnected ? styles.statusTextConnected : styles.statusTextDisconnected}>{backendConnected ? 'Online' : 'Offline'}</Text>
          </View>
        </View>

        {/* Tab Navigator */}
        <View style={styles.tabHost}>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarHideOnKeyboard: true,
            tabBarActiveTintColor: '#FF2D55',
            tabBarInactiveTintColor: '#8E8E93',
            tabBarStyle: {
              backgroundColor: '#FFFFFF',
              borderTopWidth: 0.5,
              borderTopColor: 'rgba(0,0,0,0.1)',
              paddingTop: 8,
              paddingBottom: 8,
              height: 60,
            },
            tabBarLabelStyle: {
              fontSize: 12,
              fontWeight: '600',
              marginTop: 4,
            },
          }}
        >
          <Tab.Screen
            name="Q&A"
            options={{
              tabBarIcon: ({ color, size }) => (
                <Text style={{ fontSize: 24 }}>💬</Text>
              ),
            }}
          >
            {() => <QAScreen backendConnected={backendConnected} />}
          </Tab.Screen>
          
          <Tab.Screen
            name="Report Analysis"
            options={{
              tabBarIcon: ({ color, size }) => (
                <Text style={{ fontSize: 24 }}>📊</Text>
              ),
            }}
          >
            {() => <ReportAnalysisScreen backendConnected={backendConnected} />}
          </Tab.Screen>
        </Tab.Navigator>
        </View>
      </View>
    </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  tabHost: {
    flex: 1,
    minHeight: 0,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: '#8E8E93',
    marginTop: 2,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusConnected: {
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
  },
  statusDisconnected: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
  },
  statusDotConnected: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34C759',
  },
  statusDotDisconnected: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF3B30',
  },
  statusTextConnected: {
    fontSize: 12,
    fontWeight: '500',
    color: '#34C759',
  },
  statusTextDisconnected: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FF3B30',
  },
});
