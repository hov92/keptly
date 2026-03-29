import { router } from 'expo-router';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';

export function smartBack(
  navigation: NavigationProp<ParamListBase>,
  fallback = '/(tabs)'
) {
  if (navigation.canGoBack()) {
    navigation.goBack();
    return;
  }

  router.replace(fallback);
}