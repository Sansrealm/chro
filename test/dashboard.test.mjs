import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { descriptor, metricIds, answer, validateRequest } from '../engine.mjs';

// Exercise the shipped dashboard scripts. This does not emulate browser layout or media.
function dashboard() {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const node = id => ({ id, innerHTML: '', textContent: '', dataset: {}, hidden: false,
    classList: { toggle() {} }, setAttribute() {}, removeAttribute() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    getBoundingClientRect() { return { width: 600 }; }, addEventListener() {} });
  const nodes = Object.fromEntries(['wi-app', 'wi-main', 'wi-domains', 'wi-filters', 'wi-present', 'wi-tour', 'wi-status'].map(id => [id, node(id)]));
  const root = nodes['wi-app'];
  root.querySelector = selector => nodes[selector.slice(1)] || null;
  root.contains = () => true;
  const context = vm.createContext({ window: {},
    document: { getElementById: id => nodes[id], createElement: node, body: { appendChild() {} }, head: { appendChild() {} } },
    console, Intl, Date, Blob, URL, setTimeout: () => {}, clearTimeout() {} });
  for (const name of ['data', 'coverage', 'ui', 'monitor', 'decide', 'lab-visuals', 'brief', 'app']) {
    const id = `wi-source-${name}-js`;
    const source = html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`))?.[1];
    assert.ok(source, `Shipped ${id} exists`);
    vm.runInContext(source, context, { timeout: 2000, filename: id });
  }
  return { app: root.__WI_APP, nodes, window: context.window };
}

test('shipped dashboard retains all 38 People/Operations views and six visual decision labs', () => {
  const { app, nodes } = dashboard();
  assert.match(nodes['wi-main'].innerHTML, /8,000/);
  const seen = new Set();
  for (const [domain, pillars] of Object.entries({ people: ['grow', 'develop', 'diversify', 'empower', 'reward'], operations: ['onboarding', 'care', 'improve', 'satisfaction', 'relations'] })) {
    for (const pillar of pillars) {
      Object.assign(app.state, { page: 'monitor', domain, [domain]: pillar }); app.render();
      assert.doesNotMatch(nodes['wi-main'].innerHTML, /NaN|Infinity/);
      for (const match of nodes['wi-main'].innerHTML.matchAll(/data-metric-id="([OP]\d+)"/g)) seen.add(match[1]);
    }
  }
  assert.equal(seen.size, 38);
  for (const caseId of ['retention', 'skills', 'delivery', 'continuity', 'service', 'capacity']) {
    app.openLab(caseId);
    assert.match(nodes['wi-main'].innerHTML, /wi-lab-viz/);
    assert.doesNotMatch(nodes['wi-main'].innerHTML, /NaN|Infinity/);
  }
});

test('spoken metric values match every dashboard inspector across representative scopes', () => {
  const { app } = dashboard();
  for (const scope of [
    { function: 'all', region: 'all', period: 'quarter' },
    { function: 'Engineering', region: 'EMEA', period: '2026-01' },
    { function: 'Corporate', region: 'Other', period: 'rolling12' }
  ]) {
    Object.assign(app.state, scope);
    for (const id of metricIds) {
      const visible = app.describe(id), spoken = descriptor(id, scope);
      assert.equal(spoken.value, visible.value, `${id} ${JSON.stringify(scope)}`);
      assert.equal(spoken.unit, visible.unit, id);
    }
  }
});

test('named-month response scope has matching labels and selected dashboard control', () => {
  const { app, nodes } = dashboard();
  Object.assign(app.state, { function: 'Engineering', region: 'EMEA', period: '2026-01' });
  app.openMetric('P01');
  assert.match(nodes['wi-main'].innerHTML, /January 2026/);
  assert.match(nodes['wi-filters'].innerHTML, /value="2026-01" selected>January 2026/);
  assert.doesNotMatch(nodes['wi-main'].innerHTML, /NaN|Invalid Date/);
});

test('complete response assumptions reproduce results while retaining the case working draft', () => {
  const { app, window } = dashboard();
  app.openLab('retention');
  app.state.decide.programCost = 600000;
  app.state.decide.record.rationale = 'A saved working rationale';
  const request = validateRequest({ question: 'Test the 0.5 pp downside', scope: { function: 'Engineering', region: 'all', period: 'quarter' } });
  const response = answer(request, { intent: 'scenario', metricId: null, caseId: 'retention', overrides: { effect: 0.5 } });
  Object.assign(app.state, response.scope);
  app.openLab(response.action.caseId);
  Object.assign(app.state.decide, response.action.overrides);
  app.render();
  assert.equal(window.WI_DECIDE.calculate(app.state.decide).retention.net, -90000);
  assert.equal(app.state.decide.record.rationale, 'A saved working rationale');
});


test('restored evidence context displays the formatted observation with its scoped basis', () => {
  const { app, nodes } = dashboard();
  app.openLab('retention');
  app.state.decide.context={metricId:'C01',metricLabel:'First-year exit rate',value:0.14,unit:'ratio',formatted:'14.0%',numerator:168,denominator:1200,scope:{function:'all',region:'all',period:'quarter'}};
  app.render();
  assert.match(nodes['wi-main'].innerHTML,/Evidence handoff:[\s\S]*14\.0%/);
  assert.match(nodes['wi-main'].innerHTML,/168 \/ 1200/);
  assert.doesNotMatch(nodes['wi-main'].innerHTML,/0\.14ratio/);
});
