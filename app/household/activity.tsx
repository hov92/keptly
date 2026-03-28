import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import { AppScreen } from '../../components/app-screen';
import { FormScreenHeader } from '../../components/form-screen-header';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import { getHouseholdActivity } from '../../lib/household-activity';

type ActivityRow = Awaited<ReturnType<typeof getHouseholdActivity>>[number];

function describeActivity(item: ActivityRow) {
  switch (item.action) {
    case 'invite_sent':
      return `${item.actor_name} sent an invite to ${(item.details as any)?.invited_email}.`;
    case 'invite_accepted':
      return `${item.actor_name} accepted a household invite.`;
    case 'invite_declined':
      return `${item.actor_name} declined a household invite.`;
    case 'invite_canceled':
      return `${item.actor_name} canceled an invite to ${(item.details as any)?.invited_email}.`;
    case 'member_role_changed':
      return `${item.actor_name} changed ${item.target_name}'s role to ${(item.details as any)?.role}.`;
    case 'member_removed':
      return `${item.actor_name} removed ${item.target_name} from the household.`;
    case 'member_promoted_to_owner':
      return `${item.actor_name} promoted ${item.target_name} to owner.`;
    default:
      return `${item.actor_name} performed ${item.action}.`;
  }
}

export default function HouseholdActivityScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ActivityRow[]>([]);

  async function loadActivity() {
    try {
      setLoading(true);
      const data = await getHouseholdActivity();
      setItems(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadActivity();
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
    <AppScreen>
      <FormScreenHeader
        title="Household activity"
        subtitle="Recent household changes and member actions."
      />

      {items.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>No recent activity.</Text>
        </View>
      ) : (
        items.map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.cardTitle}>{describeActivity(item)}</Text>
            <Text style={styles.cardMeta}>
              {new Date(item.created_at).toLocaleString()}
            </Text>
          </View>
        ))
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardTitle: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 22,
    marginBottom: 8,
    fontWeight: '600',
  },
  cardMeta: {
    fontSize: 13,
    color: COLORS.muted,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.muted,
  },
});