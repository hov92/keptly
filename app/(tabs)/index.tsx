import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { Screen } from '../../components/screen';
import { supabase } from '../../lib/supabase';

export default function HomeScreen() {
  const [checking, setChecking] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function checkHousehold() {
        try {
          setChecking(true);

          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (!user) {
            router.replace('/login');
            return;
          }

          const { data, error } = await supabase
            .from('household_members')
            .select('household_id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (!active) return;

          if (error) {
            console.error(error.message);
            setChecking(false);
            return;
          }

          if (!data) {
            router.replace('/household/create');
            return;
          }

          setChecking(false);
        } catch (error) {
          setChecking(false);
        }
      }

      checkHousehold();

      return () => {
        active = false;
      };
    }, [])
  );

  if (checking) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

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
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
    color: '#1F1F1F',
  },
  cardText: {
    fontSize: 15,
    color: '#5F6368',
  },
});