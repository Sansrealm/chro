# Local continuation review — 28 September 2026

The local files were reviewed and edited in place. README.md, CONTRACT.md, VALIDATION.md and all three existing documentation files were read. This copy contained no separate investigation documentation and implemented only session investigations plus saved decisions. The added notebook is documented in [INVESTIGATIONS.md](INVESTIGATIONS.md). Original changed source files are retained in `review-originals/`; the browser script uses the original HTML to reproduce comparison screenshots.

## Verified results

- Node 24.14.0: **84 tests passed**, including an actual HTTP investigation save/restart test. All six offline preflight checks passed. Provider requests were disabled in the test fixtures.
- Chrome automation at **1920 × 1080**, with repeated screenshot inspection before and after edits. No JavaScript page errors in the final run. The executable defaults to installed Chrome; set `CHRO_BROWSER` to another Chromium executable if needed.
- Monitor → Investigate → Decide works through real browser clicks. All eight briefing steps navigate and finish. Executive perspective changes retain the selected Monitor domain.
- Scenario result cards appear above assumptions and charts. The 0.5 pp retention downside displays **−$90,000** above the fold, with a negative-value treatment. Chart labels, legends, evidence labels and table headers are larger; chart margins accommodate the larger labels.
- Investigations save the question, notes, challenge prompt, scope, calculated observation and pinned references. They survive browser reload and server restart. Identical saves return the same record. Existing schema-1 decision/audit data is retained.
- Evidence values and denominators are rebuilt on the server. Forged client values are ignored. Source corrections leave saved records immutable; old pins are rejected with 409. Chrome verified the stale warning and successful save after repinning.
- A saved decision reload carries pinned evidence and closes the saved-draft panel. Older context is explicitly labeled rather than presented as current evidence.
- Monitor, Investigate and Decide were exercised at widths 1366, 768 and 390 without page-level horizontal overflow. A tablet sidebar overlap found by Chrome was fixed. Wide data tables retain their own horizontal scrolling.
- Opening the voice panel does not request capture. In Chrome, simulated microphone denial shows the error, leaves the microphone off, opens connection help and enables retry. The existing mock/HTTP tests cover TLS/network/provider failures, sanitization, stale delegation and media cleanup.

## Evidence

[Machine-readable browser results](browser-review.json)

| View | Original | Revised |
| --- | --- | --- |
| Monitor | [Before](screenshots/before-monitor.png) | [After](screenshots/after-monitor.png) |
| Investigate | [Before](screenshots/before-investigate.png) | [After](screenshots/after-investigate.png) |
| Decide | [Before](screenshots/before-decide.png) | [After](screenshots/after-decide.png) |

Additional captures: [downside](screenshots/after-downside.png), [saved investigation](screenshots/after-saved-investigation.png), [retention frontier](screenshots/chart-retention.png), [service queue](screenshots/chart-service.png), [microphone error](screenshots/after-voice-permission-error.png). All six lab visualizations are captured under `screenshots/chart-*.png`.

## Run and review

From the application root:

```sh
npm test
npm run preflight
npm ci
npm run test:browser
npm run preview:review
```

The browser review uses an isolated temporary server and state directory. It requires installed Chromium and the development dependency `playwright-core`; the ordinary application still has no runtime npm dependencies. The preview uses **http://127.0.0.1:8788**, synthetic mode and separate `.review-state/`. It does not load `.env` or reuse `.state`.

The existing service initially occupied port 8787. The user subsequently authorized restarts: both the main app on port 8787 and the separate preview on port 8788 were restarted and checked successfully. Existing `.env` and `.state` file contents were unchanged across restart. See [visual redesign and restart](REDESIGN.md) for the latest screenshots and verification.

## Remaining checks

No real OpenAI/Anthropic request, physical microphone/speaker test, live WebRTC conversation, generated narrated video, Docker run, projector viewing, or non-Chromium browser acceptance was performed. Voice permission denial was deliberately simulated. Provider transport failures are established by automated mocks/local HTTP tests, not a new diagnosis of this machine's live connection. Perspective switching is presentation behavior, not authorization. These synthetic calculations are unchanged; no company connector or approval workflow was added.
