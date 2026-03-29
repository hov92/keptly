import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { getNoHouseholdRoute } from '../../../lib/no-household-route';
import { supabase } from '../../../lib/supabase';
import { getCurrentHouseholdId } from '../../../lib/household';
import { CategoryPicker } from '../../../components/category-picker';
import { PROVIDER_CATEGORIES } from '../../../constants/categories';
import {
  getMergedProviderCategories,
  saveCustomProviderCategory,
} from '../../../lib/categories';
import { AppScreen } from '../../../components/app-screen';
import { FormInput } from '../../../components/form-input';
import { COLORS, RADIUS, SPACING } from '../../../constants/theme';
import { getActiveHouseholdPermissions } from '../../../lib/permissions';

export default function NewProviderScreen() {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [categoryOptions, setCategoryOptions] = useState<string[]>([
    ...PROVIDER_CATEGORIES,
  ]);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [isPreferred, setIsPreferred] = useState(false);
  const [loading, setLoading] = useState(false);
  const [canManageProviders, setCanManageProviders] = useState<boolean | null>(null);

  const isOther = category === 'Other';

  useEffect(() => {
    getMergedProviderCategories(PROVIDER_CATEGORIES).then(setCategoryOptions);

    getActiveHouseholdPermissions()
      .then((permissions) => {
        setCanManageProviders(permissions.canManageProviders);
        if (!permissions.canManageProviders) {
          Alert.alert(
            'Restricted',
            'Your role does not allow creating providers.'
          );
          router.back();
        }
      })
      .catch(console.error);
  }, []);

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Missing info', 'Enter a provider name.');
      return;
    }

    if (isOther && !customCategory.trim()) {
      Alert.alert('Missing info', 'Enter a custom category.');
      return;
    }

    if (!canManageProviders) {
      Alert.alert('Restricted', 'You cannot create providers.');
      return;
    }

    try {
      setLoading(true);

      const householdId = await getCurrentHouseholdId();

      if (!householdId || householdId === 'null' || householdId === 'undefined') {
        const route = await getNoHouseholdRoute();
        router.replace(route);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user;

      const finalCategory = isOther ? customCategory.trim() : category || null;

      const { error } = await supabase.from('providers').insert({
        household_id: householdId,
        name: name.trim(),
        category: finalCategory,
        phone: phone.trim() || null,
        email: email.trim() || null,
        notes: notes.trim() || null,
        is_preferred: isPreferred,
        created_by: user?.id ?? null,
      });

      if (error) {
        Alert.alert('Save failed', error.message);
        return;
      }

      if (isOther && finalCategory) {
        await saveCustomProviderCategory(finalCategory, user?.id);
      }

      router.back();
    } catch {
      Alert.alert('Error', 'Something went wrong saving the provider.');
    } finally {
      setLoading(false);
    }
  }

  if (canManageProviders === null) {
    return null;
  }

  return (
    <AppScreen>
      <FormInput
        placeholder="Name"
        value={name}
        onChangeText={setName}
        returnKeyType="done"
      />

      <CategoryPicker
        label="Category"
        value={category}
        onChange={(value) => {
          setCategory(value);
          if (value !== 'Other') setCustomCategory('');
        }}
        options={categoryOptions}
        placeholder="Select a provider type"
      />

      {isOther ? (
        <FormInput
          placeholder="Enter custom category"
          value={customCategory}
          onChangeText={setCustomCategory}
          returnKeyType="done"
        />
      ) : null}

      <FormInput
        placeholder="Phone"
        value={phone}
        onChangeText={setPhone}
        returnKeyType="done"
      />

      <FormInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        returnKeyType="done"
      />

      <FormInput
        placeholder="Notes"
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Preferred provider</Text>
        <Switch value={isPreferred} onValueChange={setIsPreferred} />
      </View>

      <Pressable style={styles.button} onPress={handleSave} disabled={loading}>
        <Text style={styles.buttonText}>
          {loading ? 'Saving...' : 'Save Provider'}
        </Text>
      </Pressable>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: SPACING.sm,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
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