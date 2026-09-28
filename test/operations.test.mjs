import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

const source = await readFile(new URL('../public/operations.js', import.meta.url), 'utf8');
const sandbox = {};
runInNewContext(source, sandbox);
const core = sandbox.WI_OPERATIONS_CORE;

test('model configuration is never presented as a verified call', () => {
  assert.match(core.modelLabel({ mode: 'api' }), /Configured.*unverified/);
  assert.match(core.modelLabel({ mode: 'demo' }), /Not configured.*demo/);
});

test('snapshot extraction accepts connector response or direct snapshot and refuses malformed data', () => {
  const snapshot = { cells: [{ id: 1 }], cohorts: { current: {} }, sourceVersion: 'abc123' };
  assert.equal(core.getSnapshot({ snapshot }), snapshot);
  assert.equal(core.getSnapshot(snapshot), snapshot);
  assert.equal(core.validSnapshot(snapshot), true);
  assert.equal(core.validSnapshot({ ...snapshot, cells: [] }), false);
  assert.equal(core.validSnapshot({ ...snapshot, sourceVersion: undefined }), false);
  assert.equal(core.getSnapshot({ status: {} }), null);
});

test('browser diagnostic requires secure capture and both WebM media paths', () => {
  const ready = { secure: true, mediaDevices: true, mediaRecorder: true, audioContext: true, canvasCapture: true, webm: true };
  assert.equal(core.mediaSupport(ready), '');
  assert.match(core.mediaSupport({ ...ready, secure: false }), /secure context/);
  assert.match(core.mediaSupport({ ...ready, mediaDevices: false }), /Microphone/);
  assert.match(core.mediaSupport({ ...ready, webm: false }), /WebM/);
});
