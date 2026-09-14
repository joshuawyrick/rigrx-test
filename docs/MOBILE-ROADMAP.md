# RigRx: desktop web, iOS and Android

## Recommended direction

Keep one responsive web interface backed by the current Express/PostgreSQL API.
Use Capacitor for packaged iOS/Android clients once native authentication and platform integrations are built.
Capacitor supports existing JavaScript apps; a React/React Native rewrite is not required just to publish a native client.

Sources reviewed:
- https://capacitorjs.com/docs/getting-started
- https://capacitorjs.com/docs/config

## Shipped preparation

- Shared responsive UI with desktop sidebar and mobile bottom navigation/More.
- Viewport safe areas, 16 px form inputs and existing visualViewport chat keyboard handling.
- Browser Back handling for in-session navigation. Draft contents are not persisted in history or localStorage.
- public/platform.js owns request, upload, connect and locate capabilities.
- Install metadata and an offline explanation. No claims of offline dispatch: all real requests and messages require internet.
- No private API/upload data cached by the service worker.
- No new framework or native dependency added to the existing server install.

## Work still required before native distribution

### 1. Native authentication and realtime
The current Express endpoints authenticate with the rigrx_session HTTP-only cookie.
The WebSocket handshake also reads that cookie.
A packaged Capacitor app serves local assets from a native origin; it cannot simply assume the website's cookies apply.
Do not solve this by turning off access control, wildcard credentialed CORS, putting tokens in URLs/localStorage, or loading the live website through a production server.url.

Implement and test a native transport:
- authenticated native session issuance/refresh/revocation;
- secure Keychain/Keystore-backed token storage;
- strict origin rules if browser cross-origin traffic is supported;
- authenticated realtime connection compatible with native transport;
- logout/account archival revoking sessions and live connections;
- photo/document upload and returned media URLs using the correct backend origin.
Keep the existing browser cookie flow intact. The platform adapter currently implements browser behavior ONLY.

### 2. Package assets and projects
Create a dedicated bundled web output directory; stamp asset versions at build time.
Add matching supported Capacitor core/CLI/iOS/Android packages and generate native projects with official tools.
Choose the final reverse-domain bundle ID, e.g. co.rigrx.app, before store registration.
Use separate development, test and production backend configurations.
Do not include secrets, database code, uploads or the fixture showroom in the native asset bundle.

### 3. Native features
- Push notifications with device registration, APNs/FCM configuration, role-aware routing and revocation.
- Camera/gallery permission handling, file selection and image upload.
- Foreground GPS permission with manual-location fallback.
- Safe deep links into requests/jobs, always rechecking server authorization.
- Android Back integration and device-resume reconnect/refresh.
- External map/telephone links and Stripe flows tested in each platform.
No background tracking is implemented or needed just to request roadside help.

### 4. Office and fleet scope
Provider companies already have owners, dispatchers and technicians.
Fleet dispatcher is currently a driver profile classification, not a full fleet organization with shared assets and managed employee permissions.
If trucking-company office teams need shared fleet accounts, implement organizations, memberships,
asset assignments and server authorization explicitly. Do not treat the existing label as permission support.

### 5. Production release
Verify actual-device behavior, push permissions, bad connectivity, long text, large accessibility type,
camera/GPS denial, expired sessions and account switching.
Build with Xcode/Android tooling, sign with the owner's developer accounts,
and complete the current store requirements for privacy, account deletion, data disclosures and payments.
Those store requirements and the lead-purchase payment model need review at submission time.
App Store/Google Play approval is not provided by adding a manifest or wrapping a URL.

## Existing backend launch issues observed

These are not changed by the visual redesign:
- No Twilio SID enables test OTP exposure; no Stripe keys enable simulated purchases. Production needs explicit configuration review.
- Uploads are served from /uploads as static files; review authorization for provider verification documents before production.
- A public test repository is not an isolated production environment. Test database and billing/SMS configuration must be separate.
- Long frontend and routes files would benefit from incremental module extraction after workflow tests are in place.
