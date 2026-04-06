import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, type Href } from 'expo-router';

import { Screen } from '../components/screen';
import { supabase } from '../lib/supabase';
import { getCurrentHouseholdId } from '../lib/household';
import { getNoHouseholdRoute } from '../lib/no-household-route';
import { formatQuantity } from '../lib/shopping';

type SearchTask = {
  id: string;
  title: string;
  category: string | null;
  due_date: string | null;
  is_completed: boolean;
};

type SearchShoppingItem = {
  id: string;
  title: string;
  category: string | null;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  is_completed: boolean;
};

type SearchPantryItem = {
  id: string;
  title: string;
  category: string | null;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  low_stock_threshold: number | null;
};

type SearchProvider = {
  id: string;
  name: string;
  category: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

type SearchServiceRecord = {
  id: string;
  title: string;
  service_date: string | null;
  amount: number | null;
  notes: string | null;
  provider_id: string | null;
  providers?: Array<{
    id: string;
    name: string;
    category: string | null;
  }> | null;
};

type SearchResult = {
  id: string;
  type: 'task' | 'shopping' | 'pantry' | 'provider' | 'service_record';
  title: string;
  meta: string;
  href: Href;
  score: number;
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function includesText(value: string | null | undefined, query: string) {
  return !!value && normalize(value).includes(query);
}

function scoreMatch(
  title: string,
  fields: Array<string | null | undefined>,
  query: string
) {
  let score = 0;

  if (normalize(title) === query) score += 100;
  if (normalize(title).startsWith(query)) score += 50;
  if (normalize(title).includes(query)) score += 25;

  for (const field of fields) {
    if (!field) continue;
    const text = normalize(field);
    if (text === query) score += 20;
    else if (text.startsWith(query)) score += 10;
    else if (text.includes(query)) score += 5;
  }

  return score;
}

export default function SearchScreen() {
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const [tasks, setTasks] = useState<SearchTask[]>([]);
  const [shoppingItems, setShoppingItems] = useState<SearchShoppingItem[]>([]);
  const [pantryItems, setPantryItems] = useState<SearchPantryItem[]>([]);
  const [providers, setProviders] = useState<SearchProvider[]>([]);
  const [serviceRecords, setServiceRecords] = useState<SearchServiceRecord[]>([]);

  useEffect(() => {
    async function loadSearchData() {
      try {
        setLoading(true);

        const householdId = await getCurrentHouseholdId();

        if (!householdId || householdId === 'null' || householdId === 'undefined') {
          const route = await getNoHouseholdRoute();
          router.replace(route);
          return;
        }

        const [
          { data: tasksData, error: tasksError },
          { data: shoppingData, error: shoppingError },
          { data: pantryData, error: pantryError },
          { data: providersData, error: providersError },
          { data: recordsData, error: recordsError },
        ] = await Promise.all([
          supabase
            .from('tasks')
            .select('id, title, category, due_date, is_completed')
            .eq('household_id', householdId)
            .order('created_at', { ascending: false }),
          supabase
            .from('shopping_list_items')
            .select('id, title, category, quantity, unit, notes, is_completed')
            .eq('household_id', householdId)
            .order('created_at', { ascending: false }),
          supabase
            .from('pantry_items')
            .select('id, title, category, quantity, unit, notes, low_stock_threshold')
            .eq('household_id', householdId)
            .order('title', { ascending: true }),
          supabase
            .from('providers')
            .select('id, name, category, phone, email, notes')
            .eq('household_id', householdId)
            .order('name', { ascending: true }),
          supabase
            .from('service_records')
            .select(
              'id, title, service_date, amount, notes, provider_id, providers(id, name, category)'
            )
            .eq('household_id', householdId)
            .order('service_date', { ascending: false }),
        ]);

        if (tasksError) throw new Error(tasksError.message);
        if (shoppingError) throw new Error(shoppingError.message);
        if (pantryError) throw new Error(pantryError.message);
        if (providersError) throw new Error(providersError.message);
        if (recordsError) throw new Error(recordsError.message);

        setTasks((tasksData ?? []) as SearchTask[]);
        setShoppingItems((shoppingData ?? []) as SearchShoppingItem[]);
        setPantryItems((pantryData ?? []) as SearchPantryItem[]);
        setProviders((providersData ?? []) as SearchProvider[]);
        setServiceRecords((recordsData ?? []) as SearchServiceRecord[]);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    loadSearchData();
  }, []);

  const results = useMemo(() => {
    const q = normalize(query);
    if (!q) return [] as SearchResult[];

    const nextResults: SearchResult[] = [];

    for (const task of tasks) {
      const score = scoreMatch(
        task.title,
        [task.category, task.due_date, task.is_completed ? 'done' : 'open'],
        q
      );

      const matched =
        score > 0 ||
        includesText(task.title, q) ||
        includesText(task.category, q) ||
        includesText(task.due_date, q);

      if (!matched) continue;

      nextResults.push({
        id: task.id,
        type: 'task',
        title: task.title,
        meta: [
          task.category ? `Category: ${task.category}` : null,
          task.due_date ? `Due: ${task.due_date}` : null,
          task.is_completed ? 'Done' : 'Open',
        ]
          .filter(Boolean)
          .join(' • '),
        href: {
          pathname: '/tasks/[id]',
          params: {
            id: task.id,
            returnTo: '/search',
          },
        } as Href,
        score,
      });
    }

    for (const item of shoppingItems) {
      const qty = formatQuantity(item.quantity, item.unit);
      const score = scoreMatch(
        item.title,
        [item.category, item.notes, qty, item.is_completed ? 'done' : 'open'],
        q
      );

      const matched =
        score > 0 ||
        includesText(item.title, q) ||
        includesText(item.category, q) ||
        includesText(item.notes, q);

      if (!matched) continue;

      nextResults.push({
        id: item.id,
        type: 'shopping',
        title: item.title,
        meta: [
          item.category ? `Category: ${item.category}` : null,
          qty ? `Qty: ${qty}` : null,
          item.is_completed ? 'Done' : 'Open',
        ]
          .filter(Boolean)
          .join(' • '),
        href: {
          pathname: '/shopping/[id]',
          params: {
            id: item.id,
            returnTo: '/search',
          },
        } as Href,
        score,
      });
    }

    for (const item of pantryItems) {
      const qty = formatQuantity(item.quantity, item.unit);
      const score = scoreMatch(item.title, [item.category, item.notes, qty], q);

      const matched =
        score > 0 ||
        includesText(item.title, q) ||
        includesText(item.category, q) ||
        includesText(item.notes, q);

      if (!matched) continue;

      nextResults.push({
        id: item.id,
        type: 'pantry',
        title: item.title,
        meta: [
          item.category ? `Category: ${item.category}` : null,
          qty ? `Qty: ${qty}` : null,
          item.low_stock_threshold != null
            ? `Low stock at: ${item.low_stock_threshold}`
            : null,
        ]
          .filter(Boolean)
          .join(' • '),
        href: {
          pathname: '/shopping/pantry/[id]',
          params: {
            id: item.id,
            returnTo: '/search',
          },
        } as Href,
        score,
      });
    }

    for (const provider of providers) {
      const score = scoreMatch(
        provider.name,
        [provider.category, provider.phone, provider.email, provider.notes],
        q
      );

      const matched =
        score > 0 ||
        includesText(provider.name, q) ||
        includesText(provider.category, q) ||
        includesText(provider.phone, q) ||
        includesText(provider.email, q) ||
        includesText(provider.notes, q);

      if (!matched) continue;

      nextResults.push({
        id: provider.id,
        type: 'provider',
        title: provider.name,
        meta: [
          provider.category ? `Category: ${provider.category}` : null,
          provider.phone ? provider.phone : null,
          provider.email ? provider.email : null,
        ]
          .filter(Boolean)
          .join(' • '),
        href: {
          pathname: '/records/providers/[id]',
          params: {
            id: provider.id,
            returnTo: '/search',
          },
        } as Href,
        score,
      });
    }

    for (const record of serviceRecords) {
      const providerName = record.providers?.[0]?.name ?? null;
      const amountLabel = record.amount != null ? `$${record.amount}` : null;

      const score = scoreMatch(
        record.title,
        [record.notes, record.service_date, providerName, amountLabel],
        q
      );

      const matched =
        score > 0 ||
        includesText(record.title, q) ||
        includesText(record.notes, q) ||
        includesText(record.service_date, q) ||
        includesText(providerName, q);

      if (!matched) continue;

      nextResults.push({
        id: record.id,
        type: 'service_record',
        title: record.title,
        meta: [
          providerName ? `Provider: ${providerName}` : null,
          record.service_date ? `Date: ${record.service_date}` : null,
          amountLabel,
        ]
          .filter(Boolean)
          .join(' • '),
        href: {
          pathname: '/records/service-records/[id]',
          params: {
            id: record.id,
            returnTo: '/search',
          },
        } as Href,
        score,
      });
    }

    return nextResults.sort(
      (a, b) => b.score - a.score || a.title.localeCompare(b.title)
    );
  }, [query, tasks, shoppingItems, pantryItems, providers, serviceRecords]);

  const grouped = useMemo(
    () => ({
      tasks: results.filter((item) => item.type === 'task'),
      shopping: results.filter((item) => item.type === 'shopping'),
      pantry: results.filter((item) => item.type === 'pantry'),
      providers: results.filter((item) => item.type === 'provider'),
      serviceRecords: results.filter((item) => item.type === 'service_record'),
    }),
    [results]
  );

  function renderSection(label: string, items: SearchResult[]) {
    if (items.length === 0) return null;

    return (
      <View style={styles.section} key={label}>
        <Text style={styles.sectionTitle}>{label}</Text>

        {items.map((item) => (
          <Pressable
            key={`${item.type}-${item.id}`}
            style={styles.resultCard}
            onPress={() => router.push(item.href)}
          >
            <View style={styles.resultTopRow}>
              <Text style={styles.resultTitle}>{item.title}</Text>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>
                  {item.type === 'service_record'
                    ? 'Record'
                    : item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                </Text>
              </View>
            </View>

            {!!item.meta && <Text style={styles.resultMeta}>{item.meta}</Text>}
          </Pressable>
        ))}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const showEmpty = normalize(query).length > 0 && results.length === 0;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>Search</Text>
        <Text style={styles.title}>Find anything</Text>
        <Text style={styles.subtitle}>
          Search tasks, shopping, pantry, providers, and service records.
        </Text>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search household data"
          placeholderTextColor="#8A8F98"
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />

        {!normalize(query) ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Start typing</Text>
            <Text style={styles.emptyText}>
              Search across tasks, shopping items, pantry, providers, and records.
            </Text>
          </View>
        ) : null}

        {showEmpty ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No matches found</Text>
            <Text style={styles.emptyText}>
              Try a broader keyword like a title, category, provider name, or note.
            </Text>
          </View>
        ) : null}

        {renderSection('Tasks', grouped.tasks)}
        {renderSection('Shopping Items', grouped.shopping)}
        {renderSection('Pantry', grouped.pantry)}
        {renderSection('Providers', grouped.providers)}
        {renderSection('Service Records', grouped.serviceRecords)}
      </ScrollView>
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
  eyebrow: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2A9D8F',
    marginBottom: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    color: '#5F6368',
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E3DA',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1F1F1F',
    marginBottom: 16,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 10,
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  resultTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  resultTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  resultMeta: {
    fontSize: 14,
    color: '#5F6368',
    lineHeight: 20,
  },
  typeBadge: {
    backgroundColor: '#E8F5F3',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2A9D8F',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#5F6368',
    lineHeight: 22,
  },
});