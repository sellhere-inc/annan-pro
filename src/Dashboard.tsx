import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useCircle } from './useCircle';
import { Comment, Person, Profile, sortPeople, timeAgo } from './model';
import { Button, color, Field, Icon, s, State } from './ui';
type Circle = ReturnType<typeof useCircle>;
export function Dashboard({ circle, notificationsOn, enable }: { circle: Circle; notificationsOn: boolean; enable: () => Promise<void> }) {
  const [tab, setTab] = useState<'people' | 'activity' | 'members'>('people');
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<'edit' | 'add' | 'review' | 'delete' | 'account' | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [member, setMember] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState<Comment | null>(null);
  const [mode, setMode] = useState('Comment');
  const [count, setCount] = useState('1');
  const [body, setBody] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'member' | 'annan'>('member');
  const [verified, setVerified] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const me = circle.profile!;
  const pending = circle.members.filter(m => m.status === 'pending');
  const sorted = sortPeople(circle.people).filter(p => p.name.toLowerCase().includes(query.toLowerCase()) && (filter === 'All' || p.is_on === (filter === 'On')));
  const delta = mode === 'Comment' ? 0 : (mode === 'Reduce' ? -1 : 1) * Number(count);
  const total = (person?.negative_points || 0) + delta;
  function open(next: typeof modal) { setError(''); setModal(next); }
  function edit(p: Person) { setPerson(p); setMode('Comment'); setCount('1'); setBody(''); open('edit'); }
  function review(p: Profile) { setMember(p); setRole(p.role === 'annan' ? 'annan' : 'member'); setVerified(false); setRejecting(false); setBody(''); open('review'); }
  async function run(fn: () => Promise<unknown>, close = true) {
    if (busy) return;
    setBusy(true); setError('');
    try { await fn(); if (close) setModal(null); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function refresh() { setRefreshing(true); try { await circle.refresh(); } catch {} finally { setRefreshing(false); } }
  function segment(values: string[], value: string, change: (value: string) => void) {
    return <View style={s.pills}>{values.map(item => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: value === item }} onPress={() => change(item)} style={[s.pill, { flex: 1 }, value === item && s.selectedPill]}><Text style={[s.label, { fontWeight: value === item ? '600' : '400', fontSize: 14 }]}>{item}</Text></Pressable>)}</View>;
  }
  return <>
    <View style={s.header}><Text style={s.brand}>Annan Pro</Text><Pressable accessibilityRole="button" accessibilityLabel="Account and notifications" onPress={() => open('account')} style={s.iconButton}><Icon name="user" size={20} /></Pressable></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={color.muted} />}>
      <View style={{ paddingTop: 36, paddingBottom: 28, gap: 12 }}>
        <View style={s.between}><Text style={s.title}>{tab === 'people' ? 'People' : tab === 'activity' ? 'Activity' : 'Members'}</Text>{tab === 'people' && circle.admin && <Pressable accessibilityRole="button" accessibilityLabel="Add person" onPress={() => { setName(''); open('add'); }} style={s.iconButton}><Icon name="plus" color={color.blue} /></Pressable>}</View>
        <Text style={s.muted}>{tab === 'people' ? circle.people.length + ' people · ' + circle.people.filter(p => !p.is_on).length + ' off' : tab === 'activity' ? 'Status changes and comments.' : pending.length + ' awaiting approval'}</Text>
      </View>
      {!!circle.notice && <View style={[s.panel, { marginBottom: 24, padding: 16, flexDirection: 'row', alignItems: 'center' }]}><Text accessibilityRole="alert" style={[s.body, { flex: 1 }]}>{circle.notice}</Text><Pressable accessibilityRole="button" accessibilityLabel="Dismiss notification" onPress={() => circle.setNotice('')} style={s.iconButton}><Icon name="x" /></Pressable></View>}
      {tab === 'people' && <>
        <View style={{ gap: 16, marginBottom: 24 }}><Field label="Search people" placeholder="Name" value={query} onChangeText={setQuery} />{segment(['All', 'On', 'Off'], filter, setFilter)}<Text style={s.caption}>Highest violations first</Text></View>
        {sorted.map(p => {
          const comments = circle.comments.filter(c => c.person_id === p.id);
          return <View key={p.id} style={{ paddingVertical: 24, borderTopWidth: 1, borderColor: color.line }}>
            <View style={s.between}><View style={{ flex: 1, gap: 9 }}><Text style={s.heading}>{p.name}</Text><View style={[s.row, { gap: 16 }]}><State on={p.is_on} /><Text style={s.caption}>{p.negative_points} {p.negative_points === 1 ? 'violation' : 'violations'}</Text></View></View>{circle.canEdit && <Pressable accessibilityRole="button" accessibilityLabel={'Manage ' + p.name} onPress={() => edit(p)} style={s.iconButton}><Icon name="more-horizontal" color={color.blue} /></Pressable>}</View>
            {comments.length > 0 ? <View style={{ marginTop: 24, paddingLeft: 16, borderLeftWidth: 1, borderColor: color.line, gap: 22 }}>{comments.map(c => <View key={c.id} style={{ gap: 7 }}><View style={s.between}><Text style={[s.caption, { flex: 1 }]}>{c.author_name} · {c.author_role === 'annan' ? 'Annan' : 'Admin'} · {timeAgo(c.created_at)}</Text>{circle.admin && <Pressable accessibilityRole="button" accessibilityLabel={'Delete comment: ' + c.body} onPress={() => { setDeleting(c); open('delete'); }} style={s.iconButton}><Icon name="trash-2" size={16} color={color.muted} /></Pressable>}</View><Text style={s.body}>{c.body}</Text></View>)}</View> : <Text style={[s.muted, { marginTop: 18 }]}>{p.is_on ? 'No comments.' : p.note}</Text>}
          </View>;
        })}
        {sorted.length === 0 && <View style={s.empty}><Text style={s.heading}>{circle.people.length ? 'No matching people.' : 'No people yet.'}</Text><Text style={s.muted}>{circle.admin ? 'Use + to add a person.' : 'People added by the admin will appear here.'}</Text></View>}
      </>}
      {tab === 'activity' && <>{circle.activity.map(event => <View key={event.id} style={{ paddingVertical: 24, gap: 10, borderTopWidth: 1, borderColor: color.line }}><View style={s.between}><Text style={[s.label, { flex: 1 }]}>{event.person_name}</Text><Text style={s.caption}>{timeAgo(event.created_at)}</Text></View><Text style={s.body}>{event.kind === 'off' ? 'Turned off' : event.kind === 'on' ? 'Turned on' : event.kind === 'added' ? 'Person added' : event.kind === 'note' ? 'Comment added' : 'Violations updated'}{event.points ? ' · ' + (event.points > 0 ? '+' : '−') + Math.abs(event.points) : ''}</Text>{!!event.note && <Text style={s.muted}>{event.note}</Text>}<Text style={s.caption}>{event.actor_name || 'Admin'}</Text></View>)}{!circle.activity.length && <Text style={s.muted}>No activity yet.</Text>}</>}
      {tab === 'members' && circle.admin && <>
        <Text style={[s.label, { paddingBottom: 16 }]}>Payment review</Text>
        {pending.length === 0 && <Text style={[s.muted, { paddingBottom: 32 }]}>No pending requests.</Text>}
        {pending.map(m => <View key={m.user_id} style={{ gap: 12, paddingVertical: 20, borderTopWidth: 1, borderColor: color.line }}><Text style={s.heading}>{m.full_name}</Text><Text style={s.muted}>{m.email}</Text><Text selectable style={s.caption}>UPI reference: {m.payment_reference}</Text><Button title={'Review ' + m.full_name} secondary onPress={() => review(m)} /></View>)}
        <Text style={[s.label, { paddingTop: 24, paddingBottom: 16 }]}>Accounts</Text>
        {circle.members.filter(m => m.status !== 'pending').map(m => <View key={m.user_id} style={{ paddingVertical: 20, gap: 8, borderTopWidth: 1, borderColor: color.line }}><View style={s.between}><Text style={[s.body, { flex: 1 }]}>{m.full_name}</Text><Text style={s.caption}>{m.status === 'approved' ? m.role === 'annan' ? 'Annan' : m.role === 'admin' ? 'Admin' : 'Member' : m.status === 'payment' ? 'Payment not submitted' : 'Rejected'}</Text></View><Text style={s.caption}>{m.email}</Text>{m.status === 'approved' && m.role !== 'admin' && <Pressable accessibilityRole="button" onPress={() => review(m)} style={s.linkButton}><Text style={s.link}>Change role</Text></Pressable>}</View>)}
      </>}
      <View style={[s.between, { paddingTop: 36 }]}><Text style={s.caption}>{circle.canEdit ? (me.role === 'annan' ? 'Annan access' : 'Admin access') : 'Read-only access'}</Text><Text style={s.caption}>{circle.connected ? 'Live updates' : 'Reconnecting…'}</Text></View>
    </ScrollView>
    <View style={{ borderTopWidth: 1, borderColor: color.line, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-around' }}>
      {(['people', 'activity', ...(circle.admin ? ['members'] : [])] as ('people' | 'activity' | 'members')[]).map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: value === tab }} onPress={() => setTab(value)} style={[s.linkButton, { paddingHorizontal: 16 }]}><Text style={{ color: tab === value ? color.text : color.muted, fontSize: 15, fontWeight: tab === value ? '600' : '400' }}>{value === 'people' ? 'People' : value === 'activity' ? 'Activity' : 'Members' + (pending.length ? ' (' + pending.length + ')' : '')}</Text></Pressable>)}
    </View>
    <Modal transparent visible={!!modal} animationType="fade" onRequestClose={() => { if (!busy) setModal(null); }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalBackdrop}><View style={s.modalCard}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 20 }}>
        <View style={s.between}><Text style={[s.heading, { flex: 1 }]}>{modal === 'edit' ? person?.name : modal === 'add' ? 'Add person' : modal === 'delete' ? 'Delete comment?' : modal === 'review' ? member?.full_name : 'Your account'}</Text><Pressable disabled={busy} accessibilityRole="button" accessibilityLabel="Close dialog" onPress={() => setModal(null)} style={s.iconButton}><Icon name="x" /></Pressable></View>
        {modal === 'edit' && person && <>
          {segment(me.role === 'annan' ? ['Comment', 'Add', 'Reduce'] : ['Comment', 'Add'], mode, setMode)}
          {mode !== 'Comment' && <><Field label={mode === 'Reduce' ? 'Violations to remove' : 'Violations to add'} keyboardType="number-pad" value={count} onChangeText={setCount} /><View style={s.between}><Text style={s.muted}>After this change</Text><View style={s.row}><Text style={s.body}>{Number.isFinite(total) ? total : '—'} violations</Text><State on={total === 0} /></View></View><Text style={s.caption}>{mode === 'Reduce' ? 'Only Annan can clear violations. Reaching zero turns this person on.' : 'Adding violations turns this person off. Approved members will be notified when the status changes.'}</Text></>}
          <Field label="Comment" value={body} onChangeText={setBody} maxLength={160} multiline placeholder="Explain the change." />
          <Button title={busy ? 'Saving…' : mode === 'Comment' ? 'Post comment' : 'Save changes'} disabled={busy || !body.trim()} onPress={() => run(async () => {
            if (mode === 'Comment') return circle.comment(person, body);
            if (!/^\d+$/.test(count) || Number(count) < 1 || Number(count) > 100) throw new Error('Enter a whole number from 1 to 100.');
            await circle.save(person, { isOn: total === 0, points: delta, note: body });
          })} />
        </>}
        {modal === 'add' && <><Field label="Full name" value={name} onChangeText={setName} maxLength={60} /><Text style={s.muted}>New people start on with zero violations.</Text><Button title={busy ? 'Adding…' : 'Add person'} disabled={busy || !name.trim()} onPress={() => run(() => circle.add(name))} /></>}
        {modal === 'delete' && deleting && <><Text style={s.body}>{deleting.body}</Text><Text style={s.muted}>This removes the comment from the person’s record. Their violation count stays the same.</Text><Button title={busy ? 'Deleting…' : 'Delete comment'} secondary danger disabled={busy} onPress={() => run(() => circle.deleteComment(deleting))} /></>}
        {modal === 'review' && member && <>
          <Text style={s.muted}>{member.email}</Text>
          {member.status === 'pending' && <><Text selectable style={s.body}>UPI reference: {member.payment_reference}</Text><Text style={s.caption}>Check this transaction in your receiving account before approving. A submitted reference is not proof of payment.</Text></>}
          {!rejecting && <><Text style={s.label}>Account role</Text>{segment(['Member', 'Annan'], role === 'annan' ? 'Annan' : 'Member', value => setRole(value === 'Annan' ? 'annan' : 'member'))}<Text style={s.caption}>{role === 'annan' ? 'Can comment, add violations, and remove violations to restore On status.' : 'Can view people, comments, and activity.'}</Text></>}
          {member.status === 'pending' ? rejecting ? <><Field label="Reason for rejection" value={body} onChangeText={setBody} maxLength={160} multiline /><Button title="Reject payment" disabled={busy || !body.trim()} danger secondary onPress={() => run(() => circle.review(member, false, role, body))} /></> : <><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: verified }} onPress={() => setVerified(!verified)} style={[s.row, { minHeight: 48 }]}><Icon name={verified ? 'check-square' : 'square'} color={color.blue} /><Text style={[s.body, { flex: 1 }]}>I verified this payment.</Text></Pressable><Button title={busy ? 'Approving…' : 'Approve account'} disabled={busy || !verified} onPress={() => run(() => circle.review(member, true, role, ''))} /><Button title="Reject payment" secondary disabled={busy} onPress={() => setRejecting(true)} /></> : <Button title={busy ? 'Saving…' : 'Save role'} disabled={busy} onPress={() => run(() => circle.assignRole(member, role))} />}
        </>}
        {modal === 'account' && <><Text style={s.body}>{me.full_name}</Text><Text style={s.muted}>{me.email}</Text><Text style={s.caption}>{me.role === 'annan' ? 'Annan' : me.role === 'admin' ? 'Admin' : 'Member'} · Approved</Text><View style={s.separator} /><Text style={s.heading}>Notifications</Text><Text style={s.muted}>On iPhone: Safari → Share → Add to Home Screen. Open Annan Pro from your Home Screen and enable alerts.</Text><Button title={notificationsOn ? 'Notifications enabled' : 'Enable notifications'} secondary disabled={busy} onPress={() => run(enable, false)} />
          {circle.inbox.map(item => <View key={item.id} style={{ gap: 6 }}><Text style={s.label}>{item.title}</Text><Text style={s.muted}>{item.body}</Text><Text style={s.caption}>{timeAgo(item.created_at)}</Text></View>)}
          <Button title="Sign out" secondary disabled={busy} onPress={() => run(circle.logout)} /></>}
        {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      </ScrollView></View></KeyboardAvoidingView>
    </Modal>
  </>;
}
