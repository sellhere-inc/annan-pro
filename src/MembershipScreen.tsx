import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Field, Icon, color, s } from './ui';
import { payment, paymentUrl } from './payment';
import { useCircle } from './useCircle';
type Circle = ReturnType<typeof useCircle>;
export function MembershipScreen({ circle, notificationsOn, enable }: { circle: Circle; notificationsOn: boolean; enable: () => Promise<void> }) {
  const me = circle.profile!;
  const pending = me.status === 'pending';
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run(fn: () => Promise<unknown>) { setBusy(true); setError(''); try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <>
    <View style={s.header}><Text style={s.brand}>Annan Pro</Text><Pressable disabled={busy} accessibilityRole="button" onPress={() => run(circle.logout)} style={s.linkButton}><Text style={s.link}>Sign out</Text></Pressable></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, flexGrow: 1, justifyContent: 'center' }}>
      <View style={{ maxWidth: 440, width: '100%', alignSelf: 'center', gap: 24, paddingVertical: 36 }}>
        <Text style={s.caption}>{pending ? '03 / ADMIN REVIEW' : '02 / MEMBERSHIP PAYMENT'}</Text>
        <Text style={s.title}>{pending ? 'Waiting for confirmation.' : 'Pay with GPay.'}</Text>
        <Text style={s.muted}>{pending ? 'Your payment reference has been submitted. You’ll be notified once an admin approves your account.' : 'Make your membership payment, then enter the transaction reference below.'}</Text>
        {me.status === 'rejected' && <View style={s.panel}><Text style={s.label}>Payment needs another look</Text><Text style={s.body}>{me.rejection_reason}</Text><Text style={s.caption}>Check the details and submit a corrected reference.</Text></View>}
        {pending ? <View style={s.panel}><View style={s.between}><Text style={s.muted}>Account</Text><Text style={[s.body, { flex: 1, textAlign: 'right' }]}>{me.full_name}</Text></View><View style={s.between}><Text style={s.muted}>Reference</Text><Text selectable style={s.body}>{me.payment_reference}</Text></View><View style={s.separator} /><View style={s.row}><Icon name="clock" size={17} color={color.muted} /><Text style={s.muted}>Pending admin review</Text></View></View> : <>
          <View style={s.panel}><Text style={s.caption}>MEMBERSHIP</Text><Text style={[s.title, { fontSize: 48, lineHeight: 58 }]}>{payment.amount ? '₹' + payment.amount : 'Amount not set'}</Text><Text style={s.body}>{payment.recipient || 'Recipient not configured'}</Text><Text selectable style={s.muted}>{payment.upiId || 'Contact the admin for payment details.'}</Text><Button title="Open payment app" disabled={busy || !payment.upiId || !payment.amount} onPress={() => run(async () => { const url = paymentUrl(); try { await Linking.openURL(url); } catch { throw new Error('Open GPay manually and pay the UPI ID shown above.'); } })} /><Text style={s.caption}>Use GPay or another UPI app. Returning here does not confirm payment.</Text></View>
          <Field label="UPI transaction reference" placeholder="12-digit reference" keyboardType="number-pad" maxLength={12} value={reference} onChangeText={setReference} />
          <Text style={s.caption}>Find this in your GPay transaction details. Only an admin can verify the payment and approve access.</Text>
          <Button title={busy ? 'Submitting…' : 'Submit for approval'} disabled={busy || !/^\d{12}$/.test(reference) || !payment.upiId || !payment.amount} onPress={() => run(() => circle.submitPayment(reference))} />
        </>}
        <View style={s.separator} />
        <View style={{ gap: 12 }}><Text style={s.heading}>Get your approval alert.</Text><Text style={s.muted}>On iPhone, open this site in Safari → Share → Add to Home Screen. Launch Annan Pro from the new icon, sign in, and enable notifications.</Text><Button title={notificationsOn ? 'Notifications enabled' : 'Enable notifications'} secondary disabled={busy} onPress={() => run(enable)} /><Text style={s.caption}>Free Web Push. iOS 16.4 or later. No App Store download required.</Text></View>
        {pending && <Button title="Check approval status" secondary disabled={busy} onPress={() => run(circle.refresh)} />}
        {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      </View>
    </ScrollView>
  </>;
}
