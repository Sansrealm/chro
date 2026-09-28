# Visual redesign and restart — 28 September 2026

The CHRO application now has an editorial visual treatment: oversized display typography, a warm luminous hero with an animated vector globe, a charcoal/olive navigation rail with line icons, cream chart cards, pill controls, and coordinated investigation, decision, connection and voice panels. The overview puts the cohort investigation beside the workforce chart. Decorative motion honors reduced-motion preferences. No remote fonts, artwork requests or new runtime dependencies are required.

Design reference: the user-requested [Astra launch page](https://openai.com/index/gpt-6-astra/). The public page text was retrieved; automated visual capture encountered the site's browser challenge. This is an original interpretation of that editorial direction, not a verified pixel-exact recreation.

## Running application

- Main configured application: **http://127.0.0.1:8787**.
- Separate synthetic preview: **http://127.0.0.1:8788**.
- Both identified Node application processes were restarted with user authorization. Both returned HTTP 200 from `/health`.
- SHA-256 comparisons before and after restart confirmed existing `.env` and `.state` file contents were unchanged. No values or hashes were printed.
- Real-browser checks on the main configured app passed for Monitor, Investigate, Decide and the investigations endpoint. No provider request was made.

## Verification

All **84 tests passed** after the redesign. The Chromium review passed at 1920 × 1080 and widths 1366, 768 and 390. It retains the investigation/reload, stale revision, scenario downside, briefing and simulated microphone-denial checks. Additional checks exercise the mobile Explore dialog, Escape/focus return, and reduced-motion behavior. No JavaScript page errors occurred.

Offline preflight: one isolated run failed while attaching its method review with a sanitized saved-state error; an immediate repeat passed all six checks. The cause was not established. The preflight uses temporary state and did not touch the main workspace. No persistence implementation was changed for this visual redesign.

Visual inspection covered the redesigned Monitor, Investigate and Decide screenshots and mobile navigation. The main app captures below were taken after restart. Live API voice, physical media, non-Chromium browsers and projector acceptance remain unverified.

## Screenshots

- [Monitor](redesign/main-monitor.png)
- [Investigate](redesign/main-investigate.png)
- [Decide](redesign/main-decide.png)
- [Mobile navigation](redesign/mobile-navigation.png)
- [Browser verification results](browser-review.json)
- [Main app verification](redesign/live-app-check.json)

Implementation: `public/experience.css` and `public/experience.js`; small stylesheet/script/render hooks and static asset registration in the existing application. Earlier source versions are preserved in `redesign/originals/`. Existing calculations, saved investigations and evidence validation remain in place.
