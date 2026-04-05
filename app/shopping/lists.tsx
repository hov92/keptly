import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { getCurrentHouseholdId } from '../../lib/household';
import type { ShoppingList } from '../../lib/shopping-lists';

export default function ShoppingListsScreen() {
  const [loading, setLoading] = useState(true);
  const [lists, setLists] = useState<ShoppingList[]>([]);

  async function loadLists() {
    try {
      setLoading(true);

      const householdId = await getCurrentHouseholdId();
      if (!householdId) {
        setLists([]);
        return;
      }

      const { data, error } = await supabase
        .from('shopping_lists')
        .select(
          'id, household_id, name, color, icon, is_default, created_by, created_at, updated_at'
        )
        .eq('household_id', householdId)
        .order('created_at', { ascending: true });

      if (error) {
        Alert.alert('Load failed', error.message);
        return;
      }

      setLists((data ?? []) as ShoppingList[]);
    } catch (error) {
      console.error(error);
      Alert.alert('Load failed', 'Could not load lists.');
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadLists();
    }, [])
  );

  async function handleDelete(list: ShoppingList) {
    if (list.is_default) {
      Alert.alert('Cannot delete', 'The default list cannot be deleted.');
      return;
    }

    Alert.alert(
      'Delete list?',
      'This will also delete items in this list.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('shopping_lists')
              .delete()
              .eq('id', list.id);

            if (error) {
              Alert.alert('Delete failed', error.message);
              return;
            }

            loadLists();
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlatList
        data={lists}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.headerRow}>
            <Text style={styles.title}>Custom Lists</Text>

            <Pressable
              style={styles.addButton}
              onPress={() => router.push('/shopping/lists/new')}
            >
              <Text style={styles.addButtonText}>Add</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() =>
              router.push({
                pathname: '/shopping/lists/[id]',
                params: { id: item.id, returnTo: '/shopping/lists' },
              })
            }
          >
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.meta}>Color: {item.color || 'Default'}</Text>
            <Text style={styles.meta}>Icon: {item.icon || 'None'}</Text>
            <Text style={styles.meta}>
              Type: {item.is_default ? 'Default list' : 'Custom list'}
            </Text>

            {!item.is_default ? (
              <Pressable
                style={styles.deleteButton}
                onPress={() => handleDelete(item)}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </Pressable>
            ) : null}
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.card}>
            <Text style={styles.meta}>No custom lists yet.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addButtonText: {
    color: COLORS.primaryText,
    fontWeight: '700',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  meta: {
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: 4,
  },
  deleteButton: {
    marginTop: SPACING.sm,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.dangerSoft,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  deleteButtonText: {
    color: COLORS.danger,
    fontWeight: '700',
  },
});