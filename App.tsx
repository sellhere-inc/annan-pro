import React, { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Platform, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useCircle } from './src/useCircle';
import { restoreNotifications, enableNotifications } from './src/notifications';
import { AuthScreen } from './src/AuthScreen';
import { MembershipScreen } from './src/MembershipScreen';
import { Dashboard } from './src/Dashboard';
import { color, s } from './src/ui';
export default function App() { return <SafeAreaProvider><Root /></SafeAreaProvider>; }
function Root() {
  const circle = useCircle();
  const [notificationsOn, setNotificationsOn] = useState(false);
  const userId = circle.profile?.user_id;
  useEffect(() => {
    let alive = true;
    setNotificationsOn(false);
    if (!userId) return;
    const restore = () => { void restoreNotifications().then(value => { if (alive) setNotificationsOn(value); }).catch(() => { if (alive) setNotificationsOn(false); }); };
    restore();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') { restore(); void circle.refresh().catch(() => {}); } });
    const onPush = () => { void circle.refresh().catch(() => {}); };
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', onPush);
    return () => { alive = false; listener.remove(); if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) navigator.serviceWorker.removeEventListener('message', onPush); };
  }, [userId, circle.refresh]);
  async function enable() { await enableNotifications(); setNotificationsOn(true); }
  return <SafeAreaView style={s.app}><StatusBar style="light" />
    {circle.loading ? <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 18 }}><Text style={s.brand}>Annan Pro</Text><ActivityIndicator color={color.muted} /></View>
      : !circle.profile ? <AuthScreen circle={circle} />
      : circle.profile.status !== 'approved' ? <MembershipScreen circle={circle} notificationsOn={notificationsOn} enable={enable} />
      : <Dashboard key={circle.profile.user_id + circle.profile.role} circle={circle} notificationsOn={notificationsOn} enable={enable} />}
  </SafeAreaView>;
}
