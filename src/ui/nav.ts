import { router } from 'expo-router';

/** Closes a form. Falls back to Home when the screen was opened directly (deep link, web URL). */
export function goBack(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
