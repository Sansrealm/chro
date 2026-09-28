import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { createWorkday, REPORTS } from '../workday.mjs';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const source = html.match(/<script id="wi-source-data-js">([\s\S]*?)<\/script>/)?.[1];
if (!source) throw new Error('Missing synthetic source');
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox);
const baseline = JSON.parse(JSON.stringify(sandbox.window.WI_DATA));
const directory = () => mkdtemp(join(tmpdir(), 'chro-workday-test-'));
const cell = snapshot => snapshot.cells.find(x => x.month === '2026-09' && x.function === 'Engineering' && x.region === 'EMEA');

test('paged reports reconstruct the entire aggregate schema, and a correction is idempotent', async () => {
  const dir = await directory();
  const origin = createWorkday({ baseline, storageDir: dir });
  const calls = [];
  const connector = createWorkday({ baseline, storageDir: dir, fetchReport: args => {
    calls.push(args); return origin.report(args);
  } });
  await connector.init();
  const before = connector.snapshot();
  assert.deepEqual(before.cells, baseline.cells);
  assert.deepEqual(before.cohorts, baseline.cohorts);
  assert.equal(connector.status().coverage.cells, 240);
  const result = await connector.sync({ batch: 'correction' });
  assert.equal(result.changed, true);
  assert.equal(result.status.lastSuccess.reportRows.TalentCohorts, 20);
  assert.ok(calls.filter(c => c.name === 'Talent').length > 1, 'sync must traverse pages');
  assert.deepEqual(new Set(calls.map(c => c.name)), new Set(REPORTS));
  assert.equal(cell(result.snapshot).flow.goalsSubmitted, cell(before).flow.goalsSubmitted + 17);
  assert.deepEqual(result.snapshot.cohorts, baseline.cohorts);
  assert.equal((await connector.sync({ batch: 'correction' })).changed, false);
  assert.equal(connector.status().lastAttempt.result, 'unchanged');
  const reset = await connector.sync({ batch: 'baseline' });
  assert.equal(reset.changed, true);
  assert.deepEqual(reset.snapshot.cells, baseline.cells);
  assert.equal(reset.status.sourceVersion, before.sourceVersion);
});

test('reconciliation failure records a rejected attempt and retains the previous snapshot', async () => {
  const dir = await directory();
  const connector = createWorkday({ baseline, storageDir: dir });
  await connector.init();
  await connector.sync({ batch: 'correction' });
  const prior = connector.snapshot();
  await assert.rejects(connector.sync({ batch: 'invalid' }), /goalsSubmitted/);
  assert.deepEqual(connector.snapshot(), prior);
  assert.equal(connector.status().lastAttempt.result, 'rejected');
  assert.equal(connector.status().lastSuccess.batch, 'correction');
  const restarted = createWorkday({ baseline, storageDir: dir });
  await restarted.init();
  assert.deepEqual(restarted.snapshot(), prior);
  assert.equal(restarted.status().history.length, 2);
});

test('missing and duplicate paged rows fail closed; concurrent syncs serialize', async () => {
  const dir = await directory();
  const origin = createWorkday({ baseline, storageDir: dir });
  const broken = createWorkday({ baseline, storageDir: dir, fetchReport: async args => {
    const page = await origin.report(args);
    if (args.name === 'Talent' && args.cursor === '0') page.rows[0] = page.rows[1];
    return page;
  } });
  await broken.init();
  await assert.rejects(broken.sync({ batch: 'correction' }), /Duplicate report row/);
  assert.deepEqual(broken.snapshot().cells, baseline.cells);
  const good = createWorkday({ baseline, storageDir: await directory() });
  await good.init();
  const [first, second] = await Promise.all([good.sync({ batch: 'correction' }), good.sync({ batch: 'correction' })]);
  assert.equal(first.changed, true);
  assert.equal(second.changed, false);
  assert.equal(good.status().history.length, 2);
});

test('corrupted persistent state causes a visible startup error', async () => {
  const dir = await directory();
  await writeFile(join(dir, 'workday-synthetic-state.json'), '{not json');
  await assert.rejects(createWorkday({ baseline, storageDir: dir }).init(), /Cannot load synthetic Workday state/);
  assert.equal(await readFile(join(dir, 'workday-synthetic-state.json'), 'utf8'), '{not json');
});
