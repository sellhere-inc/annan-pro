import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from './client';
import { Activity, Comment, Edit, Person, Profile, Role, Snapshot, validateEdit } from './model';
import { unregisterNotifications } from './notifications';
const empty: Snapshot = { people: [], activity: [], comments: [] };
export type InboxItem = { id: string; title: string; body: string; created_at: string };
export function useCircle() {
  const [data, setData] = useState<Snapshot>(empty);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [connected, setConnected] = useState(false);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    if (!supabase) { setLoading(false); return; }
    const db = supabase;
    try {
      const session = await db.auth.getSession();
      if (session.error) throw session.error;
      if (!session.data.session) {
        if (request === generation.current) { setProfile(null); setData(empty); setMembers([]); setInbox([]); }
        return;
      }
      const account = await db.from('profiles').select('*').eq('user_id', session.data.session.user.id).single();
      if (account.error) throw new Error('Unable to load your account. Check your connection and try again.');
      const me = account.data as Profile;
      const messages = await db.from('notifications').select('id,title,body,created_at').order('created_at', { ascending: false }).limit(30);
      if (messages.error) throw messages.error;
      let next = empty;
      let users: Profile[] = [];
      if (me.status === 'approved') {
        const [people, activity] = await Promise.all([
          db.from('people').select('*').order('negative_points', { ascending: false }).order('name'),
          db.from('activity').select('*').order('created_at', { ascending: false }).limit(100),
        ]);
        if (people.error || activity.error) throw people.error || activity.error;
        const comments: Comment[] = [];
        // Load all comments, including lists larger than the API's default page.
        for (let offset = 0; ; offset += 500) {
          const page = await db.from('person_comments').select('*').order('created_at').order('id').range(offset, offset + 499);
          if (page.error) throw page.error;
          comments.push(...page.data as Comment[]);
          if (page.data.length < 500) break;
        }
        next = { people: people.data as Person[], activity: activity.data as Activity[], comments };
        if (me.role === 'admin') {
          for (let offset = 0; ; offset += 500) {
            const page = await db.from('profiles').select('*').order('created_at', { ascending: false }).order('user_id').range(offset, offset + 499);
            if (page.error) throw page.error;
            users.push(...page.data as Profile[]);
            if (page.data.length < 500) break;
          }
        }
      }
      if (request === generation.current) { setProfile(me); setData(next); setMembers(users); setInbox(messages.data); setError(''); }
    } catch (e) {
      if (request === generation.current) { setProfile(null); setData(empty); setMembers([]); setInbox([]); setError((e as Error).message); }
      throw e;
    } finally { if (request === generation.current) setLoading(false); }
  }, []);
  useEffect(() => {
    let alive = true;
    const run = () => { if (alive) void refresh().catch(() => {}); };
    run();
    if (!supabase) return;
    const db = supabase;
    const { data: auth } = db.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') {
        generation.current++; setProfile(null); setData(empty); setMembers([]); setInbox([]);
      }
      setTimeout(run, 0);
    });
    const channel = db.channel('annan-pro')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, run)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'people' }, run)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'person_comments' }, run)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity' }, run)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => { setNotice(String(payload.new.title)); run(); })
      .subscribe(status => { setConnected(status === 'SUBSCRIBED'); if (status === 'SUBSCRIBED') run(); });
    // Poll as a fallback when a realtime connection is interrupted.
    const interval = setInterval(run, 30000);
    const state = AppState.addEventListener('change', value => {
      if (value === 'active') { db.auth.startAutoRefresh(); run(); } else db.auth.stopAutoRefresh();
    });
    return () => { alive = false; generation.current++; clearInterval(interval); state.remove(); auth.subscription.unsubscribe(); void db.removeChannel(channel); };
  }, [refresh]);
  function client() { if (!supabase) throw new Error('Annan Pro is not configured. Contact the administrator.'); return supabase; }
  async function afterWrite() {
    try { await refresh(); } catch { setNotice('Saved. Reconnect and refresh to load the update.'); }
  }
  async function login(email: string, password: string) {
    const { error } = await client().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) throw error;
    await refresh();
  }
  async function register(fullName: string, email: string, password: string) {
    if (!fullName.trim() || fullName.trim().length > 60) throw new Error('Enter your full name (up to 60 characters).');
    if (password.length < 8) throw new Error('Use at least 8 characters for your password.');
    const { data, error } = await client().auth.signUp({ email: email.trim().toLowerCase(), password, options: { data: { full_name: fullName.trim() } } });
    if (error) throw error;
    if (!data.session) return 'Check your email to confirm your account, then sign in to continue.';
    await refresh();
    return '';
  }
  async function logout() {
    await unregisterNotifications();
    const { error } = await client().auth.signOut();
    if (error) throw error;
    generation.current++; setProfile(null); setData(empty); setMembers([]); setInbox([]);
  }
  async function submitPayment(reference: string) {
    const { error } = await client().rpc('submit_payment', { p_reference: reference.trim() });
    if (error) throw error;
    await afterWrite();
  }
  async function review(member: Profile, approve: boolean, role: 'member' | 'annan', reason: string) {
    const { error } = await client().rpc('review_member', { p_user_id: member.user_id, p_approve: approve, p_role: role, p_reason: reason.trim() });
    if (error) throw error;
    await afterWrite();
  }
  async function assignRole(member: Profile, role: 'member' | 'annan') {
    const { error } = await client().rpc('set_member_role', { p_user_id: member.user_id, p_role: role });
    if (error) throw error;
    await afterWrite();
  }
  async function save(person: Person, edit: Edit) {
    if (!profile || profile.status !== 'approved') throw new Error('Approved access is required.');
    validateEdit(person, edit, profile.role);
    const { error } = await client().rpc('update_person', { p_id: person.id, p_is_on: edit.isOn, p_note: edit.note.trim(), p_points: edit.points, p_version: person.version });
    if (error) throw error;
    await afterWrite();
  }
  async function add(name: string) {
    const { error } = await client().rpc('add_person', { p_name: name.trim() });
    if (error) throw error;
    await afterWrite();
  }
  async function comment(person: Person, body: string) {
    const { error } = await client().rpc('add_comment', { p_person_id: person.id, p_body: body.trim() });
    if (error) throw error;
    await afterWrite();
  }
  async function deleteComment(comment: Comment) {
    const { error } = await client().rpc('delete_comment', { p_id: comment.id });
    if (error) throw error;
    await afterWrite();
  }
  return { ...data, profile, members, inbox, loading, error, notice, setNotice, connected, configured: !!supabase,
    admin: profile?.role === 'admin', canEdit: profile?.status === 'approved' && profile.role !== 'member',
    refresh, login, register, logout, submitPayment, review, assignRole, save, add, comment, deleteComment };
}
