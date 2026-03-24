import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "../lib/supabase";

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("Error getting session:", error.message);
      }

      if (mounted) {
        setSession(data.session ?? null);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F8F6F2",
        }}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
      </Stack.Protected>

      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="household/create" />
        <Stack.Screen name="tasks/new" />
        <Stack.Screen name="tasks/[id]" />
        <Stack.Screen name="tasks/edit/[id]" />
        <Stack.Screen name="records/providers/index" />
        <Stack.Screen name="records/providers/new" />
        <Stack.Screen name="records/providers/[id]" />
        <Stack.Screen name="records/providers/[id]/new-service" />
        <Stack.Screen name="records/service-records/edit/[id]" />
        <Stack.Screen name="household/invites" />
        <Stack.Screen name="household/invite" />
        <Stack.Screen name="household/members" />
      </Stack.Protected>
    </Stack>
  );
}
