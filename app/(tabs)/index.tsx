import { Text, StyleSheet, View } from 'react-native';
import { Screen } from '../../components/screen';

export default function HomeScreen() {
  return (
    <Screen>
      <Text style={styles.title}>Keptly</Text>
      <Text style={styles.subtitle}>Keep your home on track.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Today</Text>
        <Text style={styles.cardText}>0 tasks due</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Upcoming</Text>
        <Text style={styles.cardText}>No reminders yet</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', color: '#1F1F1F', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#5F6368', marginBottom: 20 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 18, fontWeight: '600', marginBottom: 6, color: '#1F1F1F' },
  cardText: { fontSize: 15, color: '#5F6368' },
});