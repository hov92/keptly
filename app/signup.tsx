import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';

import { supabase } from '../lib/supabase';
import { AppScreen } from '../components/app-screen';
import { FormInput } from '../components/form-input';
import { COLORS, RADIUS } from '../constants/theme';

export default function SignupScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Missing info', 'Fill out all fields.');
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (error) {
        Alert.alert('Sign up failed', error.message);
        return;
      }

      const userId = data.user?.id;

      if (userId) {
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: userId,
          full_name: fullName.trim(),
        });

        if (profileError) {
          Alert.alert('Profile error', profileError.message);
          return;
        }
      }

      Alert.alert('Success', 'Account created. Please sign in.');
      router.replace('/login');
    } catch {
      Alert.alert('Error', 'Something went wrong creating your account.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppScreen>
      <Text style={styles.title}>Create account</Text>
      <Text style={styles.subtitle}>
        Start organizing your home with Keptly
      </Text>

      <FormInput
        placeholder="Full name"
        value={fullName}
        onChangeText={setFullName}
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
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        returnKeyType="done"
      />

      <Pressable style={styles.button} onPress={handleSignup} disabled={loading}>
        <Text style={styles.buttonText}>
          {loading ? 'Creating...' : 'Create Account'}
        </Text>
      </Pressable>

      <Pressable onPress={() => router.replace('/login')} style={styles.linkWrap}>
        <Text style={styles.link}>Already have an account? Sign in</Text>
      </Pressable>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.muted,
    marginBottom: 24,
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
  linkWrap: {
    marginTop: 24,
    alignItems: 'center',
  },
  link: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: '500',
  },
});