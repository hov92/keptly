import { useCallback, useState } from 'react';
import { Tabs, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { getActiveHouseholdPermissions } from '../../lib/permissions';

export default function TabsLayout() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'owner' | 'member' | 'child' | null>(null);

  async function loadPermissions() {
    try {
      setLoading(true);
      const permissions = await getActiveHouseholdPermissions();
      setRole(permissions.role);
    } catch (error) {
      console.error(error);
      setRole(null);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadPermissions();
    }, [])
  );

  if (loading) {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#264653',
        tabBarInactiveTintColor: '#7A7F87',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E8E3DA',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkmark-circle-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="records"
        options={{
          href: role === 'child' ? null : undefined,
          title: 'Records',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="folder-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}