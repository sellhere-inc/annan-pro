# Annan Pro

A React Native / Expo app and an installable Safari web app. Pitch-black interface based on `DESIGN-apple.md`. **No demo mode, sample accounts, or hardcoded login.** Sign-in is always the entry screen.

## Current status — read this first

**The code is implemented, but this is not a deployed or fully verified production service yet.** No Supabase project, payment recipient, hosting account, or push credentials were supplied.

| Feature | Current state |
| --- | --- |
| Login-first screens, registration, payment instructions, waiting screen | Implemented; frontend type-checks and web export passes. Requires your Supabase configuration to sign in. |
| Approval-only access, admin review, Member / Annan roles | Implemented. Database tests pass, including attempts to bypass permissions. Not tested against your hosted project yet. |
| Add people, highest-violations-first sorting, status changes | Implemented. Rule tests and database tests pass. |
| Comments beneath each person; admin deletes one at a time | Implemented. Database tests pass. |
| Only Annan reduces violations; On at zero | Enforced in the database and client; tests pass. Admin cannot bypass this. |
| Safari / iPhone Home Screen Web Push | Client, service worker, and worker implemented. **Not live and not tested on a real iPhone.** Needs HTTPS hosting, VAPID keys, worker deployment, cron, and user permission. |
| Approval notifications | Private in-app messages and push jobs implemented; queue tests pass. Actual delivery is unverified. |
| GPay payment | **Manual only.** No automatic payment verification, refunds, or payment gateway. The user submits a 12-digit UPI reference; admin verifies it in the receiving account. |
| Browser interaction / visual testing | Smoke tests included, but browser execution is blocked by this workspace's socket restrictions. |
| Dependency audit | **22 findings remain: 15 high and 7 moderate.** The current dependency tree includes advisories for braces, node-forge, and uuid, largely through Expo tooling. Review before production; do not use `npm audit fix --force` without checking Expo compatibility. |
| Password recovery, account deletion, admin MFA | Not implemented in the app UI. These need additional work before a wider public launch. |

**The fastest working path is: Supabase setup → local browser login → admin setup → test membership/status flow → HTTPS hosting → Safari notifications.** Do not start with native iOS builds.

Latest local checks: TypeScript, model/push-policy tests, all three database migrations and permission tests, the web export, Android/iOS JavaScript exports, and the notification worker's Deno type check passed. Native exports are not signed installations or device tests.

## 1. Install and run locally

Use Node.js 20.19 or newer, preferably a current supported LTS release.

```sh
npm ci
cp .env.example .env
```

Edit `.env` in your editor. Do not commit it. Do not place any service-role key or private VAPID key in an `EXPO_PUBLIC_*` variable.

After Step 2 below, start the browser app:

```sh
npm run web
```

For Expo Go:

```sh
npm start
```

The project uses Expo SDK 57; your Expo Go must support that SDK. Expo Go does **not** support remote push notifications. Use the Safari web app for the free iPhone route.

Without Supabase values, the login form intentionally stays disabled. There is no bypass login.

## 2. Create and configure Supabase

1. Create a project at [Supabase](https://supabase.com/dashboard).
2. Open **SQL Editor**. Run these files **in this order**, each once:
   - `supabase/migrations/202610100001_circle.sql`
   - `supabase/migrations/202610100002_membership.sql`
   - `supabase/migrations/202610100003_comments.sql`
3. If you already applied the first migration from the earlier version, run only the second and third. Do not recreate the existing tables.
4. Under **Authentication → Providers / Sign In**, enable email/password sign-in and **disable anonymous sign-ins**.
5. Set your real website URL under **Authentication → URL Configuration → Site URL** after deploying. During local testing, use the local URL printed by Expo. Add your local URL to allowed redirects while developing.
6. With email confirmation enabled, configure a working SMTP sender under Authentication. Supabase's default test mail service is restricted and is not a public production mail service. An email-confirmation signup cannot proceed until its email is delivered and confirmed.
7. For an initial local test only, you may disable email confirmation so signup immediately opens the payment screen. Those email addresses are **not verified**. Decide and configure the production email policy before inviting users.
8. Copy your project URL and **publishable key** from Supabase project settings into:
   ```dotenv
   EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
   ```
9. Restart Expo after changing environment variables:
   ```sh
   npx expo start --clear
   ```

The migrations enable Realtime for profiles, people, comments, activity, and notifications. Pending users can read only their own profile and notifications, not the people list. Signup metadata cannot assign a role or approval.

**Existing data:** migration 002 treats old negative points as outstanding violations. Existing On records with a positive count become Off. Existing Off records with zero points receive one violation. Review existing data before applying this to a populated project.

## 3. Create the first admin

1. Register your own account through the app, or create an email/password user in **Supabase → Authentication → Users**. If required, confirm its email.
2. Copy that user's UUID from Authentication → Users.
3. Run this in SQL Editor, replacing the placeholder:
   ```sql
   insert into public.admins(user_id)
   values ('YOUR_ADMIN_USER_UUID')
   on conflict do nothing;
   ```
4. Sign in with that account's **email and password**. It should now open the people list.
5. If an existing admin row predates a partially completed setup, run:
   ```sql
   update public.profiles
   set role = 'admin', status = 'approved', approved_at = now()
   where user_id = 'YOUR_ADMIN_USER_UUID';
   ```

Only this trusted SQL/bootstrap path creates admins. The app can assign Member or Annan, not Admin.

## 4. Set your GPay details

Fill these values in `.env` using the account that should receive membership payments:

```dotenv
EXPO_PUBLIC_UPI_ID=YOUR_REAL_UPI_ID
EXPO_PUBLIC_UPI_RECIPIENT=YOUR_RECIPIENT_NAME
EXPO_PUBLIC_MEMBERSHIP_AMOUNT=YOUR_AMOUNT_IN_RUPEES
```

Use a numeric amount, such as `100` or `100.00`, without a rupee sign. **No recipient or amount is preconfigured.** Payment submission stays disabled until the details are configured.

User flow:

1. Sign in or create an account.
2. Open the payment screen.
3. Tap **Open payment app**, or manually pay the displayed UPI ID in GPay.
4. Return to Annan Pro and enter the **12-digit UPI transaction reference** from GPay transaction details.
5. Tap **Submit for approval**.
6. Stay on **Waiting for confirmation**. This does not grant access.
7. Admin opens **Members → Review**, verifies the transaction, amount, and recipient in the receiving account, chooses Member or Annan, checks **I verified this payment**, and approves.
8. The user's waiting screen updates through Realtime or a 30-second fallback check. They can also tap **Check approval status**.

Opening or returning from GPay never marks a payment successful. Rejected requests show the admin's reason and allow a corrected reference. Approved/pending transaction references cannot be reused.

## 5. Use people, violations, and comments

- Admin adds a person with the **+** button.
- People are sorted by **highest violation count**, then alphabetically for ties.
- **Member:** read-only.
- **Admin:** adds people, comments, and violations; deletes individual comments; approves accounts; assigns Member or Annan.
- **Annan:** adds comments and violations, and can reduce violations.
- Adding the first violation changes On → Off and queues a status alert.
- Only Annan can subtract violations. A partial reduction keeps the person Off; reaching **zero** changes Off → On.
- Counts cannot go below zero. An edit can add/remove 1–100 violations.
- All comments appear beneath the person's name. Admin can delete one via its trash button and confirmation dialog.
- Deleting a comment does not change violations. The activity entry records that its comment was removed.
- The activity screen retains a history of additions and reductions; the main count shows outstanding violations, not a lifetime total.

Approving an account gives access to the app. It does not automatically create a person in the tracked people list; admins manage that list separately.

## 6. Generate free Web Push keys

Run once:

```sh
npm run keys:push
```

This creates **`.secrets/vapid.json`**, ignored by git. It refuses to overwrite existing keys.

1. Copy `publicKey` into `EXPO_PUBLIC_VAPID_PUBLIC_KEY` in your local `.env` and hosting build environment.
2. Keep `privateKey` and `workerSecret` server-side.
3. Create `.secrets/push.env` in your editor:
   ```dotenv
   VAPID_PUBLIC_KEY=THE_publicKey_FROM_JSON
   VAPID_PRIVATE_KEY=THE_privateKey_FROM_JSON
   VAPID_SUBJECT=mailto:YOUR_REAL_CONTACT_EMAIL
   PUSH_WORKER_SECRET=THE_workerSecret_FROM_JSON
   ```
4. Keep the same VAPID keys across deployments. Changing them requires devices to resubscribe.

No paid notification service, Mac, or Apple Developer membership is needed for Web Push.

## 7. Deploy the notification worker

From this project folder:

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase secrets set --env-file .secrets/push.env
npx supabase functions deploy send-notifications
```

The function automatically receives `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from Supabase. Do not copy them to the frontend.

Then, in **Supabase → Vault**, create these two secrets:

| Name | Value |
| --- | --- |
| `circle_function_url` | `https://YOUR_PROJECT.supabase.co/functions/v1/send-notifications` |
| `circle_worker_secret` | The same `workerSecret` used for `PUSH_WORKER_SECRET` |

The `circle_*` Vault names are internal compatibility names; keep them exactly as shown.

Run **`supabase/schedule.sql` once** in SQL Editor. It schedules the worker every minute. Check the Cron dashboard for successful runs.

Expected delay is up to about a minute plus push-provider/device delay. Optional: configure database webhooks on INSERT into `activity` and `notifications` to call the worker with the same bearer secret for quicker dispatch. Keep cron enabled for retries. Cron remains the reliable fallback if a webhook arrives before the transaction's delivery rows are visible.

Worker behavior:

- Approval/rejection alerts go only to the relevant account's registered devices.
- Off alerts go only to approved accounts.
- Signed-out/disconnected devices are filtered before sending.
- Web Push is encrypted using VAPID; expired subscriptions are removed.
- Jobs retry up to five times. Check `push_deliveries.last_error` and Edge Function logs for failures.
- `delivered` means provider acceptance, not proof a human saw it.
- Delivery is not guaranteed by the OS. A crash after provider acceptance can cause a duplicate on retry.

## 8. Publish the Safari web app for free

Suggested route: **Cloudflare Pages free tier**, using its provided `pages.dev` HTTPS address. A purchased domain is optional.

### Option A — upload the built site

1. Finish `.env`, including the public VAPID key.
2. Run:
   ```sh
   npm run build:production
   ```
3. This validates public settings and creates the `dist/` folder with the app, service worker, manifest, and icons.
4. In Cloudflare: **Workers & Pages → Create → Pages → Direct Upload**. Upload the contents of `dist/`.
5. Set the resulting HTTPS URL as your Supabase Auth Site URL.
6. Rebuild and upload again whenever code or public environment variables change.

### Option B — connect a Git repository

- Build command: `npm run build:production`
- Output directory: `dist`
- Set all six required `EXPO_PUBLIC_*` variables from `.env.example` in the hosting build environment.
- Use Node 20.19+.
- Do not upload `.env`, `.secrets`, `node_modules`, or database credentials.

The app uses one shared codebase with a Safari-specific notification adapter. Native Expo clients and web clients use the same Supabase accounts and permissions.

Free hosting and Supabase are subject to their quotas. Supabase free projects may pause after inactivity. This is a free-tier deployment path, not a guarantee of unlimited free production infrastructure.

## 9. Install on iPhone and test notifications

Use a physical iPhone on **iOS 16.4 or later**:

1. Open the deployed **HTTPS** URL in **Safari**.
2. Tap **Share → Add to Home Screen**. If asked, enable **Open as Web App**.
3. Close Safari and launch **Annan Pro from its Home Screen icon**.
4. Sign in. Home Screen and browser storage may differ, so sign in again if needed.
5. On the waiting screen, tap **Enable notifications** and allow permission. Approved users find this under the account icon.
6. Leave the app or lock the phone.
7. From a separate admin session, approve the waiting account.
8. Confirm the approval alert arrives and the account can now enter the app.
9. Enable notifications for an approved account, then have admin add a violation to an On person. Confirm an Off alert arrives.

**It will not work** in an ordinary Safari tab on iPhone without Home Screen installation, over plain HTTP, in Expo Go, with permission denied, or before the worker/cron/VAPID setup is complete.

No Mac or App Store build is required for this route.

## 10. Checks and release gate

Run:

```sh
npm run typecheck
npm test
npm run test:db
npm run build:web
npx expo install --check
```

Database tests use PGlite with stub Supabase auth roles. They test the actual migrations, permission boundaries, payment review, notification audience, comments, and Annan rules. They do not test the hosted Auth service, Realtime network behavior, or actual push delivery.

For browser smoke tests on your own machine:

```sh
npx playwright install chromium
npm run test:e2e
```

These smoke tests cover the login gate, registration screen, and installation assets. Browser tests and real iPhone push were **not run successfully in this workspace**.

For the Edge Function, if Deno is installed:

```sh
deno check --node-modules-dir=manual supabase/functions/send-notifications/index.ts
```

Before a public launch:

- Resolve/review the outstanding `npm audit` findings.
- Verify registration/email delivery with real non-admin accounts.
- Complete the payment → waiting → approval flow.
- Test admin and Annan permissions on separate accounts.
- Test Safari push on a real iPhone, including the app closed and phone locked.
- Configure an account recovery/support process; no password-reset UI is included yet.
- Review backups, auth rate limits, and signup abuse protection for your deployment.

## Optional native apps

Native Android/iOS exports remain available through Expo. For native push, set `EXPO_PUBLIC_EAS_PROJECT_ID`, configure Android FCM / Apple signing credentials, and use an installed development or production build. Native App Store distribution is not the free iPhone path documented above.

## References

- [Apple: Home Screen Web Push and no Apple Developer membership requirement](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [Supabase SMTP restrictions](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase free-tier limits](https://supabase.com/pricing)
- [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Expo push requirements](https://docs.expo.dev/push-notifications/faq/)
