import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { answer as makeAnswer, validateRequest } from '../engine.mjs';

const source = readFileSync(new URL('../public/conversation.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

function harness({ deferredPermission = false, answer, deferredAnswer = false } = {}) {
  const canvasText = [];
  const context2d = { fill(){}, fillRect(){}, beginPath(){}, arc(){}, roundRect(){}, fillText(s){ canvasText.push(String(s)); }, measureText(s){ return { width: String(s).length * 12 }; } };
  class Node {
    constructor(name = 'div') { this.name = name; this.children = []; this.listeners = {}; this.dataset = {}; this.attrs = {}; this.hidden = false; this.textContent = ''; this.value = ''; this.style = {}; }
    addEventListener(type, fn) { this.listeners[type] = fn; }
    fire(type, event = {}) { return this.listeners[type]?.({ preventDefault(){}, target: this, ...event }); }
    setAttribute(k, v) { this.attrs[k] = v; }
    getAttribute(k) { return this.attrs[k]; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = [...nodes]; }
    before(node) { this.inserted = node; }
    focus() {}
    scrollIntoView() {}
    getContext() { return context2d; }
    querySelector(s) { return (this.nodes ||= new Map()).get(s) || this.nodes.set(s, new Node(s)).get(s); }
    querySelectorAll() { return []; }
    getTracks() { return []; }
  }
  const host = new Node('host'), root = new Node('root');
  const state = { function: 'all', region: 'all', period: 'quarter', page: 'monitor', decide: { caseId: 'retention' } };
  const navigated = [];
  root.__WI_APP = { state, render(){}, openMetric(id){ navigated.push(['metric', id]); }, openLab(id){ state.decide.caseId = id; navigated.push(['scenario', id]); } };
  let permissionResolve;
  const tracks = [];
  function stream() { const track = { stopped: false, stop(){ this.stopped = true; } }; tracks.push(track); return { getTracks(){ return [track]; } }; }
  let answerResolve;
  const requests = [];
  const recorders = [];
  class Recorder {
    static isTypeSupported(type) { return type.startsWith('audio/'); }
    constructor(s) { this.stream = s; this.state = 'inactive'; recorders.push(this); }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; }
    finish(bytes = 'audio') { this.ondataavailable?.({ data: new Blob([bytes]) }); return this.onstop?.(); }
  }
  const defaultAnswer = { mode: 'api', question: 'Test', answer: 'Six synthetic facts.', title: 'Scenario', scope: { function: 'all', region: 'all', period: 'quarter' }, action: { type: 'scenario', caseId: 'retention', overrides: { effect: .5 } }, facts: Array.from({ length: 6 }, (_, i) => ({ label: `Fact ${i + 1}`, value: String(i + 1), note: 'Synthetic' })), evidence: [], followups: [], boundary: 'Synthetic.' };
  const fetch = async (url, opts) => {
    requests.push({ url, opts });
    if (url === '/api/status') return { ok: true, json: async () => ({ mode: 'api', voiceInput: true, voiceOutput: false }) };
    if (url === '/api/transcribe') return { ok: true, json: async () => ({ text: 'What is the first-year exit rate?' }) };
    if (url === '/api/ask') return { ok: true, json: async () => deferredAnswer ? new Promise(resolve => { answerResolve=resolve; }) : answer || defaultAnswer };
    throw Error(`Unexpected fetch: ${url}`);
  };
  const document = { getElementById(id){ return id === 'wi-app' ? root : id === 'wi-conversation' ? host : null; }, createElement(name){ return new Node(name); } };
  const navigator = { mediaDevices: { getUserMedia: () => deferredPermission ? new Promise(resolve => { permissionResolve = resolve; }) : Promise.resolve(stream()) } };
  const windowEvents = {};
  const window = { addEventListener(type,fn){windowEvents[type]=fn;}, dispatchEvent(event){windowEvents[event.type]?.(event);}, WI_MONITOR: { ids: [] }, WI_DATA: { functions: [], regions: [], periods: ['quarter'] }, MediaRecorder: Recorder, MediaStream: class {} };
  vm.runInNewContext(source, { document, window, navigator, fetch, MediaRecorder: Recorder, Blob, Event, AbortController, structuredClone, Intl, Date, setTimeout, clearTimeout, cancelAnimationFrame(){}, requestAnimationFrame(){ return 1; }, URL, console });
  return { host, root, window, requests, recorders, tracks, resolveAnswer: () => answerResolve(answer || defaultAnswer), resolvePermission: () => permissionResolve(stream()), navigated, canvasText };
}

test('closing while permission is pending stops the late stream', async () => {
  const h = harness({ deferredPermission: true });
  await tick();
  const toggle = h.root.querySelector('#wi-present').inserted;
  toggle.fire('click');
  const pending = h.host.querySelector('#vc-mic').fire('click');
  toggle.fire('click');
  h.resolvePermission();
  await pending;
  assert.equal(h.recorders.length, 0);
  assert.equal(h.tracks[0].stopped, true);
  assert.equal(h.requests.filter(x => x.url === '/api/transcribe').length, 0);
});

test('an old recorder cannot overwrite or transcribe a newer session', async () => {
  const h = harness();
  await tick();
  h.root.querySelector('#wi-present').inserted.fire('click');
  const mic = h.host.querySelector('#vc-mic');
  await mic.fire('click');
  mic.fire('click');
  await mic.fire('click');
  await h.recorders[0].finish('old');
  assert.equal(h.requests.filter(x => x.url === '/api/transcribe').length, 0);
  assert.equal(mic.getAttribute('aria-pressed'), 'true');
  mic.fire('click');
  await h.recorders[1].finish('new');
  await tick();
  await tick();
  assert.equal(h.requests.filter(x => x.url === '/api/transcribe').length, 1);
  assert.equal(h.requests.filter(x => x.url === '/api/ask').length, 1);
  assert.equal(h.host.querySelector('#vc-question').value, 'What is the first-year exit rate?');
});

test('six facts render and trusted scenario action opens the lab with bounded input', async () => {
  const h = harness();
  await tick();
  h.root.querySelector('#wi-present').inserted.fire('click');
  h.host.querySelector('#vc-question').value = 'Model first-year retention';
  await h.host.querySelector('#vc-form').fire('submit');
  await tick();
  const facts = h.host.querySelector('#vc-facts').children;
  assert.equal(facts.length, 6);
  assert.equal(facts[5].children[1].textContent, '6');
  h.host.querySelector('#vc-actions').children[0].fire('click');
  assert.deepEqual(h.navigated, [['scenario', 'retention']]);
  assert.equal(h.root.__WI_APP.state.decide.effect, .5);
});

test('briefing canvas includes program cost, negative net value and complete assumptions', async () => {
  const result = makeAnswer(validateRequest({ question: 'Test the 0.5 pp downside' }), { intent: 'scenario', metricId: null, caseId: 'retention', overrides: { effect: .5 } });
  const h = harness({ answer: result });
  await tick();
  h.root.querySelector('#wi-present').inserted.fire('click');
  h.host.querySelector('#vc-question').value = 'Test the 0.5 pp downside';
  await h.host.querySelector('#vc-form').fire('submit');
  await tick();
  assert.ok(h.canvasText.includes('$240k'));
  assert.ok(h.canvasText.includes('−$90k'));
  assert.ok(h.canvasText.join(' ').includes(result.facts.find(x => x.label === 'Assumptions').value));
});


test('a typed answer does not undo a filter change made while it was loading', async () => {
  const h = harness({ deferredAnswer: true });
  await tick();
  h.root.querySelector('#wi-present').inserted.fire('click');
  h.host.querySelector('#vc-question').value = 'Show headcount';
  h.host.querySelector('#vc-form').fire('submit');
  await tick();
  h.root.__WI_APP.state.function = 'Engineering';
  h.resolveAnswer();
  await tick();
  assert.equal(h.root.__WI_APP.state.function, 'Engineering');
  assert.equal(h.host.querySelector('#vc-result').hidden, true);
  assert.match(h.host.querySelector('#vc-status').textContent, /Filters changed/);
});


test('a committed source refresh invalidates the old answer and its follow-up history', async () => {
  const h = harness();
  await tick();
  await h.window.WI_CONVERSATION.ask('Show headcount');
  assert.equal(h.host.querySelector('#vc-result').hidden,false);
  assert.equal(h.window.WI_CONVERSATION.getHistory().length,2);
  h.window.dispatchEvent(new Event('wi-source-updated'));
  assert.equal(h.host.querySelector('#vc-result').hidden,true);
  assert.equal(h.window.WI_CONVERSATION.getHistory().length,0);
  assert.match(h.host.querySelector('#vc-status').textContent,/Source data refreshed/);
});
