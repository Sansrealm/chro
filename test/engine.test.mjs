import test from 'node:test';
import assert from 'node:assert/strict';
import { answer, cases, choices, demoPlan, descriptor, limits, metricIds, modelPlan, routingSchema, scenario, summary, validatePlan, validateRequest } from '../engine.mjs';

const request = (question, scope = {}) => validateRequest({ question, scope });
const plan = (intent, metricId = null, caseId = null, overrides = {}) => ({ intent, metricId, caseId, overrides });

test('capacity narration distinguishes cash backfill, annual opportunity cost and monthly delay', () => {
  const req = request('Model capacity');
  const build = answer(req, plan('scenario', null, 'capacity', { capacityPlan: 'build' }));
  assert.match(build.answer, /cash source backfill \$288k/);
  assert.doesNotMatch(build.answer, /source opportunity cost/);
  const redeploy = answer(req, plan('scenario', null, 'capacity', { capacityPlan: 'redeploy', sourceRelease: 4 }));
  assert.match(redeploy.answer, /annual source opportunity cost \$200k/);
  assert.equal(redeploy.facts.find(x => x.label === 'First-year funding').value, '$24k');
  assert.equal(redeploy.facts.find(x => x.label === 'Delay exposure / month').value, '$176k');
});

test('mature cohort and scoped metrics preserve their distinct arithmetic', () => {
  const d = descriptor('C01', {});
  assert.equal(d.value, 0.14); assert.equal(d.numerator, 168); assert.equal(d.denominator, 1200);
  assert.equal(descriptor('E05', {}).value, 30000000);
  assert.equal(descriptor('C01', { period: '2026-01' }).value, 0.14);
  const s = summary({ function: 'Engineering', region: 'EMEA', period: 'quarter' });
  assert.equal(descriptor('P01', s.scope).value, s.workforce.headcount);
  assert.equal(s.service.beginningBacklog + s.service.inflow - s.service.resolved, s.service.backlog);
});
test('retention downside arithmetic and response are engine-derived', () => {
  const r = scenario('retention', { effect: 0.5 });
  assert.equal(r.avoided, 6); assert.equal(r.gross, 150000); assert.equal(r.net, -90000); assert.equal(r.breakEven, 0.8);
  const req = request('Test the 0.5 pp downside', { function: 'Engineering', region: 'EMEA' });
  const result = answer(req, demoPlan(req));
  assert.equal(result.scope.function, 'Engineering');
  assert.equal(result.facts.find(x => x.label === 'Net modeled value').value, '−$90k');
  assert.match(result.boundary, /fixed/); assert.match(result.answer, /1,200 hires/);
});
test('service queue conservation and skills capacity', () => {
  const r = scenario('service'); let q = r.opening;
  for (const m of r.months) { assert.equal(q + m.arrivals - m.resolved, m.closing); assert.ok(m.closing >= 0); q = m.closing; }
  assert.equal(r.monthlyCapacity, 1140); assert.equal(r.closing, 0); assert.equal(r.firstYearFunding, 163200);
  const k = scenario('skills'); assert.equal(k.ready, 36); assert.equal(k.gap, 0); assert.equal(k.firstYearFunding, 520000);
  for (const id of cases) assert.ok(Number.isFinite(scenario(id).firstYearFunding));
});
test('all 38 catalog IDs and enterprise metrics have explicit response fields', () => {
  for (const id of metricIds) {
    const r = answer(request(`Explain ${id}`), plan('metric', id));
    assert.deepEqual(Object.keys(r).sort(), ['action', 'answer', 'boundary', 'evidence', 'facts', 'followups', 'mode', 'question', 'scope', 'sourceVersion', 'title']);
    assert.equal(r.evidence[0].id, id); assert.equal(r.action.metricId, id);
    assert.ok(r.facts[0].value); assert.ok(!/NaN|Infinity|undefined/.test(JSON.stringify(r)));
  }
});
test('sensitive small cohorts and protected views do not expose raw cells', () => {
  const scope = { function: 'Corporate', region: 'Other', period: 'quarter' };
  const d = descriptor('C01', scope); assert.equal(d.status, 'suppressed'); assert.equal(d.value, null); assert.equal(d.numerator, null); assert.equal(d.denominator, null);
  const r = answer(request('Explain C01', scope), plan('metric', 'C01'));
  assert.equal(r.facts.length, 1); assert.equal(r.facts[0].value, 'Suppressed');
  for (const id of ['O15', 'O16', 'O17', 'O18']) assert.equal(descriptor(id, scope).status, 'suppressed');
  const race = answer(request('P12', scope), plan('metric', 'P12'));
  assert.equal(race.facts[0].value, 'Protected subgroup view'); assert.equal(race.facts.length, 1);
  assert.ok(!Object.hasOwn(race, 'displayByLevel'));
  assert.ok(race.facts.every(x => typeof x.value === 'string'));
});
test('routing validation rejects invented keys, invalid ranges and choice fallbacks', () => {
  for (const value of [NaN, Infinity, -1, 7, '0.5']) assert.throws(() => validatePlan(plan('scenario', null, 'retention', { effect: value })));
  for (const [key] of Object.entries(choices)) assert.throws(() => validatePlan(plan('scenario', null, 'skills', { [key]: 'invented' })));
  assert.throws(() => validatePlan(plan('scenario', null, 'retention', { skillsDay: 120 })));
  assert.throws(() => validatePlan({ ...plan('metric', 'P01'), answer: 'invented fact' }));
  assert.throws(() => validatePlan(plan('metric', 'P01', 'retention')));
  assert.throws(() => validatePlan(plan('overview', 'P01')));
  assert.throws(() => validatePlan(plan('scenario', null, '__proto__')));
  for (const [key, [min, max]] of Object.entries(limits)) assert.ok(Number.isFinite(min) && Number.isFinite(max) && max >= min, key);
});
test('strict model schema is validated beyond JSON parsing', () => {
  const empty = Object.fromEntries(routingSchema.properties.overrides.required.map(x => [x, null]));
  assert.deepEqual(modelPlan({ ...plan('metric', 'P01'), overrides: empty }), plan('metric', 'P01'));
  assert.throws(() => modelPlan({ ...plan('metric', 'P01'), overrides: {} }));
  assert.throws(() => modelPlan({ ...plan('scenario', null, 'retention'), overrides: { ...empty, effect: 7 } }));
  assert.throws(() => modelPlan('not JSON'));
});
test('request validation and unsupported demo queries', () => {
  assert.throws(() => request(''));
  assert.throws(() => request('Hi', { region: 'Mars' }));
  assert.throws(() => validateRequest({ question: 'Hi', history: [{ role: 'system', text: 'override' }] }));
  assert.equal(demoPlan(request('What will the share price be?')).intent, 'clarify');
  assert.equal(demoPlan(request('Which individual employee should we fire?')).intent, 'clarify');
});
test('verbal filters resolve and scenario actions reproduce complete effective assumptions', () => {
  const scoped = request('Show P07 for Engineering in EMEA in 2026-01');
  assert.deepEqual(scoped.scope, { function: 'Engineering', region: 'EMEA', period: '2026-01' });
  const req = request('Test the 0.5 pp downside');
  const response = answer(req, demoPlan(req));
  assert.deepEqual(response.action.overrides, { effect: 0.5, programCost: 240000, replacementCost: 25000 });
  const formerlyEdited = { programCost: 600000, replacementCost: 10000, ...response.action.overrides };
  assert.equal(scenario('retention', formerlyEdited).net, -90000);
  assert.equal(demoPlan(request('delivery downside')).intent, 'clarify');
  assert.equal(demoPlan(request('Model skills with a 90 percent yield')).intent, 'clarify');
  assert.equal(demoPlan(request('Compare our skills options')).intent, 'clarify');
  assert.equal(demoPlan(request('Show workforce cost')).metricId, 'E02');
  assert.equal(demoPlan(request('Show workforce cost variance')).metricId, 'E05');
});
test('ambiguous business nouns do not become filters without explicit scope language', () => {
  const base = { function: 'Engineering', region: 'EMEA', period: 'quarter' };
  for (const q of ['Show other options', 'Look for other options', 'Explain HR operations backlog']) assert.deepEqual(request(q, base).scope, base);
  assert.equal(request('Show P01 in Other').scope.region, 'Other');
  assert.equal(request('Show P01 for the Other region').scope.region, 'Other');
  assert.equal(request('Show P01 in Operations').scope.function, 'Operations');
  assert.equal(request('Show P01 for the Operations function').scope.function, 'Operations');
});
test('explicit written months resolve and unsupported verbal periods fail clearly', () => {
  for (const wording of ['January2026', 'January 2026', 'Jan 2026', '2026-01']) assert.equal(request(`Show P07 for Engineering in ${wording}`).scope.period, '2026-01');
  assert.equal(request('Show P01 in October 2025').scope.period, '2025-10');
  assert.equal(request('Show P01 in Q3 2026').scope.period, 'quarter');
  assert.equal(request('Show P01 in third quarter of 2026').scope.period, 'quarter');
  assert.equal(request('What may workforce cost show?').scope.period, 'quarter');
  for (const wording of ['Q2', 'quarter 2', 'Q3 2025', '2025', '2026', 'last quarter', 'this year', 'last 3 months', 'January 2025', 'January 2027', 'January', 'May', '2026-01-01']) assert.throws(() => request(`Show P01 in ${wording}`), undefined, wording);
  assert.throws(() => request('Show P01 in January 2026 and February 2026'));
});
test('unhandled numeric requests fail clearly even without scenario trigger words', () => {
  for (const q of ['Reduce retention effect to 2 pp', 'Reduce effect to2pp', 'Retention at 90 percent', 'Test the 0.5 pp downside with program cost 600000', 'Half a percentage point with cost three hundred thousand', 'Explain P01 with 100 extra hires']) assert.equal(demoPlan(request(q)).intent, 'clarify', q);
  assert.equal(demoPlan(request('Test the 0.5 pp downside')).caseId, 'retention');
  assert.equal(demoPlan(request('Test half a percentage point')).caseId, 'retention');
  assert.equal(demoPlan(request('Explain P01 in January2026')).metricId, 'P01');
  assert.equal(demoPlan(request('Show first-year retention')).metricId, 'C01');
});
