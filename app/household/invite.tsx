import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';

import { AppScreen } from '../../components/app-screen';
import { FormInput } from '../../components/form-input';
import { FormScreenHeader } from '../../components/form-screen-header';
import { CategoryPicker } from '../../components/category-picker';
import { COLORS, RADIUS } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { createHouseholdInvite } from '../../lib/household-invites';
import { getActiveHouseholdPermissions } from '../../lib/permissions';

const ROLE_OPTIONS = ['owner', 'member', 'child'] as const;

export default function HouseholdInviteScreen() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'owner' | 'member' | 'child'>('member');
  const [sending, setSending] = useState(false);
  const [canInvite, setCanInvite] = useState<boolean | null>(null);

  useEffect(() => {
    getActiveHouseholdPermissions()
      .then((permissions) => {
        setCanInvite(permissions.canInviteMembers);
        if (!permissions.canInviteMembers) {
          Alert.alert(
            'Restricted',
            'Your role does not allow inviting household members.'
          );
          router.back();
        }
      })
      .catch(console.error);
  }, []);

  async function handleSendInvite() {
    const trimmed = email.trim().toLowerCase();

    if (!trimmed) {
      Alert.alert('Missing info', 'Enter an email address.');
      return;
    }

    if (!canInvite) {
      Alert.alert('Restricted', 'You cannot invite household members.');
      return;
    }

    try {
      setSending(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const myEmail = session?.user?.email?.toLowerCase();

      if (myEmail && trimmed === myEmail) {
        Alert.alert('Invalid invite', 'You cannot invite yourself.');
        return;
      }

      await createHouseholdInvite({
        email: trimmed,
        role,
        userId: session?.user?.id,
      });

      Alert.alert('Invite sent', 'The household invite has been created.');
      router.back();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not send invite.';
      Alert.alert('Invite failed', message);
    } finally {
      setSending(false);
    }
  }

  if (canInvite === null) {
    return null;
  }

  return (
    <AppScreen>
      <FormScreenHeader
        title="Invite household member"
        subtitle="Invite someone to join your household."
      />

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
        onChange={(value) =>
          setRole((value || 'member') as 'owner' | 'member' | 'child')
        }
        options={ROLE_OPTIONS}
        placeholder="Select a role"
      />

      <Pressable style={styles.button} onPress={handleSendInvite} disabled={sending}>
        <Text style={styles.buttonText}>
          {sending ? 'Sending...' : 'Send Invite'}
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