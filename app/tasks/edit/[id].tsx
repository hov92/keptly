import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { supabase } from '../../../lib/supabase';
import { CategoryPicker } from '../../../components/category-picker';
import { TASK_CATEGORIES } from '../../../constants/categories';
import {
  getMergedTaskCategories,
  saveCustomTaskCategory,
} from '../../../lib/categories';
import { AppScreen } from '../../../components/app-screen';
import { FormInput } from '../../../components/form-input';
import { DateField } from '../../../components/date-field';
import { FormScreenHeader } from '../../../components/form-screen-header';
import { COLORS, RADIUS } from '../../../constants/theme';

export default function EditTaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [categoryOptions, setCategoryOptions] = useState<string[]>([
    ...TASK_CATEGORIES,
  ]);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isOther = category === 'Other';

  useEffect(() => {
    getMergedTaskCategories(TASK_CATEGORIES).then(setCategoryOptions);
  }, []);

  useEffect(() => {
    async function loadTask() {
      const { data, error } = await supabase
        .from('tasks')
        .select('title, category, due_date')
        .eq('id', id)
        .single();

      if (error) {
        Alert.alert('Load failed', error.message);
        router.back();
        return;
      }

      const loadedCategory = data.category ?? '';
      const isPreset =
        loadedCategory === '' ||
        TASK_CATEGORIES.includes(
          loadedCategory as (typeof TASK_CATEGORIES)[number]
        );

      setTitle(data.title ?? '');
      setCategory(isPreset ? loadedCategory : 'Other');
      setCustomCategory(isPreset ? '' : loadedCategory);
      setDueDate(data.due_date ?? null);
      setLoading(false);
    }

    if (id) {
      loadTask();
    }
  }, [id]);

  async function handleSave() {
    if (!title.trim()) {
      Alert.alert('Missing info', 'Enter a task title.');
      return;
    }

    if (isOther && !customCategory.trim()) {
      Alert.alert('Missing info', 'Enter a custom category.');
      return;
    }

    try {
      setSaving(true);

      const finalCategory = isOther ? customCategory.trim() : category || null;

      const { error } = await supabase
        .from('tasks')
        .update({
          title: title.trim(),
          category: finalCategory,
          due_date: dueDate,
        })
        .eq('id', id);

      if (error) {
        Alert.alert('Save failed', error.message);
        return;
      }

      if (isOther && finalCategory) {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        await saveCustomTaskCategory(finalCategory, session?.user?.id);
      }

      router.replace(`/tasks/${id}`);
    } catch {
      Alert.alert('Error', 'Something went wrong saving the task.');
    } finally {
      setSaving(false);
    }
  }

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
        title="Edit task"
        subtitle="Update your household task."
      />

      <FormInput
        placeholder="Task title"
        value={title}
        onChangeText={setTitle}
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
        placeholder="Select a category"
      />

      {isOther ? (
        <FormInput
          placeholder="Enter custom category"
          value={customCategory}
          onChangeText={setCustomCategory}
          returnKeyType="done"
        />
      ) : null}

      <DateField label="Due date" value={dueDate} onChange={setDueDate} />

      <Pressable style={styles.button} onPress={handleSave} disabled={saving}>
        <Text style={styles.buttonText}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Text>
      </Pressable>
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