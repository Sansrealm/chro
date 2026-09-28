# Persistent investigations

Open **Investigate → Investigation notebook**. Enter a question and notes, pin the observations you want to retain, then select **Save investigation**. Select a saved entry and choose **Open investigation** to restore its metric, scope, challenge prompt, notes and pins. Saving changed work creates an immutable version; an identical save is deduplicated. Unsaved edits remain in memory and are lost on reload.

The notebook displays the saved observation and source revision separately from current dashboard analytics. After a source refresh, older saved evidence remains readable. Reopen and repin every stale pinned metric before saving a new version. An observation is descriptive context and does not change scenario inputs. Small-cell display gates remain in force.

`GET /api/investigations` returns `{items}`. `POST /api/investigations` accepts `{question,notes,metricId,scope,challenge,evidenceLedger,sourceVersion}`. The source revision must match the active snapshot. Question and notes limits are 500 and 4000 characters; challenge is `facts`, `alternatives` or `decision`; at most 50 pinned references are accepted. The server validates metric IDs and scope, rebuilds values, definitions and denominators, rejects stale references with 409, and returns a saved record with ID, digest and timestamp. Client numerical values are never authoritative.

The existing `workspace.json` gains an additive `investigations` array; old schema-1 files remain readable and their decisions/audit events are retained. Writes use the same serialized atomic journal replacement. The limit is 100 saved investigations; identical saves do not consume another slot. Audit entries contain record/metric/revision metadata rather than notebook text. Existing shared-password and same-origin checks protect both endpoints.

**Export investigations** downloads the notebook records. **Saved decisions → Export workspace JSON** now includes investigations alongside decisions and audit metadata. The notebook does not approve decisions or store audio/transcripts.

See [continuation review](CONTINUATION-REVIEW.md) for screenshots, verification and outstanding live-service checks.
