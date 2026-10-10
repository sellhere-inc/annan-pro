import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './client';
import { enableWebPush, restoreWebPush, unregisterWebPush } from './webPush';
const TOKEN_KEY = 'annan-pro-push-token';
export async function restoreNotifications() {
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return false;
  if (Platform.OS === 'web') return restoreWebPush();
  if (Constants.appOwnership === 'expo' || !Device.isDevice) return false;
  const Notifications = await import('expo-notifications');
  Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }) });
  if (!(await Notifications.getPermissionsAsync()).granted) return false;
  await enableNotifications();
  return true;
}
export async function enableNotifications() {
  if (!supabase) throw new Error('Annan Pro is not configured.');
  if (Platform.OS === 'web') return enableWebPush();
  if (Constants.appOwnership === 'expo') throw new Error('For free alerts, open the web app in Safari, add it to your Home Screen, and enable notifications there.');
  if (!Device.isDevice) throw new Error('Enable notifications on a physical phone.');
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('Sign in first.');
  const Notifications = await import('expo-notifications');
  Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }) });
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('status-updates', { name: 'Annan Pro updates', importance: Notifications.AndroidImportance.HIGH });
  if (!(await Notifications.requestPermissionsAsync()).granted) throw new Error('Allow notifications in your phone settings and try again.');
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new Error('Native push is not configured. Use the Home Screen web app for free alerts.');
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const { error } = await supabase.rpc('register_push_token', { p_token: token });
  if (error) throw error;
  await AsyncStorage.setItem(TOKEN_KEY, token);
  return token;
}
export async function unregisterNotifications() {
  if (!supabase) return;
  if (Platform.OS === 'web') return unregisterWebPush();
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) return;
  const { error } = await supabase.rpc('unregister_push', { p_token: token });
  if (error) throw new Error('Could not disconnect notifications. Reconnect and try signing out again.');
  await AsyncStorage.removeItem(TOKEN_KEY);
}
