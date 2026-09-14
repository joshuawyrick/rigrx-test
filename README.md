# RigRx — complete test build

Read **[START-HERE.md](START-HERE.md)** for the no-terminal GitHub/Replit setup, demo accounts, full walkthrough, API keys and live-mode requirements.

- Responsive industrial dark UI for drivers, service-company offices, technicians and fleet offices.
- Phone OTP sign-in, saved/assigned equipment, location, requests, lead purchases, quotes, messaging, dispatch and job status.
- Fleet invitations, shared vehicle management, assignment and request exports.
- Private file access, atomic OTP/credit handling, payment reservations/recovery and notification retries.
- Runs immediately without external keys in local demo mode; supports PostgreSQL, Twilio, Stripe and private R2/S3 storage for configured environments.

Node 22+: `npm ci` then `npm start`. Default local demo automatically creates its own database and test accounts. Open `/demo-guide.html` for the walkthrough. `npm test` runs isolated regression tests.

This is a full web/PWA test build, not a signed native release or a claim of production certification. See the setup guide for remaining external-service and device validation.

Earlier architecture notes are preserved in `docs/LEGACY-README.md` for history. **START-HERE.md is authoritative for this release**; older notes about public uploads or implicit simulated live payments no longer apply.
