import { Alert, Platform, Share } from 'react-native';
import * as Linking from 'expo-linking';

export function getGroupInviteUrl(groupId: string): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    return `${window.location.origin}/join?group=${encodeURIComponent(groupId)}`;
  }
  return Linking.createURL('join', {
    queryParams: { group: groupId },
  });
}

export async function shareGroupInvite(groupId: string, groupName: string): Promise<boolean> {
  const url = getGroupInviteUrl(groupId);
  const title = `Join ${groupName} on FairShare`;
  const message = `Join "${groupName}" on FairShare:\n${url}`;

  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        window.alert(`Invite Link Copied!\n\nShare this link to let others join "${groupName}":\n\n${url}`);
        return true;
      } catch {
        // Fallback below
      }
    }

    if (typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function') {
      try {
        await (navigator as any).share({ title, text: message, url });
        return true;
      } catch {
        // Cancelled or unsupported
      }
    }

    if (typeof window !== 'undefined') {
      window.prompt(`Copy this link to invite members to "${groupName}":`, url);
      return true;
    }

    return false;
  }

  try {
    const result = await Share.share({
      title,
      message,
      url,
    });
    return result.action !== Share.dismissedAction;
  } catch (error: any) {
    Alert.alert('Unable to share invite', error?.message || 'Could not open share menu.');
    return false;
  }
}

