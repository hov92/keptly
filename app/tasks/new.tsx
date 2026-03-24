import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';

import { supabase } from '../../lib/supabase';
import { getCurrentHouseholdId } from '../../lib/household';
import { CategoryPicker } from '../../components/category-picker';
import { AssigneePicker } from '../../components/assignee-picker';
import { TASK_CATEGORIES } from '../../constants/categories';
import {
  getMergedTaskCategories,
  saveCustomTaskCategory,
} from '../../lib/categories';
import { getHouseholdMemberOptions } from '../../lib/household-members';
import { AppScreen } from '../../components/app-screen';
import { FormInput } from '../../components/form-input';
import { DateField } from '../../components/date-field';
import { FormScreenHeader } from '../../components/form-screen-header';
import { COLORS, RADIUS } from '../../constants/theme';

type AssigneeOption = {
  label: string;
  value: string;
};

export default function NewTaskScreen() {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [categoryOptions, setCategoryOptions] = useState<string[]>([
    ...TASK_CATEGORIES,
  ]);
  const [assigneeOptions, setAssigneeOptions] = useState<AssigneeOption[]>([]);
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isOther = category === 'Other';

  useEffect(() => {
    getMergedTaskCategories(TASK_CATEGORIES).then(setCategoryOptions);
    getHouseholdMemberOptions().then(setAssigneeOptions).catch(console.error);
  }, []);

  async function handleCreateTask() {
    if (!title.trim()) {
      Alert.alert('Missing info', 'Enter a task title.');
      return;
    }

    if (isOther && !customCategory.trim()) {
      Alert.alert('Missing info', 'Enter a custom category.');
      return;
    }

    try {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user;
      if (!user) {
        Alert.alert('Auth error', 'You are not signed in.');
        router.replace('/login');
        return;
      }

      const householdId = await getCurrentHouseholdId();

      if (!householdId) {
        Alert.alert('No household', 'Create a household first.');
        router.replace('/household/create');
        return;
      }

      const finalCategory = isOther ? customCategory.trim() : category || null;

      const { error } = await supabase.from('tasks').insert({
        household_id: householdId,
        title: title.trim(),
        category: finalCategory,
        due_date: dueDate,
        assigned_to: assignedTo || null,
        created_by: user.id,
      });

      if (error) {
        Alert.alert('Create failed', error.message);
        return;
      }

      if (isOther && finalCategory) {
        await saveCustomTaskCategory(finalCategory, user.id);
      }

      router.back();
    } catch {
      Alert.alert('Error', 'Something went wrong creating the task.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppScreen>
      <FormScreenHeader
        title="Add task"
        subtitle="Create a task for your household."
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

      <AssigneePicker
        label="Assign to"
        value={assignedTo}
        onChange={setAssignedTo}
        options={assigneeOptions}
        placeholder="Unassigned"
      />

      <DateField label="Due date" value={dueDate} onChange={setDueDate} />

      <Pressable
        style={styles.button}
        onPress={handleCreateTask}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Saving...' : 'Save Task'}
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