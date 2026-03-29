import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';

import { AppScreen } from '../../components/app-screen';
import { FormInput } from '../../components/form-input';
import { CategoryPicker } from '../../components/category-picker';
import { COLORS, RADIUS } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { createHouseholdInvite } from '../../lib/household-invites';
import { getActiveHouseholdPermissions } from '../../lib/permissions';

const ROLE_OPTIONS = ['member', 'child', 'owner'] as const;
type InviteRole = (typeof ROLE_OPTIONS)[number];

export default function HouseholdInviteScreen() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InviteRole>('member');
  const [loading, setLoading] = useState(false);

  async function handleInvite() {
    if (!email.trim()) {
      Alert.alert('Missing info', 'Enter an email address.');
      return;
    }

    try {
      setLoading(true);

      const permissions = await getActiveHouseholdPermissions();
      if (!permissions.canInviteMembers) {
        Alert.alert('Restricted', 'Your role cannot invite members.');
        router.back();
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      await createHouseholdInvite({
        email: email.trim(),
        role,
        userId: session?.user?.id ?? null,
      });

      router.back();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not send invite.';
      Alert.alert('Invite failed', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppScreen>
      <FormInput
        placeholder="Email address"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        returnKeyType="done"
      />

      <CategoryPicker
        label="Role"
        value={role}
        onChange={(value) => setRole((value || 'member') as InviteRole)}
        options={[...ROLE_OPTIONS]}
        placeholder="Select a role"
      />

      <Pressable style={styles.button} onPress={handleInvite} disabled={loading}>
        <Text style={styles.buttonText}>
          {loading ? 'Sending...' : 'Send Invite'}
        </Text>
      </Pressable>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: COLORS.primaryText,
    fontSize: 16,
    fontWeight: '600',
  },
});