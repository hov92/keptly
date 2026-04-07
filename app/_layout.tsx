import { Stack, router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { Session } from '@supabase/supabase-js';

import {
  configureNotificationChannel,
  ensureNotificationPermissions,
  handleInitialNotificationRoute,
  setupNotificationRouting,
} from '../lib/notifications';
import { refreshAllHouseholdNotifications } from '../lib/notification-polish';
import { supabase } from '../lib/supabase';

function getRouteFallback(routeName: string): Href {
  if (routeName.startsWith('household/')) return '/profile';
  if (routeName.startsWith('tasks/')) return '/tasks';
  if (routeName.startsWith('records/')) return '/records';
  if (routeName.startsWith('shopping/')) return '/(tabs)/shopping';
  return '/profile';
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    configureNotificationChannel().catch(console.error);
    ensureNotificationPermissions().catch(console.error);
  }, []);

  useEffect(() => {
    if (!session) return;
    refreshAllHouseholdNotifications().catch(console.error);
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session) return;

    const cleanup = setupNotificationRouting((href) => {
      router.push(href);
    });

    handleInitialNotificationRoute((href) => {
      router.push(href);
    }).catch(console.error);

    return cleanup;
  }, [session?.user?.id]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('Error getting session:', error.message);
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
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F8F6F2',
        }}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={({ route }) => {
        const isTabsScreen = route.name === '(tabs)';

        const returnTo =
          typeof route.params === 'object' &&
          route.params &&
          'returnTo' in route.params &&
          typeof route.params.returnTo === 'string'
            ? (route.params.returnTo as Href)
            : null;

        const fallback = getRouteFallback(route.name);

        return {
          headerTintColor: '#264653',
          headerShadowVisible: false,
          headerStyle: {
            backgroundColor: '#F8F6F2',
          },
          headerTitleStyle: {
            color: '#1F1F1F',
            fontWeight: '700',
          },
          contentStyle: {
            backgroundColor: '#F8F6F2',
          },
          headerLeft: isTabsScreen
            ? undefined
            : () => (
                <Pressable
                  onPress={() => {
                    if (returnTo) {
                      router.replace(returnTo);
                      return;
                    }

                    router.replace(fallback);
                  }}
                  style={{ paddingRight: 8, paddingVertical: 4 }}
                >
                  <Text
                    style={{
                      color: '#264653',
                      fontSize: 16,
                      fontWeight: '600',
                    }}
                  >
                    Back
                  </Text>
                </Pressable>
              ),
        };
      }}
    >
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        <Stack.Screen name="search" options={{ title: 'Search' }} />

        <Stack.Screen name="household/create" options={{ title: 'Create household' }} />
        <Stack.Screen name="household/edit" options={{ title: 'Edit household' }} />
        <Stack.Screen name="household/invite" options={{ title: 'Invite member' }} />
        <Stack.Screen name="household/invites" options={{ title: 'Household invites' }} />
        <Stack.Screen name="household/members" options={{ title: 'Household members' }} />
        <Stack.Screen name="household/switch" options={{ title: 'Switch household' }} />
        <Stack.Screen name="household/activity" options={{ title: 'Household activity' }} />

        <Stack.Screen name="tasks/new" options={{ title: 'Add task' }} />
        <Stack.Screen name="tasks/[id]" options={{ title: 'Task details' }} />
        <Stack.Screen name="tasks/edit/[id]" options={{ title: 'Edit task' }} />

        <Stack.Screen name="records/providers/new" options={{ title: 'Add provider' }} />
        <Stack.Screen name="records/providers/index" options={{ title: 'Providers' }} />
        <Stack.Screen
          name="records/providers/[id]/index"
          options={{ title: 'Provider details' }}
        />
        <Stack.Screen
          name="records/providers/[id]/new-service"
          options={{ title: 'Add service record' }}
        />
        <Stack.Screen
          name="records/service-records/edit/[id]"
          options={{ title: 'Edit service record' }}
        />
        <Stack.Screen
          name="records/service-records/[id]"
          options={{ title: 'Service record' }}
        />

        <Stack.Screen name="shopping/new" options={{ title: 'Add item' }} />
        <Stack.Screen name="shopping/[id]" options={{ title: 'Item details' }} />
        <Stack.Screen name="shopping/recurring" options={{ title: 'Recurring items' }} />
        <Stack.Screen name="shopping/recurring-new" options={{ title: 'New recurring item' }} />
        <Stack.Screen name="shopping/pantry" options={{ title: 'Pantry' }} />
        <Stack.Screen name="shopping/pantry-new" options={{ title: 'New pantry item' }} />
        <Stack.Screen name="shopping/lists" options={{ title: 'Lists' }} />
        <Stack.Screen name="shopping/lists/new" options={{ title: 'New list' }} />
        <Stack.Screen name="shopping/lists/[id]" options={{ title: 'Edit list' }} />
        <Stack.Screen
          name="shopping/duplicates"
          options={{ title: 'Resolve duplicates' }}
        />
      </Stack.Protected>
    </Stack>
  );
}