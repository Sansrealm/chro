# Google Cloud deployment

This workspace runs as a Node 24 container on Cloud Run in `us-central1`, project `project-ed47fc09-912f-41b0-92f`.

- Browser uses HTTPS to reach the UI and API on the same service.
- Cloud Run uses its runtime identity to read/write two private, versioned Cloud Storage objects: the synthetic source snapshot and the investigation/decision journal. Generation preconditions prevent silent concurrent overwrites. Failed storage calls fail visibly.
- Secret Manager injects the shared workspace password and configured OpenAI key. Provider requests originate from the backend; browser voice additionally uses WebRTC. Optional Claude review requires its own key and model.
- GitHub Actions tests pushes and pull requests. Successful `main` builds deploy a container tagged with the commit SHA. Deployment uses OIDC Workload Identity Federation restricted to this repository ID, owner ID and main branch. No service-account key is required.

The app remains a synthetic demonstration, with shared-password access and no Workday or enterprise SSO connection. The saved local `.state` was seeded privately into Cloud Storage once. Subsequent local edits and cloud edits are independent; deployments do not replace cloud state.

## Resources

- Repository: https://github.com/kalyan2212/chro
- Workflow: `.github/workflows/deploy-gcp.yml`
- App: https://chro-127316151094.us-central1.run.app
- State bucket: `project-ed47fc09-912f-41b0-92f-chro-state`, prefix `chro/`
- Artifact Registry repository: `us-central1/chro`
- Runtime identity: `chro-runtime@project-ed47fc09-912f-41b0-92f.iam.gserviceaccount.com`
- Deployment identity: `chro-deploy@project-ed47fc09-912f-41b0-92f.iam.gserviceaccount.com`
- Workload identity provider: `projects/127316151094/locations/global/workloadIdentityPools/chro-github/providers/github`

The workspace password is the existing local APP_PASSWORD when configured, otherwise a generated password saved only to ignored `.cloud-local/workspace-password.txt`. It can also be retrieved by an authorized project owner from Secret Manager secret `chro-app-password`. Never put it in GitHub or documentation.

## Deployment and operation

Push to `main` or run the workflow manually from Actions. Tests and browser review precede deployment. The workflow's final smoke check verifies the public sign-in page; it does not claim provider entitlement or microphone operation.

Cloud Run currently keeps one instance warm with CPU allocated and session affinity, capped at one instance under normal operation. This incurs ongoing compute charges even while idle. Authentication and live voice sessions are in memory: a restart or deployment requires sign-in again and can interrupt voice. Saved evidence, investigations and decisions remain in Cloud Storage. Revisions may briefly overlap; state writes use generation checks. This is not a horizontally scaled multi-user SaaS design.

For rollback, use Cloud Run's Revisions tab to direct traffic to the previous successful revision. Object versioning allows an administrator to recover saved state separately. Cloud Storage versions and container images accumulate until a retention policy is configured. Avoid deleting or replacing objects while users are saving.

`STATE_BUCKET` enables Cloud Storage; `STATE_PREFIX` defaults to `chro`. Without them, existing local `.state` behavior is unchanged. Container COPY rules include only runtime modules and `public/`; `.env`, `.state`, local credentials, tests and screenshots are excluded from the image.

## Verification

Local automated suite: 88 passing tests, including cloud concurrency, restart persistence, generation preconditions and write-failure behavior. Private GCS writes and reads were exercised using the actual bucket. See `CONTINUATION-REVIEW.md`, `REDESIGN.md` and the browser screenshots for presentation review. Cloud deployment verification is recorded after the workflow runs.

First deployment succeeded through [GitHub Actions run 36471158707](https://github.com/kalyan2212/chro/actions/runs/36471158707), commit `0438b52`, revision `chro-00001-79p`. Live Chrome verification at 1920×1080 confirmed Monitor, Investigate and Decide, secure HttpOnly sign-in cookies, unauthenticated API rejection (401), cloud persistence, save/reload with pinned evidence, mobile navigation and no browser JavaScript errors. Screenshots and machine-readable results are in `docs/cloud/`. No upstream model call was made, so model entitlement and real microphone/speaker behavior remain unverified. The six offline preflight checks also passed.

A second successful workflow run [36471660860](https://github.com/kalyan2212/chro/actions/runs/36471660860) deployed commit `7d47fe9`. A fresh revision `chro-verify-7d47fe9` of that image was then created explicitly for persistence verification. Authenticated reads confirmed the saved investigation, the saved decision (including its -$90,000 downside calculation and pinned evidence), and the synthetic source snapshot matched their pre-revision contents exactly. Authentication sessions are recreated after the restart; saved state is external to the instance. No deployment blocker remains. Provider entitlement and physical microphone/speaker checks remain outstanding.
