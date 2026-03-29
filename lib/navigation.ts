import { router, type Href } from 'expo-router';

type BackCapableNavigation = {
  canGoBack: () => boolean;
  goBack: () => void;
};

export function smartBack(params: {
  navigation: BackCapableNavigation;
  returnTo?: string | null;
  fallback?: Href;
}) {
  const { navigation, returnTo, fallback = '/tasks' } = params;

  if (returnTo) {
    router.replace(returnTo as Href);
    return;
  }

  if (navigation.canGoBack()) {
    navigation.goBack();
    return;
  }

  router.replace(fallback);
}