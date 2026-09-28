import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';

// A synthetic custom-report adapter. These names and response envelopes are an
// illustrative RaaS-shaped contract, not assertions about Workday's public API.
export const REPORTS = Object.freeze([
  'CoreHCM', 'Talent', 'Payroll', 'HRServiceSupplement',
  'FinanceSupplement', 'ListeningSupplement', 'TalentCohorts'
]);
const clone = value => JSON.parse(JSON.stringify(value));
const canonical = value => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value;
const hash = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const key = row => JSON.stringify([row.month, row.function, row.region]);
const cohortKey = row => JSON.stringify([row.function, row.region]);
const TALENT_STOCK = new Set(['successionPriorityRoles', 'successionReadyNow', 'criticalCapabilityRequired', 'criticalCapabilityReady']);
const TALENT_FLOW = new Set(['learningAssigned', 'learningCompleted', 'rampUpAssigned', 'rampUpCompleted', 'goalsEligible', 'goalsSubmitted', 'trainingDemands', 'projectsConverted']);
const PAYROLL_STOCK = new Set(['annualCostRunRate', 'costBreakdown', 'loadedPayByLevel', 'annualOTE']);
const FINANCE_STOCK = new Set(['annualBudgetRunRate', 'annualRevenueRunRate']);
const LISTENING_STOCK = new Set(['surveyInvited', 'surveyRespondents', 'surveyFavorable', 'pulseScoreTotal']);
const LISTENING_FLOW = new Set(['absenceDays', 'scheduledDays']);
const FINANCE_FLOW = new Set(['rewardsUSD']);
const partition = (object, predicate) => Object.fromEntries(Object.entries(object).filter(([name]) => predicate(name)));

function sourceRows(baseline, batch, name) {
  const cells = clone(baseline.cells);
  if (batch === 'correction' || batch === 'invalid') {
    const target = cells.find(row => row.month === baseline.months.at(-1) && row.function === 'Engineering' && row.region === 'EMEA');
    if (!target) throw new Error('Missing correction target');
    target.flow.goalsSubmitted = batch === 'invalid'
      ? target.flow.goalsEligible + 1 : Math.min(target.flow.goalsEligible, target.flow.goalsSubmitted + 17);
  }
  if (name === 'TalentCohorts') return clone(baseline.cohorts);
  return cells.map(cell => {
    const id = { month: cell.month, function: cell.function, region: cell.region };
    switch (name) {
      case 'CoreHCM': return { ...id,
        stock: partition(cell.stock, field => !TALENT_STOCK.has(field) && !PAYROLL_STOCK.has(field) && !FINANCE_STOCK.has(field) && !LISTENING_STOCK.has(field)),
        flow: partition(cell.flow, field => !TALENT_FLOW.has(field) && !FINANCE_FLOW.has(field) && !LISTENING_FLOW.has(field)) };
      case 'Talent': return { ...id, stock: partition(cell.stock, field => TALENT_STOCK.has(field)), flow: partition(cell.flow, field => TALENT_FLOW.has(field)) };
      case 'Payroll': return { ...id, stock: partition(cell.stock, field => PAYROLL_STOCK.has(field)) };
      case 'HRServiceSupplement': return { ...id, service: cell.service };
      case 'FinanceSupplement': return { ...id, stock: partition(cell.stock, field => FINANCE_STOCK.has(field)), flow: partition(cell.flow, field => FINANCE_FLOW.has(field)) };
      case 'ListeningSupplement': return { ...id, stock: partition(cell.stock, field => LISTENING_STOCK.has(field)), flow: partition(cell.flow, field => LISTENING_FLOW.has(field)) };
      default: throw new Error(`Unknown report: ${name}`);
    }
  });
}

function assertNumberTree(node, location) {
  if (typeof node === 'number') {
    if (!Number.isFinite(node) || node < 0) throw new Error(`Invalid nonnegative numeric value at ${location}`);
  } else if (node && typeof node === 'object' && !Array.isArray(node)) {
    for (const [k, v] of Object.entries(node)) assertNumberTree(v, `${location}.${k}`);
  } else throw new Error(`Invalid aggregate at ${location}`);
}
function sum(object) { return Object.values(object).reduce((n, v) => n + v, 0); }
function between(n, upper, field) {
  if (!Number.isFinite(n) || n < 0 || n > upper) throw new Error(`Invalid numerator ${field}`);
}
function same(a, b, field) { if (a !== b) throw new Error(`Reconciliation failed: ${field}: ${a} != ${b}`); }

function validate(dataset, baseline) {
  const { cells, cohorts, functions, regions, months } = dataset;
  const expected = functions.length * regions.length * months.length;
  if (cells.length !== expected || cohorts.length !== functions.length * regions.length) throw new Error('Missing monthly cells or cohorts');
  const seen = new Set(), seenCohorts = new Set();
  const byKey = new Map();
  for (const row of cells) {
    const id = key(row);
    if (!months.includes(row.month) || !functions.includes(row.function) || !regions.includes(row.region) || seen.has(id)) throw new Error('Duplicate or unknown monthly dimension key');
    seen.add(id); byKey.set(id, row);
    for (const part of ['stock', 'flow', 'service']) assertNumberTree(row[part], `${id}.${part}`);
    const { stock: s, flow: f, service: q } = row;
    same(f.beginningHeadcount + f.hires - f.voluntaryExits - f.involuntaryExits, s.headcount, `${id} headcount`);
    same(s.fte, s.headcount, `${id} FTE`);
    same(s.annualCostRunRate, sum(s.costBreakdown), `${id} cost components`);
    same(q.beginningBacklog + q.inflow - q.resolved, q.backlog, `${id} service queue`);
    same(q.resolution.closed, q.resolved, `${id} closed cases`);
    same(f.externalHires, f.hires, `${id} external hires`);
    same(f.filledRoles, f.externalHires + f.internalHires, `${id} filled roles`);
    same(f.goalsEligible, s.headcount, `${id} eligible goals`);
    for (const [n, d, label] of [[f.goalsSubmitted, f.goalsEligible, 'goalsSubmitted'], [f.learningCompleted, f.learningAssigned, 'learningCompleted'], [f.rampUpCompleted, f.rampUpAssigned, 'rampUpCompleted'], [s.surveyRespondents, s.surveyInvited, 'surveyRespondents'], [s.surveyFavorable, s.surveyRespondents, 'surveyFavorable'], [q.withinSLA, q.resolved, 'withinSLA'], [q.csat.responses, q.resolved, 'CSAT responses']]) between(n, d, `${id}.${label}`);
    same(sum(s.employeeTypes), s.headcount, `${id} employee types`);
    same(sum(s.jobLevels), s.headcount, `${id} job levels`);
    same(sum(q.openByPriority), q.backlog, `${id} open priorities`);
    same(sum(q.csat.distribution), q.csat.responses, `${id} CSAT distribution`);
  }
  for (const month of months) for (const fn of functions) for (const region of regions) {
    const row = byKey.get(JSON.stringify([month, fn, region]));
    if (!row) throw new Error('Missing month/function/region cell');
    const previousMonth = months[months.indexOf(month) - 1];
    if (previousMonth) {
      const previous = byKey.get(JSON.stringify([previousMonth, fn, region]));
      same(row.flow.beginningHeadcount, previous.stock.headcount, 'headcount continuity');
      same(row.service.beginningBacklog, previous.service.backlog, 'service continuity');
    }
  }
  for (const row of cohorts) {
    const id = cohortKey(row);
    if (!functions.includes(row.function) || !regions.includes(row.region) || seenCohorts.has(id)) throw new Error('Duplicate or unknown cohort key');
    seenCohorts.add(id);
    assertNumberTree(row.current, `${id}.current`); assertNumberTree(row.prior, `${id}.prior`);
    same(row.current.delayed + row.current.onTime, row.current.hires, `${id} cohort partition`);
    same(row.current.delayedFirstYearExits + row.current.onTimeFirstYearExits, row.current.firstYearExits, `${id} cohort exits`);
    between(row.current.delayedFirstYearExits, row.current.delayed, `${id} delayed exits`);
    between(row.current.onTimeFirstYearExits, row.current.onTime, `${id} on-time exits`);
    between(row.prior.firstYearExits, row.prior.hires, `${id} prior exits`);
  }
  if (hash(cohorts) !== hash(baseline.cohorts)) throw new Error('Mature cohort history unexpectedly changed');
  return { expectedCells: expected, cells: seen.size, cohorts: seenCohorts.size,
    months: months.length, functions: functions.length, regions: regions.length, complete: true };
}

function assemble(reports, baseline) {
  const expected = baseline.functions.length * baseline.regions.length * baseline.months.length;
  const maps = new Map();
  for (const name of REPORTS) {
    const rows = reports.get(name);
    if (!Array.isArray(rows) || rows.length !== (name === 'TalentCohorts' ? baseline.cohorts.length : expected)) throw new Error(`Incomplete report: ${name}`);
    const map = new Map();
    for (const row of rows) {
      const id = name === 'TalentCohorts' ? cohortKey(row) : key(row);
      if (map.has(id)) throw new Error(`Duplicate report row in ${name}`);
      map.set(id, row);
    }
    maps.set(name, map);
  }
  const cells = baseline.months.flatMap(month => baseline.functions.flatMap(fn => baseline.regions.map(region => {
    const id = JSON.stringify([month, fn, region]);
    const parts = REPORTS.slice(0, -1).map(name => {
      const row = maps.get(name).get(id);
      if (!row) throw new Error(`Missing ${name} row for ${id}`);
      return row;
    });
    const result = { month, function: fn, region, stock: {}, flow: {}, service: {} };
    for (const part of parts) for (const field of ['stock', 'flow', 'service']) {
      for (const [name, value] of Object.entries(part[field] ?? {})) {
        if (Object.hasOwn(result[field], name)) throw new Error(`Overlapping ${field}.${name} for ${id}`);
        result[field][name] = value;
      }
    }
    return result;
  })));
  const cohorts = baseline.functions.flatMap(fn => baseline.regions.map(region => {
    const row = maps.get('TalentCohorts').get(JSON.stringify([fn, region]));
    if (!row) throw new Error('Missing mature cohort');
    return row;
  }));
  const dataset = { ...clone(baseline), cells, cohorts };
  // Catch dropped fields and unanticipated schema changes, preserving source completeness.
  const expectedFields = (row, field) => Object.keys(row[field]).sort().join('|');
  for (let i = 0; i < cells.length; i++) for (const field of ['stock', 'flow', 'service']) {
    if (expectedFields(cells[i], field) !== expectedFields(baseline.cells[i], field)) throw new Error(`Missing ${field} fields in reconstructed report`);
  }
  return dataset;
}

export function createWorkday({ baseline, storageDir, fetchReport, objectStore } = {}) {
  if (!baseline || !Array.isArray(baseline.cells) || !Array.isArray(baseline.cohorts)) throw new Error('A complete synthetic baseline is required');
  if (!objectStore && (!storageDir || typeof storageDir !== 'string')) throw new Error('storageDir is required');
  const original = clone(baseline), file = join(storageDir || '.', 'workday-synthetic-state.json');
  let state, generation="0", queue = Promise.resolve();
  async function persist(next, expected=generation) {
    if(objectStore){generation=await objectStore.write("workday-synthetic-state.json",next,expected);state=next;return;}
    const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
    try { await writeFile(temporary, JSON.stringify(next), { flag: 'wx', mode: 0o600 }); await rename(temporary, file); }
    catch (error) { await unlink(temporary).catch(() => {}); throw error; }
    state = next;
  }
  function ensureInit() { if (!state) throw new Error('Call init() before using the connector'); }
  async function init() {
    if (state) return status();
    if(!objectStore)await mkdir(storageDir, { recursive: true });
    let stored;
    try { if(objectStore){const current=await objectStore.read('workday-synthetic-state.json');stored=current.data;generation=current.generation;}else stored = JSON.parse(await readFile(file, 'utf8')); }
    catch (error) {
      if (error.code !== 'ENOENT') throw new Error(`Cannot load synthetic Workday state: ${error.message}`);
    }
    if (stored) {
      if (stored.schema !== 1 || !stored.snapshot || !Array.isArray(stored.history) || !stored.version || stored.version !== hash({ sourceRevision: stored.sourceRevision, cells: stored.snapshot.cells, cohorts: stored.snapshot.cohorts })) throw new Error('Corrupt or incompatible synthetic Workday state');
      validate(stored.snapshot, original);
      state = stored;
    } else {
      const snapshot = clone(original), coverage = validate(snapshot, original);
      const sourceRevision = 'synthetic:baseline:v1';
      const version = hash({ sourceRevision, cells: snapshot.cells, cohorts: snapshot.cohorts });
      snapshot.sourceVersion = version;
      try { await persist({ schema: 1, sourceRevision, version, snapshot, coverage, lastAttempt: null, lastSuccess: null, history: [] }); }
      catch(error){if(!objectStore||error.status!==409)throw error;await loadCurrent();}
    }
    return status();
  }
  async function loadCurrent(){
    if(!objectStore)return;
    const current=await objectStore.read('workday-synthetic-state.json'), saved=current.data;
    if(!saved||saved.schema!==1||!saved.snapshot||!Array.isArray(saved.history)||saved.version!==hash({sourceRevision:saved.sourceRevision,cells:saved.snapshot.cells,cohorts:saved.snapshot.cohorts}))throw Error('Cloud synthetic source is missing or invalid. Restore its previous object version.');
    validate(saved.snapshot,original);state=saved;generation=current.generation;
  }
  async function refresh(){await queue;await loadCurrent();}
  function snapshot() { ensureInit(); return clone(state.snapshot); }
  function status() {
    ensureInit();
    return clone({ synthetic: true, connected: false, system: 'Synthetic custom Workday-style reports plus separately labeled supplements',
      sourceVersion: state.version, sourceRevision: state.sourceRevision, lastAttempt: state.lastAttempt,
      lastSuccess: state.lastSuccess, coverage: state.coverage, history: state.history });
  }
  async function report({ name, cursor = '0', limit = 50, batch = 'baseline' } = {}) {
    if (!REPORTS.includes(name)) throw new Error('Unknown synthetic report');
    if (!['baseline', 'correction', 'invalid'].includes(batch)) throw new Error('Unknown synthetic batch');
    const start = Number(cursor);
    if (!Number.isSafeInteger(start) || start < 0 || String(start) !== String(cursor) || !Number.isSafeInteger(limit) || limit < 1 || limit > 200) throw new Error('Invalid report pagination');
    if (fetchReport) return fetchReport({ name, cursor: String(start), limit, batch });
    const rows = sourceRows(original, batch, name);
    if (start > rows.length) throw new Error('Cursor exceeds report length');
    const end = Math.min(rows.length, start + limit);
    return { report: name, batch, sourceRevision: `synthetic:${batch}:v1`, rows: rows.slice(start, end),
      nextCursor: end < rows.length ? String(end) : null, total: rows.length };
  }
  async function performSync(batch) {
    ensureInit();
    await loadCurrent();
    const baseState=state, expected=generation;
    if (!['baseline', 'correction', 'invalid'].includes(batch)) throw new Error('Unknown synthetic batch');
    const attemptedAt = new Date().toISOString();
    try {
      const reports = new Map(); let revision;
      for (const name of REPORTS) {
        let cursor = '0', total, pages = 0;
        const seen = new Set(), rows = [];
        do {
          if (seen.has(cursor) || ++pages > 1000) throw new Error(`Pagination loop in ${name}`);
          seen.add(cursor);
          const page = await report({ name, batch, cursor, limit: 37 });
          if (!page || page.report !== name || page.batch !== batch || !Array.isArray(page.rows) || !page.rows.length || !Number.isSafeInteger(page.total)) throw new Error(`Malformed ${name} report page`);
          if (revision && revision !== page.sourceRevision) throw new Error('Mixed source revisions in sync');
          revision = page.sourceRevision;
          if (total != null && total !== page.total) throw new Error(`Report total changed in ${name}`);
          total = page.total;
          rows.push(...page.rows);
          if (rows.length > total) throw new Error(`Excess rows in ${name}`);
          cursor = page.nextCursor;
          if (cursor != null && (typeof cursor !== 'string' || !/^\d+$/.test(cursor))) throw new Error(`Invalid next cursor in ${name}`);
        } while (cursor != null);
        if (rows.length !== total) throw new Error(`Incomplete pages in ${name}`);
        reports.set(name, rows);
      }
      const candidate = assemble(reports, original), coverage = validate(candidate, original);
      const version = hash({ sourceRevision: revision, cells: candidate.cells, cohorts: candidate.cohorts });
      const changed = version !== baseState.version;
      const outcome = { at: attemptedAt, batch, sourceRevision: revision, sourceVersion: version,
        result: changed ? 'applied' : 'unchanged', reportRows: Object.fromEntries([...reports].map(([name, rows]) => [name, rows.length])) };
      candidate.sourceVersion = version;
      await persist({ ...baseState, snapshot: changed ? candidate : baseState.snapshot,
        version, sourceRevision: revision, coverage, lastAttempt: outcome, lastSuccess: outcome,
        history: [...baseState.history, outcome] }, expected);
      return { changed, status: status(), snapshot: snapshot() };
    } catch (error) {
      if(error.status===409)throw error;
      const failure = { at: attemptedAt, batch, result: 'rejected', error: error.message };
      await persist({ ...baseState, lastAttempt: failure, history: [...baseState.history, failure] }, expected);
      throw error;
    }
  }
  function sync({ batch = 'baseline' } = {}) {
    const next = queue.then(() => performSync(batch));
    queue = next.catch(() => {});
    return next;
  }
  return { init, refresh, snapshot, status, sync, report };
}
