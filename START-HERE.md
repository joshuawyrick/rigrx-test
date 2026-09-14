# RigRx — complete test build

This ZIP contains the entire app, not a patch. It includes the industrial dark redesign, driver and service-company workflows, a shared fleet office, private uploads, transactional lead purchases, payment recovery, and a no-key demo.

**Start with fake data in demo mode. The app is a working responsive web/PWA build, not a signed iOS or Android application.**

## 1. Update your GitHub test repository without a terminal

1. Download and extract `rigrx-complete-test.zip` on your computer.
2. Open the extracted folder. You should see `package.json`, `server`, `public`, and this file.
3. Open **joshuawyrick/rigrx-test** on GitHub. Select the test branch you want to replace (the redesign is on `redesign/industrial-mobile`).
4. Choose **Add file → Upload files**. Drag the extracted files and folders into GitHub. Upload the contents, not the ZIP and not an extra containing folder.
5. Include the setup files beginning with a dot, especially `.env.example`, `.gitignore`, `.replit`, and `.github`. Windows may hide these; enable “Hidden items.” Never upload a real `.env` file.
6. Commit the changes to that test branch. Existing files with the same paths are replaced. No application files need to be deleted for this release.

Your live `rigrx` repository is separate. Do not copy customer data, real keys, uploaded documents or a production database into this test repository.

## 2. Run the complete demo in Replit

1. Import the test GitHub repository into a Node.js Replit app and choose the updated branch.
2. In the app's Secrets/environment settings, set `RIGRX_MODE` to `demo`.
3. Set `BASE_URL` to the exact HTTPS URL you use to open that Replit app. It must match the address used in the browser, without a trailing path.
4. Leave `DATABASE_URL` unset for the local demo database. Leave Twilio and Stripe keys unset. `SMS_MODE=simulated`, `PAYMENT_MODE=simulated`, and `STORAGE_MODE=local` are the demo defaults.
5. Click **Run**. The Node project must install its `package.json` dependencies; Replit's import normally handles this. If prompted for an install command, use `npm ci`; the run command is `npm start`.
6. Open the app. A demo banner links to **Demo accounts & walkthrough** (`/demo-guide.html`).

The local database saves under `.demo-data` and uploaded files under `uploads`. They are private server-side folders and are excluded from GitHub. Use one running app process with this demo database. A new ephemeral deployment may lose those folders: use a separate PostgreSQL database and persistent upload storage for a durable hosted test.

If Replit uses a reverse proxy and reports a rate-limiter proxy warning, configure `TRUST_PROXY=1` only when there is one trusted proxy hop. Keep the app reachable through that proxy, not directly from the public internet.

## 3. Demo accounts

| Role | Phone | What it does |
|---|---|---|
| Driver | 661-555-0198 | Request roadside help using assigned fleet equipment |
| Provider owner | 661-555-0101 | Company settings, staff, lead purchases and credits |
| Provider dispatcher | 661-555-0102 | Respond to leads, quote, message and assign technicians |
| Technician | 661-555-0103 | Accept assigned jobs, set ETA, arrive and complete |
| Fleet office | 661-555-0104 | Manage fleet invitations, vehicles, assignments and requests |
| RigRx administrator | 661-555-0100 | Approvals, catalog, pricing, credit grants, refunds and system status |

Enter the phone number on the sign-in screen. The six-digit code appears on screen in simulated SMS mode. Do not use a fixed code from an old screenshot. Codes expire, are single-use, and have request/attempt limits.

Use separate browser profiles to act as several people simultaneously. Tabs in the same browser profile share a login. The seeded service company covers the Bakersfield area; use a Bakersfield location when testing matching.

Test driver → request → dispatcher buys lead → dispatcher sends quote → driver/fleet office chooses company → dispatcher assigns technician → technician accepts, goes en route, arrives and completes. Then review the request in the fleet office and try exporting a CSV. The provider starts with ten demo lead credits; after they are spent, simulated card purchases work without a card.

## 4. Keys and accounts to connect later

| Service | Environment variables | Needed when |
|---|---|---|
| PostgreSQL (Replit, Neon, Supabase or another host) | `DATABASE_URL`; optionally `DB_SSL` | Required for live mode and recommended for durable hosted testing. This is a database connection string, not a public browser key. |
| Twilio SMS | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`; set `SMS_MODE=twilio` | Real sign-in codes and notification texts. Set up a sender approved for your traffic; a trial account may restrict recipient numbers. |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`; set `PAYMENT_MODE=stripe` | Real or Stripe-test lead purchases. Begin with Stripe test keys. |
| Private Cloudflare R2 / S3 | `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`; set `STORAGE_MODE=s3` | Durable private photos and verification documents. R2 region is `auto`; AWS uses its region and can leave endpoint blank. Keep the bucket private. |
| Application | `BASE_URL`, `ADMIN_PHONE`, `OTP_SECRET`, `RIGRX_MODE` | Exact app URL, initial admin phone and a random secret of at least 32 characters for OTP hashing. |
| Persistent local file volume (alternative to S3) | `UPLOAD_DIR`; `STORAGE_MODE=local` | Live local storage requires an explicitly configured persistent volume. |

**No map/geocoding API key is needed for the current app.** It uses browser GPS, the included city database, and external navigation links. It does not include a paid live map, traffic feed or turn-by-turn SDK.

Keep secret values in Replit Secrets or your host's environment configuration. Never put them into `public/`, screenshots, GitHub or this ZIP.

### Stripe setup

- Use `RIGRX_MODE=test` with Stripe test keys while testing real Stripe integration.
- Add a webhook endpoint at `https://YOUR-APP/api/payments/webhook` for `payment_intent.succeeded`.
- Copy that endpoint's signing secret to `STRIPE_WEBHOOK_SECRET`.
- As provider owner, add a card in Settings. Card details are collected by Stripe Elements.
- Purchases reserve one of four response slots, use a stable order ID for Stripe retries, and finalize after confirmed success. Pending orders hold their slots.
- Administrator → System lists interrupted payment orders. **Reconcile** searches the original payment; it does not charge again. If no successful payment is found, the reservation remains held for investigation. Do not manually delete a pending order without checking Stripe.
- Admin refunds use a stable refund reference. They return one credit for credit purchases or request a refund of the original card payment. The app does not charge drivers for the repair invoice or split repair payments to providers; it sells lead access.

Official references: [Stripe idempotency](https://docs.stripe.com/api/idempotent_requests), [Stripe webhooks](https://docs.stripe.com/webhooks), [S3 JavaScript SDK](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_s3_code_examples.html).

## 5. What changed

- Charcoal, steel and red responsive interface; desktop side navigation and mobile navigation.
- Fleet organizations with phone-bound invitations that users accept themselves.
- Fleet owner/dispatcher workspace with shared assets, driver assignment, request visibility, provider selection, messaging and CSV export.
- Service-company dispatchers access their company's threads. Technicians access only assigned jobs/threads and cannot quote or buy leads.
- File downloads require authorization; uploads are signature-checked, limited to photos/PDFs and 8 MB, and tracked by owner. Saving another user's uploaded URL is rejected.
- OTP codes are hashed, expire, have bounded attempts and are consumed atomically. SMS failures do not expose a code through a production fallback.
- Secure live cookies, request-origin checks, sign-in/upload rate limiting, authenticated websocket expiry/revocation and reconnect handling.
- Request retries reuse a client key. Credit spending and ledger entries are transactional. Response-slot reservations prevent five buyers from purchasing four slots.
- Non-login SMS notifications use a durable retry queue. Login codes are sent synchronously. Retries can still duplicate an SMS after an ambiguous provider/network failure; SMS is not an exactly-once channel.
- Private local storage and optional R2/S3 adapter. Existing document URLs remain usable by authorized owners/admins. Existing files are not automatically moved to a new storage provider.
- No-key demo database, role-based demo accounts, an in-app walkthrough, health check and admin integration status.

## 6. Before using real customers

- Use a **new** live PostgreSQL database with backups. Do not promote the seeded demo database.
- Set `RIGRX_MODE=live`, real service modes/credentials, HTTPS `BASE_URL`, `OTP_SECRET` and private persistent storage. Startup rejects missing live configuration.
- Set `ADMIN_PHONE` before that number first signs up. Existing account roles are not silently promoted by changing a setting.
- Do not enable `SEED_DEMO` on a live database. Live mode refuses demo seeding.
- Back up the database and old uploads before updating an existing installation. Schema changes are additive; existing uploads must remain accessible in the old local folder if you enable S3 for new uploads.
- Exercise real SMS delivery, Stripe test payments/webhook retries, private object storage, backup restoration and multiple real devices. Those external services cannot be verified without your accounts.
- Provide your actual privacy policy, terms, support contact, provider agreements and account-deletion process before public/app-store launch. The build does not invent legal text or certify provider documents.

## 7. iOS and Android

This release works in phone browsers and includes the PWA manifest/offline page. It does not include signed native applications, background APNs/FCM push, native secure credential storage, or an App Store/Google Play submission.

The existing `public/platform.js` boundary is where native transport, secure storage, camera/GPS and realtime adapters will connect. A native packaging phase still needs Apple/Google developer accounts, device testing, permissions, account deletion, signing and store review. Do not ship a Capacitor development `server.url` wrapper as a finished native release. [Capacitor documentation](https://capacitorjs.com/docs/getting-started).

## 8. Developer verification

Use Node 22+. `npm test` checks the platform and an end-to-end server flow against a temporary embedded database. CI also tests actual PostgreSQL and Chromium/WebKit. Tests seed only isolated databases; never point `RELEASE_DATABASE_URL` at customer data.

`npm run test:browser` requires Playwright and installed Chromium/WebKit. The fixture showroom lives at `/design-preview.html`; the normal `/` app uses the actual database. The release browser checks additionally exercise live fleet/system/dispatch/driver screens at phone and desktop widths.
