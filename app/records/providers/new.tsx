import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { CategoryPicker } from "../../../components/category-picker";
import { PROVIDER_CATEGORIES } from "../../../constants/categories";
import {
  getMergedProviderCategories,
  saveCustomProviderCategory,
} from "../../../lib/categories";
import { getCurrentHouseholdId } from "../../../lib/household";
import { supabase } from "../../../lib/supabase";

export default function NewProviderScreen() {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [categoryOptions, setCategoryOptions] = useState<string[]>([
    ...PROVIDER_CATEGORIES,
  ]);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [isPreferred, setIsPreferred] = useState(false);
  const [loading, setLoading] = useState(false);

  const isOther = category === "Other";

  useEffect(() => {
    getMergedProviderCategories(PROVIDER_CATEGORIES).then(setCategoryOptions);
  }, []);

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert("Missing info", "Enter a provider name.");
      return;
    }

    if (isOther && !customCategory.trim()) {
      Alert.alert("Missing info", "Enter a custom category.");
      return;
    }

    try {
      setLoading(true);

      const householdId = await getCurrentHouseholdId();

      if (!householdId) {
        Alert.alert("No household", "Create a household first.");
        router.replace("/household/create");
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user;

      const finalCategory = isOther ? customCategory.trim() : category || null;

      const { error } = await supabase.from("providers").insert({
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
        Alert.alert("Save failed", error.message);
        return;
      }

      if (isOther && finalCategory) {
        await saveCustomProviderCategory(finalCategory, user?.id);
      }

      router.replace("/records/providers");
    } catch {
      Alert.alert("Error", "Something went wrong saving the provider.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <Text style={styles.title}>Add provider</Text>
      <Text style={styles.subtitle}>Save a trusted pro for your home.</Text>

      <TextInput
        style={styles.input}
        placeholder="Name"
        placeholderTextColor="#6B7280"
        value={name}
        onChangeText={setName}
      />

      <CategoryPicker
        label="Category"
        value={category}
        onChange={(value) => {
          setCategory(value);
          if (value !== "Other") setCustomCategory("");
        }}
        options={categoryOptions}
        placeholder="Select a provider type"
      />

      {isOther ? (
        <TextInput
          style={styles.input}
          placeholder="Enter custom category"
          placeholderTextColor="#6B7280"
          value={customCategory}
          onChangeText={setCustomCategory}
        />
      ) : null}

      <TextInput
        style={styles.input}
        placeholder="Phone"
        placeholderTextColor="#6B7280"
        value={phone}
        onChangeText={setPhone}
      />

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#6B7280"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />

      <TextInput
        style={[styles.input, styles.notesInput]}
        placeholder="Notes"
        placeholderTextColor="#6B7280"
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
          {loading ? "Saving..." : "Save Provider"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F6F2",
    padding: 24,
    justifyContent: "center",
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
  notesInput: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 12,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F1F1F",
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
