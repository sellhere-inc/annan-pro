import { createClient } from 'npm:@supabase/supabase-js@2.109.0';
import webpush from 'npm:web-push@3.6.7';
import { allowedPushEndpoint } from './policy.ts';
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
type Delivery = {
  id: string; activity_id: string | null; notification_id: string | null; recipient_id: string | null;
  token: string; title: string; body: string; attempts: number; ticket_id: string | null; created_at: string;
  transport: 'expo' | 'web'; subscription: { endpoint: string; keys: { p256dh: string; auth: string } } | null;
};
const headers: Record<string, string> = { 'Content-Type': 'application/json' };
if (Deno.env.get('EXPO_ACCESS_TOKEN')) headers.Authorization = 'Bearer ' + Deno.env.get('EXPO_ACCESS_TOKEN');
async function expo(path: string, body: unknown) {
  const response = await fetch('https://exp.host/--/api/v2/push/' + path, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Expo HTTP ' + response.status);
  const result = await response.json();
  if (result.errors?.length) throw new Error('Expo rejected the request.');
  return result.data;
}
async function update(id: string, values: Record<string, unknown>) {
  const { error } = await db.from('push_deliveries').update(values).eq('id', id);
  if (error) throw error;
}
async function fail(job: Delivery, message: string, code?: string) {
  if (code === 'DeviceNotRegistered') {
    const { error } = await db.from('push_tokens').delete().eq('token', job.token).eq('user_id', job.recipient_id);
    if (error) throw error;
  }
  const terminal = job.attempts >= 5 || ['DeviceNotRegistered', 'MessageTooBig', 'MismatchSenderId', 'InvalidCredentials', 'InvalidEndpoint'].includes(code || '');
  await update(job.id, { status: terminal ? 'failed' : 'queued', ticket_id: null, last_error: message,
    next_attempt_at: new Date(Date.now() + Math.min(3600, 30 * 2 ** job.attempts) * 1000).toISOString() });
}
async function sendWeb(job: Delivery) {
  if (!job.subscription || !allowedPushEndpoint(job.subscription.endpoint) || job.subscription.endpoint !== job.token) {
    return fail(job, 'Invalid web push endpoint', 'InvalidEndpoint');
  }
  try {
    const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const subject = Deno.env.get('VAPID_SUBJECT');
    if (!publicKey || !privateKey || !subject) throw new Error('Web push credentials are not configured');
    const request = webpush.generateRequestDetails(job.subscription, JSON.stringify({ id: job.id, title: job.title, body: job.body }), {
      vapidDetails: { subject, publicKey, privateKey }, TTL: 86400, urgency: 'normal', contentEncoding: 'aes128gcm',
    });
    const response = await fetch(request.endpoint, {
      method: 'POST', headers: request.headers as Record<string, string>, body: new Uint8Array(request.body!),
      redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    await response.body?.cancel();
    if (response.status === 404 || response.status === 410) return fail(job, 'Subscription expired', 'DeviceNotRegistered');
    if (!response.ok) return fail(job, 'Web push HTTP ' + response.status);
    await update(job.id, { status: 'delivered', last_error: null });
  } catch (error) { await fail(job, error instanceof Error ? error.message : 'Web push failed'); }
}
Deno.serve(async request => {
  const secret = Deno.env.get('PUSH_WORKER_SECRET');
  if (!secret || request.headers.get('Authorization') !== 'Bearer ' + secret) return new Response('Unauthorized', { status: 401 });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  try {
    const exhausted = await db.from('push_deliveries').update({ status: 'failed', last_error: 'Retry limit reached' }).in('status', ['queued', 'processing']).gte('attempts', 5).lte('next_attempt_at', new Date().toISOString());
    if (exhausted.error) throw exhausted.error;
    const claimed = await db.rpc('claim_push_deliveries');
    if (claimed.error) throw claimed.error;
    const jobs = claimed.data as Delivery[];
    const eligible: Delivery[] = [];
    if (jobs.length) {
      const tokens = await db.from('push_tokens').select('token,user_id').in('token', jobs.map(job => job.token));
      const recipients = [...new Set(jobs.map(job => job.recipient_id).filter(Boolean))];
      const profiles = await db.from('profiles').select('user_id,status').in('user_id', recipients);
      if (tokens.error || profiles.error) throw tokens.error || profiles.error;
      for (const job of jobs) {
        const registered = tokens.data.some(t => t.token === job.token && t.user_id === job.recipient_id);
        const approved = profiles.data.some(p => p.user_id === job.recipient_id && p.status === 'approved');
        if (registered && (job.notification_id || approved)) eligible.push(job);
        else await update(job.id, { status: 'failed', last_error: 'Device disconnected or access removed' });
      }
    }
    const webJobs = eligible.filter(job => job.transport === 'web');
    for (let i = 0; i < webJobs.length; i += 5) await Promise.all(webJobs.slice(i, i + 5).map(sendWeb));
    const nativeJobs = eligible.filter(job => job.transport === 'expo');
    if (nativeJobs.length) {
      let tickets: { status: string; id?: string; message?: string; details?: { error?: string } }[] = [];
      try {
        tickets = await expo('send', nativeJobs.map(job => ({ to: job.token, title: job.title, body: job.body, sound: 'default', channelId: 'status-updates', data: { activityId: job.activity_id, notificationId: job.notification_id } })));
      } catch {
        for (const job of nativeJobs) await fail(job, 'Expo request failed');
      }
      for (let i = 0; i < tickets.length; i++) {
        const job = nativeJobs[i]; if (!job) break;
        const ticket = tickets[i];
        if (ticket.status === 'ok' && ticket.id) await update(job.id, { status: 'sent', ticket_id: ticket.id, next_attempt_at: new Date(Date.now() + 15 * 60000).toISOString(), last_error: null });
        else await fail(job, ticket.message || 'Expo ticket error', ticket.details?.error);
      }
      // A missing ticket keeps its lease and is retried after expiry.
    }
    const receipts = await db.from('push_deliveries').select('*').eq('status', 'sent').eq('transport', 'expo').lte('next_attempt_at', new Date().toISOString()).limit(100);
    if (receipts.error) throw receipts.error;
    if (receipts.data.length) {
      const statuses = await expo('getReceipts', { ids: receipts.data.map(job => job.ticket_id) });
      for (const job of receipts.data as Delivery[]) {
        const receipt = statuses?.[job.ticket_id!];
        if (receipt?.status === 'ok') await update(job.id, { status: 'delivered' });
        else if (receipt?.status === 'error') await fail(job, receipt.message || 'Delivery failed', receipt.details?.error);
        else if (Date.now() - Date.parse(job.created_at) > 24 * 3600000) await update(job.id, { status: 'failed', last_error: 'Receipt unavailable; delivery unknown' });
        else await update(job.id, { next_attempt_at: new Date(Date.now() + 15 * 60000).toISOString() });
      }
    }
    return Response.json({ submitted: eligible.length, receiptsChecked: receipts.data.length });
  } catch {
    console.error('Push worker failed. Check database connectivity and push configuration.');
    return Response.json({ error: 'Push worker failed; pending jobs will retry.' }, { status: 500 });
  }
});
