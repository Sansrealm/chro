# Continuous voice troubleshooting — version 2.0.1

The old message “Unable to complete the request. Check the server configuration and saved state” did not identify the failing component. In particular, a Node fetch rejection could become that message. It was not proof that your microphone, key, or saved decisions were wrong. Version 2.0.1 classifies failures and exports a sanitized report so the actual cause can be investigated.

## Update an existing installation

1. Stop the running server with **Ctrl+C** in its terminal.
2. Keep a backup of your existing app folder. Extract the new ZIP and merge its `chro-multimodal-starter` contents into your existing application folder, replacing application files. **Keep your existing `.env` and `.state` directory (or custom `STATE_DIR`).** The ZIP contains neither of them; do not replace your whole folder by deleting it. No state migration is required.
3. From the application folder containing `package.json`, run `npm start` again. Keep using your existing port/address.
4. Reload the browser with **Ctrl+Shift+R** (Windows/Linux) or **Cmd+Shift+R** (Mac). Open **Continuous voice → Connection help**. It should show **App 2.0.1**. If it shows an older version, the old server/folder is still running or the page has not refreshed.
5. Click **Check API connection**. This checks one model-metadata endpoint from Node. It does not start a voice session or generate audio. A successful check still requires the next step; a metadata permission error alone is not conclusive about session creation.
6. Click **Start conversation**. If it fails, keep that server running and click **Download connection report** in Connection help. Share `workforce-connection-report.json` and the visible error message. **Do not share `.env` or an API key.** The report retains up to ten sanitized errors from this server process; restarting clears them.

If a voice session is active, Stop before running the metadata check. Downloading the report is a local read and does not make another OpenAI request.

## What each test establishes

| Test | What it checks | What remains untested |
| --- | --- | --- |
| Connections & readiness → browser media diagnostic | Microphone permission/capture and local test-tone canvas recording | Server authentication, API access, AI speech, WebRTC |
| Connection help → Check API connection | Node reaches a fixed OpenAI model-metadata endpoint, or returns a classified failure | A GPT-Live session, browser media transport, audible AI responses |
| `npm run preflight -- --live` | Paid speech generation, transcription and Astra routing/narration | A physical microphone and continuous voice/WebRTC |
| Start conversation | Real session creation followed by browser WebRTC and provider events | Full presentation acceptance until interruption, evidence delegation, playback and Stop are also exercised |

The uploaded browser test in the reported incident passed, and its WebM decoded with VP8 video and Opus audio. Those findings do not identify the server failure. No live provider session was available to verify this patch in the development environment.

## Read the new error category

| Category | Next action |
| --- | --- |
| `KEY_MISSING` / `KEY_FORMAT` | Check the server `.env` value for `OPENAI_API_KEY`; use only the key, without a Bearer prefix, spaces or placeholder text. Restart after editing. |
| `AUTHENTICATION` | The provider returned HTTP 401. Check the active API project key. |
| `ACCESS_DENIED` / `MODEL_OR_ENDPOINT` | Check API project/key permissions, organization restrictions and model access. Share the report to distinguish a metadata check from actual session creation. |
| `QUOTA` / `RATE_LIMIT` | Check the API project's billing/usage limits or retry after the rate limit clears. |
| `TLS_TRUST` | Check the computer clock and your organization's approved CA/proxy configuration. Use the Node version and safe certificate code in the report when asking IT. **Keep TLS certificate verification enabled.** |
| `DNS_LOOKUP` / `NETWORK_CONNECT` / `REQUEST_TIMEOUT` | Check Node's outbound HTTPS, DNS, firewall and approved proxy route. A browser that can browse the web does not establish that this Node process can reach the API. |
| `INVALID_API_REQUEST` | The application request was rejected. Share the report's status, safe parameter/code and provider request ID so the implementation can be corrected. |
| `INVALID_API_RESPONSE` | The metadata endpoint returned an unexpected body, such as a proxy login page. Share the report; HTTP 200 alone is not a passed model-metadata check. |
| `STATE_WRITE` | Check permissions, disk space and the configured state directory. Keep the existing state; do not delete decisions to guess at a fix. |
| `CONNECTION_FAILED` / `APP_FAILURE` | Share the report. The safe metadata may still be insufficient to determine a specific cause. |

If HTTP session creation succeeds but the report shows `browser.webrtc_answer`, `voice.awaiting_start` or `voice.conversation`, investigate the browser transport/playback or session events next. Do not replace API credentials solely because a media transport failed. The report does not claim a final billed duration when the provider's final usage event was never received.

Official references consulted for the patch: [GPT-Live WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc), [OpenAI API errors](https://developers.openai.com/api/docs/guides/error-codes), and [model retrieval](https://developers.openai.com/api/reference/resources/models/methods/retrieve).
