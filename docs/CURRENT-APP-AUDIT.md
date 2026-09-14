# Current app audit and next steps

The uploaded `rigrx-main (1).zip` matches the application code originally copied to the test repository. The industrial/mobile redesign branch builds on that code. The ZIP also supplied setup files omitted during the manual upload; `.gitattributes` and a clarified `.env.example` are restored here. There is no original gear-logo asset in the ZIP.

## Improvements in this update

- SMS URLs such as `/#lead-12` open the lead after a provider signs in. Only positive, safe integer identifiers are accepted; driver/admin/technician accounts do not route into the lead feed. A provider must finish company setup first. API authorization remains authoritative.
- Realtime connections share one active socket and one retry timer. Repeated start calls, stale close events, and logout no longer spawn competing reconnect loops. Server socket registries remove empty entries and avoid sending on closed sockets.
- Choosing a provider now requires an unrefunded purchase by an approved, nonarchived company. Eligibility and the open-to-selected transition happen in one SQL statement. Invalid/stale choices return a conflict instead of assigning an unrelated company. Numeric string IDs notify the winner correctly.
- Regression coverage includes link parsing, stale socket callbacks, logout, and actual PostgreSQL selection eligibility. Existing responsive Chromium/WebKit checks remain in place.

## Priorities before real customers or payments

| Priority | Finding in current code | Required follow-up |
|---|---|---|
| High | `/uploads` is publicly served, including verification documents and request photos. | Track file ownership, authorize downloads, validate attachment ownership when saving references, migrate existing files, and use durable private storage. Random filenames are not access control. |
| High | Purchase slot checks, credit ledger changes, payment calls and inserts are separate operations; refund updates are also separate. | Design transactional reservations, payment idempotency and reconciliation; test concurrent purchases/refunds against real PostgreSQL. Do not treat UI button disabling as protection. |
| High | Missing credentials implicitly simulate authentication/payment behavior; SMS errors can fall back to logs. OTP consumption is separate from verification. | Explicit environment configuration with production startup checks; atomic OTP consumption and limits; production cookies; delivery-error handling without logging codes. |
| High | Company dispatchers resolve correctly in many lead routes but messaging checks use their personal user ID. | Apply consistent company and assigned-job authorization to thread listing, reads, writes and realtime delivery. Test owner/dispatcher/tech separation. |
| High | Lead notification matching and feed/detail/purchase checks are not fully consistent. | Centralize approval, services, duty, location/radius and targeting rules; define expansion behavior explicitly. |
| Medium | WebSocket session validation happens at connection time; logout/archive does not fully revoke existing server sockets. | Revoke connections and revalidate expiry; add origin validation and heartbeat handling. This update fixes client reconnect races only. |
| Medium | Local uploads and simulation behavior make deployment fragile. | Durable storage, backups, recovery exercises, environment-separated test data and notification/payment credentials. |
| Medium | Installed Multer 1.x reports deprecation and security issues. | Upgrade dependencies with multipart limits/error-path regression tests and a separate dependency audit. |

## Product direction

Keep one responsive web app first: bottom navigation and large touch targets for drivers; a wider workspace for office staff. Preserve the dark charcoal, steel and red design already in the test branch. Add the real gear logo when available as an asset.

For service-company offices, finish shared dispatch messaging, job assignment and status visibility. For trucking-fleet offices, introduce actual fleet organizations, memberships, vehicles and driver permissions: the existing driver profile field does not provide a shared fleet workspace.

For iOS and Android, retain the platform boundary added in the redesign and evaluate a native wrapper after the backend fixes. Native session storage/transport, deep links, GPS/camera permissions, push notifications, lifecycle reconnection, signing and device testing are still work to do. The current manifest is not an App Store or Google Play release.

## Validation limits

The browser showroom uses isolated fixtures. It checks layouts and interactions, not production OTP delivery, billing, notification delivery or live customer data. The PostgreSQL test exercises selection SQL against temporary tables, not the entire API or a payment race. No production deployment or native build is part of this update.
