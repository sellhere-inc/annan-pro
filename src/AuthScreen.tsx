import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Field, s } from './ui';
import { useCircle } from './useCircle';
type Circle = ReturnType<typeof useCircle>;
export function AuthScreen({ circle }: { circle: Circle }) {
  const [register, setRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      if (register) {
        const result = await circle.register(name, email, password);
        if (result) { setMessage(result); setRegister(false); }
      } else await circle.login(email, password);
      setPassword('');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={s.header}><Text style={s.brand}>Annan Pro</Text><Text style={s.caption}>Members only</Text></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
      <View style={{ width: '100%', maxWidth: 400, alignSelf: 'center', gap: 24, paddingVertical: 48 }}>
        <View style={{ gap: 12 }}><Text style={s.title}>{register ? 'Create your account.' : 'Sign in.'}</Text><Text style={s.muted}>{register ? 'Register, submit your payment, and wait for admin approval.' : 'Use your Annan Pro account to continue.'}</Text></View>
        {register && <Field label="Full name" value={name} onChangeText={setName} autoComplete="name" maxLength={60} />}
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete={register ? 'new-password' : 'current-password'} onSubmitEditing={submit} />
        {register && <Text style={s.caption}>Use at least 8 characters. An admin must approve your account before you can see the people list.</Text>}
        {!!(error || circle.error) && <Text accessibilityRole="alert" style={s.error}>{error || circle.error}</Text>}
        {!!message && <Text accessibilityRole="alert" style={s.body}>{message}</Text>}
        {!circle.configured && <Text style={s.error}>Service unavailable. The administrator needs to complete the server setup.</Text>}
        <Button title={busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'} disabled={busy || !circle.configured || !email || !password} onPress={submit} />
        <Pressable disabled={busy} accessibilityRole="button" onPress={() => { setRegister(!register); setError(''); setMessage(''); }} style={[s.linkButton, { alignItems: 'center' }]}><Text style={s.link}>{register ? 'Already registered? Sign in' : 'New here? Create an account'}</Text></Pressable>
        <Text style={[s.caption, { textAlign: 'center' }]}>iPhone: add this website to your Home Screen for notifications.</Text>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}
