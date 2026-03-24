import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CategoryPicker } from "../../components/category-picker";
import { TASK_CATEGORIES } from "../../constants/categories";
import {
  getMergedTaskCategories,
  saveCustomTaskCategory,
} from "../../lib/categories";
import { getCurrentHouseholdId } from "../../lib/household";
import { supabase } from "../../lib/supabase";

function toYMD(date: Date) {
  return date.toISOString().slice(0, 10);
}

function fromYMD(value: string) {
  return new Date(`${value}T12:00:00`);
}

function formatDateLabel(value: string | null) {
  if (!value) return "No date selected";
  return fromYMD(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function NewTaskScreen() {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [categoryOptions, setCategoryOptions] = useState<string[]>([
    ...TASK_CATEGORIES,
  ]);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const pickerValue = useMemo(() => {
    return dueDate ? fromYMD(dueDate) : new Date();
  }, [dueDate]);

  const isOther = category === "Other";

  useEffect(() => {
    getMergedTaskCategories(TASK_CATEGORIES).then(setCategoryOptions);
  }, []);

  function openDatePicker() {
    Keyboard.dismiss();
    setShowPicker(true);
  }

  function onDateChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS === "android") {
      setShowPicker(false);
    }

    if (event.type === "dismissed") {
      return;
    }

    if (selectedDate) {
      setDueDate(toYMD(selectedDate));
    }
  }

  async function handleCreateTask() {
    if (!title.trim()) {
      Alert.alert("Missing info", "Enter a task title.");
      return;
    }

    if (isOther && !customCategory.trim()) {
      Alert.alert("Missing info", "Enter a custom category.");
      return;
    }

    try {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user;
      if (!user) {
        Alert.alert("Auth error", "You are not signed in.");
        router.replace("/login");
        return;
      }

      const householdId = await getCurrentHouseholdId();

      if (!householdId) {
        Alert.alert("No household", "Create a household first.");
        router.replace("/household/create");
        return;
      }

      const finalCategory = isOther ? customCategory.trim() : category || null;

      const { error } = await supabase.from("tasks").insert({
        household_id: householdId,
        title: title.trim(),
        category: finalCategory,
        due_date: dueDate,
        created_by: user.id,
      });

      if (error) {
        Alert.alert("Create failed", error.message);
        return;
      }

      if (isOther && finalCategory) {
        await saveCustomTaskCategory(finalCategory, user.id);
      }

      router.back();
    } catch {
      Alert.alert("Error", "Something went wrong creating the task.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <Text style={styles.title}>Add task</Text>
        <Text style={styles.subtitle}>Create a task for your household.</Text>

        <TextInput
          style={styles.input}
          placeholder="Task title"
          placeholderTextColor="#6B7280"
          value={title}
          onChangeText={setTitle}
          returnKeyType="done"
        />

        <CategoryPicker
          label="Category"
          value={category}
          onChange={(value) => {
            setCategory(value);
            if (value !== "Other") setCustomCategory("");
          }}
          options={categoryOptions}
          placeholder="Select a category"
        />

        {isOther ? (
          <TextInput
            style={styles.input}
            placeholder="Enter custom category"
            placeholderTextColor="#6B7280"
            value={customCategory}
            onChangeText={setCustomCategory}
            returnKeyType="done"
          />
        ) : null}

        <Text style={styles.label}>Due date</Text>

        <Pressable style={styles.dateButton} onPress={openDatePicker}>
          <Text style={styles.dateButtonText}>{formatDateLabel(dueDate)}</Text>
        </Pressable>

        {dueDate ? (
          <Pressable onPress={() => setDueDate(null)} style={styles.clearLink}>
            <Text style={styles.clearLinkText}>Clear date</Text>
          </Pressable>
        ) : null}

        {showPicker ? (
          <ScrollView
            horizontal={false}
            scrollEnabled={false}
            contentContainerStyle={styles.pickerOuter}
          >
            <SafeAreaView edges={[]}>
              <Pressable style={styles.pickerWrap}>
                <DateTimePicker
                  value={pickerValue}
                  mode="date"
                  display={Platform.OS === "ios" ? "inline" : "default"}
                  onChange={onDateChange}
                  themeVariant="light"
                  accentColor="#264653"
                  textColor="#1F1F1F"
                />
              </Pressable>
            </SafeAreaView>
          </ScrollView>
        ) : null}

        <Pressable
          style={styles.button}
          onPress={handleCreateTask}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Saving..." : "Save Task"}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8F6F2",
  },
  container: {
    padding: 24,
    paddingTop: 8,
    paddingBottom: 40,
  },
  backButton: {
    marginBottom: 20,
  },
  backText: {
    color: "#2A9D8F",
    fontSize: 16,
    fontWeight: "600",
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    color: "#1F1F1F",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#5F6368",
    marginBottom: 24,
  },
  input: {
    backgroundColor: "#FFFFFF",
    color: "#1F1F1F",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E6E0D8",
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F1F1F",
    marginBottom: 10,
  },
  dateButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E6E0D8",
  },
  dateButtonText: {
    color: "#1F1F1F",
    fontSize: 16,
  },
  clearLink: {
    marginBottom: 12,
  },
  clearLinkText: {
    color: "#2A9D8F",
    fontSize: 14,
    fontWeight: "600",
  },
  pickerOuter: {
    marginBottom: 12,
  },
  pickerWrap: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: "#E6E0D8",
  },
  button: {
    backgroundColor: "#264653",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
