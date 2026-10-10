export function allowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443') &&
      (/^[a-z0-9-]+\.push\.apple\.com$/.test(url.hostname) ||
      ['fcm.googleapis.com', 'updates.push.services.mozilla.com'].includes(url.hostname));
  } catch { return false; }
}
