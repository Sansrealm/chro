# Synthetic Workday-style report integration

This runnable connector simulates paged, aggregate custom reports. It makes no network calls and does not contain Workday credentials, tenant configuration, employee records, or real customer data. Its report names and JSON envelopes are **illustrative contracts**, not exact Workday API schemas. The seeded organization, monthly aggregates, and correction are fictional.

## Data ownership and mapping

| Mock report | Data carried | Origin represented |
| --- | --- | --- |
| `CoreHCM` | Month, function, region; employee counts, positions, job levels, demographic aggregates, recruiting/mobility flows | Synthetic Workday HCM and Recruiting-style custom report |
| `Talent` | Capability, succession, learning, onboarding ramp, and goals aggregates | Synthetic Workday Talent/Learning-style custom report |
| `Payroll` | Annual loaded payroll cost, overtime, contractor cost, and target pay aggregates | Synthetic payroll-style custom report; actual contractor invoices require Finance |
| `HRServiceSupplement` | Case inflow, resolution, backlog, SLA, onboarding service, satisfaction, and employee relations aggregates | Separate **synthetic HR service feed** (e.g. ServiceNow HRSD); not a Workday claim |
| `FinanceSupplement` | Annual budget/revenue run rates and aggregate recognition awards | Separate **synthetic Finance feed**; not a Workday claim |
| `ListeningSupplement` | Survey invitation/response/favorability, absence and scheduled days | Separate **synthetic listening/time feed**; not a Workday claim |
| `TalentCohorts` | 20 function × region mature hire-cohort aggregates | Separate fixed, fully observed synthetic cohort extract |

Each of the first six reports contains 240 rows at function × region × month grain (5 × 4 × 12). Cohorts are distinct from the 12-month hire and exit flow. The adapter requests 37 rows per page, joins all reports by their dimension keys, checks missing/duplicate records and field ownership, validates reconciliations, and atomically replaces the active snapshot only after all reports pass. Reconstructed snapshots retain the original data definitions and metadata. They contain aggregate synthetic values only; no employee-level data is exposed.

## Connector contract

`createWorkday({baseline,storageDir,fetchReport?})` creates an instance. Call `await init()` once before other methods. `baseline` is the exported complete synthetic dataset; `storageDir` is a writable runtime directory outside distributed artifacts. `fetchReport` is an optional async custom report fetcher with the same `{name,cursor,limit,batch}` input and response as `report`; if omitted, the in-process mock source is used.

- `snapshot()` returns a defensive copy of the complete dataset with `sourceVersion`.
- `status()` returns `synthetic`, `connected`, `system`, `sourceVersion`, `sourceRevision`, `lastAttempt`, `lastSuccess`, `coverage`, and `history`. Timestamps are UTC ISO strings; report row counts and rejection reasons appear in the attempt history. Rejected attempts do not overwrite the last successful snapshot.
- `report({name,cursor='0',limit=50,batch='baseline'})` returns `{report,batch,sourceRevision,rows,nextCursor,total}`. `nextCursor` is a decimal offset string or `null`. Limit is 1–200. Report rows are aggregate synthetic records.
- `await sync({batch:'baseline'|'correction'|'invalid'})` returns `{changed,status,snapshot}` on success. Validation errors throw; the prior version remains active and the rejected attempt is audited. Calls on the same instance serialize. `correction` adds up to 17 goal submissions to Engineering/EMEA in September 2026, bounded by the eligible count. Repeating the correction is unchanged. `invalid` deliberately puts submissions above eligibility and fails. `baseline` explicitly restores the seeded snapshot.

`sourceRevision` names the mock batch; `sourceVersion` is a SHA-256 digest of the source revision and canonically serialized active cells and cohorts. A semantically identical replay yields the same version. It is a dataset revision, not a timestamp or a guarantee of external source provenance. The active state and append-only attempt history reside in `workday-synthetic-state.json` in `storageDir`, written by temporary-file rename. A corrupt file causes a visible startup failure rather than a silent reset.

The validation checks dimension coverage and uniqueness; finite, nonnegative aggregate values; monthly headcount and case queue conservation and continuity; cost components; counts bounded by their eligible denominators; filled roles; employee type/job level partitions; CSAT distributions; and mature-cohort partitions and exit bounds. For a real tenant, a production adapter needs explicit tenant-approved report definitions, effective-dated incremental watermarks, authentication and authorization, schema/version handling, employee privacy controls at the source, source-system reconciliation, and separate approved connectors for the supplement feeds. This mock supplies none of those production controls.
