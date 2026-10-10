try { process.loadEnvFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const required = ['EXPO_PUBLIC_SUPABASE_URL','EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY','EXPO_PUBLIC_UPI_ID','EXPO_PUBLIC_UPI_RECIPIENT','EXPO_PUBLIC_MEMBERSHIP_AMOUNT','EXPO_PUBLIC_VAPID_PUBLIC_KEY'];
const missing = required.filter(name => !process.env[name]);
if (missing.length) { console.error('Missing production configuration: ' + missing.join(', ')); process.exit(1); }
const errors = [];
try { if (new URL(process.env.EXPO_PUBLIC_SUPABASE_URL).protocol !== 'https:') errors.push('Supabase URL must use HTTPS'); } catch { errors.push('Invalid Supabase URL'); }
if (!/^\d+(\.\d{1,2})?$/.test(process.env.EXPO_PUBLIC_MEMBERSHIP_AMOUNT) || Number(process.env.EXPO_PUBLIC_MEMBERSHIP_AMOUNT) <= 0) errors.push('Membership amount must be positive');
if (!/^[^\s@]+@[^\s@]+$/.test(process.env.EXPO_PUBLIC_UPI_ID)) errors.push('Invalid UPI ID');
if (!/^[A-Za-z0-9_-]{87}=?$/.test(process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY)) errors.push('Invalid public VAPID key');
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (key.startsWith('sb_secret_')) errors.push('A secret Supabase key must never be public');
if (key.split('.').length === 3) {
  try { const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url')); if (claims.role !== 'anon') errors.push('Use a publishable/anon key, never a service-role key'); } catch { errors.push('Invalid Supabase key'); }
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('Public build configuration passed. Verify server secrets, migrations, payment details, and real-device push before release.');
