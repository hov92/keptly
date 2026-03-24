import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { Screen } from '../../components/screen';
import { getCurrentHouseholdId } from '../../lib/household';
import { getNoHouseholdRoute } from '../../lib/no-household-route';

export default function RecordsScreen() {
  const [loading, setLoading] = useState(true);

  async function checkHousehold() {
    try {
      setLoading(true);

      const householdId = await getCurrentHouseholdId();

      if (!householdId || householdId === 'null' || householdId === 'undefined') {
        const route = await getNoHouseholdRoute();
        router.replace(route);
        return;
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      checkHousehold();
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Screen>
      <Text style={styles.title}>Records</Text>
      <Text style={styles.subtitle}>Keep your home information organized</Text>

      <Pressable
        style={styles.card}
        onPress={() => router.push('/records/providers')}
      >
        <Text style={styles.cardTitle}>Providers</Text>
        <Text style={styles.cardText}>
          Save trusted pros like plumbers, cleaners, lawn care, and electricians.
        </Text>
        <Text style={styles.cardLink}>Open Providers</Text>
      </Pressable>

      <View style={styles.cardMuted}>
        <Text style={styles.cardTitle}>Service History</Text>
        <Text style={styles.cardText}>Coming next.</Text>
      </View>

      <View style={styles.cardMuted}>
        <Text style={styles.cardTitle}>Documents</Text>
        <Text style={styles.cardText}>Coming next.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F6F2',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#5F6368',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
  },
  cardMuted: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    opacity: 0.8,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 8,
  },
  cardText: {
    fontSize: 15,
    color: '#5F6368',
    lineHeight: 22,
    marginBottom: 12,
  },
  cardLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2A9D8F',
  },
});