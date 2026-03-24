import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Screen } from '../../components/screen';

export default function RecordsScreen() {
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