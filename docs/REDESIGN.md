# RigRx industrial redesign

## What this change delivers

- Charcoal, graphite, silver and crimson visual system across the existing app.
- Dedicated sign-in layout, driver dashboard, garage equipment cards, service stepper, active-request status and structured message quotes.
- Wider provider/admin desktop workspaces, responsive tables, and mobile navigation capped at five destinations with a More screen.
- Existing driver, provider owner, dispatcher, technician and administrator permissions remain server-enforced.
- English/Spanish translations for new driver-facing copy. Existing untranslated office/technician strings still need a separate localization pass.
- Keyboard-operable legacy chips, label associations where possible, focus outlines, navigation landmarks, and improved modal semantics.
- Web app manifest, app icon placeholder, safe areas, offline explanation and network-only app data.
- Shared browser platform adapter for API calls, uploads, GPS and WebSocket connections.
- Fixes the missing sign-in Enter handler, duplicate OTP submission, lost truck/trailer selections on Back, unsafe equipment JSON in inline edit handlers, and misleading waiting-state/location-sharing language.
- No database migration, role expansion, pricing change, or production deployment.

## Preview without touching real data

After running the test project, open **/design-preview.html** on its preview URL.
Use the Screen selector to inspect sign-in, driver screens, provider office, jobs, team, administration and technician views.
The top banner identifies sample data. This page uses a separate fixture adapter; it cannot send SMS, buy leads, upload files or modify server data. Some secondary actions intentionally return a preview-only message.

The real application is at **/**. It continues to use the existing backend and requires a separate test database.

## Brand assets

The uploaded original chrome gear artwork is not in this repository and was unavailable as a readable attachment file in this session.
The implementation uses a temporary styled RIGRX wordmark and RX app icon, not a counterfeit recreation of the original mark.
Replace brandMark() in public/ui.js with the approved original asset and export proper PNG app/touch icons before release.
The sign-in hero uses an original CSS composition, not the photographic mockup. Equipment illustrations are neutral icons: the app has no actual per-vehicle photos, so a generic Peterbilt photograph would misrepresent other vehicles.

## Files

- public/design.css: redesigned shared components and responsive layout.
- public/ui.js: common presentation, accessibility enhancements, browser install registration.
- public/platform.js: browser capability adapter.
- public/app.js: revised main screens and shell, existing workflows retained.
- public/design-preview.html + public/preview.js: isolated showroom.
- public/sw.js + offline.html + manifest.webmanifest: web install/offline foundation.
- test/: automated platform/browser checks.
- docs/MOBILE-ROADMAP.md: remaining native integration work.

## Validation

Redesign checks workflow runs Node platform/syntax tests and Chromium/WebKit UI checks against the fixture showroom.
Screenshots are attached to the workflow as **rigrx-design-screenshots**.
The browser suite covers 320, 390, 820 and 1440 px layouts and checks horizontal overflow, role navigation,
new Spanish sign-in, retained equipment choices and editing names containing apostrophes.
These checks do not validate live PostgreSQL transactions, Stripe, Twilio or native builds.

Before merging, run the existing real two-account workflow against a TEST database:
sign in, save equipment, submit a request, provider buys a simulated lead, exchange quotes/messages,
choose provider, assign/accept/enroute/arrive/complete and verify the driver's updates.
Check keyboard and screen-reader behavior on actual devices. The inherited app still contains
legacy inline handlers and many individually rendered forms; this change is not a complete accessibility audit.

## User-friendly test setup

1. Import this branch of rigrx-test into a separate Replit project.
2. Give it its own PostgreSQL database and test secrets.
3. Use the existing npm start run command.
4. Open /design-preview.html first to review the design.
5. Use / for full workflow testing.
6. Keep the original rigrx project connected to its original repository.

The GitHub test repository was public when reviewed. Use GitHub Settings → General → Danger Zone → Change visibility if you intend to keep its code private.
