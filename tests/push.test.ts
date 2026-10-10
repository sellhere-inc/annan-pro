import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedPushEndpoint } from '../supabase/functions/send-notifications/policy';
test('only recognized HTTPS push services are allowed', () => {
  for (const url of ['https://web.push.apple.com/Q123', 'https://fcm.googleapis.com/fcm/send/abc', 'https://updates.push.services.mozilla.com/wpush/v2/abc']) assert.equal(allowedPushEndpoint(url), true);
  for (const url of ['http://web.push.apple.com/a', 'https://web.push.apple.com.evil.test/a', 'https://127.0.0.1/a', 'https://web.push.apple.com:8080/a', 'https://user:pass@web.push.apple.com/a', 'https://example.com/a']) assert.equal(allowedPushEndpoint(url), false);
});
