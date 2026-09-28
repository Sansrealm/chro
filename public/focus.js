/* Focus layer: header capsule, scope chip and overflow menu. Presentation only:
   it drives the existing Ask, voice, connections and saved-decision controls by
   their own buttons and reads their visible state; no request or data logic here. */
(() => {
 'use strict';
 const root = document.getElementById('wi-app');
 const toolbar = root?.querySelector('.wi-toolbar'), tools = root?.querySelector('.wi-tools'), workflow = root?.querySelector('.wi-workflow');
 const sheet = document.getElementById('wi-conversation');
 if (!root || !toolbar || !tools || !workflow || !sheet) return;
 const q = sel => document.querySelector(sel);
 const svg = {
  mic: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z M5 11a7 7 0 0 0 14 0 M12 18v3"/></svg>',
  muted: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 9v3a3 3 0 0 0 5.1 2.1 M15 9.3V6a3 3 0 0 0-5.7-1.3 M5 11a7 7 0 0 0 11.8 5 M19 11a7 7 0 0 1-.6 2.8 M12 18v3 M3 3l18 18"/></svg>',
  keys: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18v12H3z M7 10h1 M11 10h1 M15 10h1 M7 14h10"/></svg>',
  send: '<svg viewBox="0 0 12 12" aria-hidden="true"><rect width="12" height="12" rx="2" fill="currentColor"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>',
  left: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M15 6l-6 6 6 6"/></svg>',
  right: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>',
  more: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>'
 };

 // Scope chip: the filter bar becomes a popover opened from one line of text.
 const filters = q('#wi-filters');
 const chip = document.createElement('button');
 chip.type = 'button'; chip.id = 'fx-scope'; chip.className = 'fx-scope'; chip.setAttribute('aria-controls', 'wi-filters'); chip.setAttribute('aria-expanded', 'false');
 workflow.after(chip);
 const optionText = id => { const s = q(id); return s?.selectedOptions?.[0]?.textContent?.trim() || ''; };
 let lastScope = '';
 function updateChip() {
  const text = [optionText('#wi-function'), optionText('#wi-region'), optionText('#wi-period')].filter(Boolean).join(' · ');
  chip.hidden = !text; if (!text) setFilters(false);
  chip.innerHTML = ''; chip.append(text); chip.insertAdjacentHTML('beforeend', svg.down);
  chip.setAttribute('aria-label', 'Scope: ' + text + '. Change filters');
  if (lastScope && text && text !== lastScope && !root.classList.contains('fx-filters-open')) { chip.classList.remove('fx-changed'); void chip.offsetWidth; chip.classList.add('fx-changed'); setTimeout(() => chip.classList.remove('fx-changed'), 2600); }
  lastScope = text;
 }
 function place(el, anchor, width) {
  const r = anchor.getBoundingClientRect(), w = Math.min(width, innerWidth - 24);
  el.style.setProperty('--fx-top', Math.round(r.bottom + 8) + 'px');
  el.style.setProperty('--fx-left', Math.round(Math.max(12, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 12))) + 'px');
  el.style.setProperty('--fx-width', Math.round(w) + 'px');
 }
 function setFilters(open) {
  root.classList.toggle('fx-filters-open', open); chip.setAttribute('aria-expanded', String(open));
  if (open) { place(filters, chip, 760); filters.querySelector('select,button')?.focus({ preventScroll: true }); }
 }
 chip.addEventListener('click', () => { const open = !root.classList.contains('fx-filters-open'); setFilters(open); if (open) { setMenu(false); setSheet(false); } });
 if (filters) new MutationObserver(updateChip).observe(filters, { childList: true, subtree: true });
 root.addEventListener('change', e => { if (e.target.closest?.('#wi-filters')) setTimeout(updateChip); });
 updateChip();

 // Overflow menu: rarely used tools move out of the header.
 const more = document.createElement('button');
 more.type = 'button'; more.id = 'fx-more'; more.className = 'wi-btn fx-more'; more.innerHTML = svg.more;
 more.setAttribute('aria-label', 'More: connections, saved decisions, voice help'); more.setAttribute('aria-haspopup', 'true'); more.setAttribute('aria-expanded', 'false'); more.setAttribute('aria-controls', 'fx-menu');
 const menu = document.createElement('div');
 menu.id = 'fx-menu'; menu.className = 'fx-menu'; menu.hidden = true;
 tools.append(more); root.append(menu);
 const moved = [tools.querySelector('.wo-toggle'), [...tools.querySelectorAll('button')].find(b => b.getAttribute('aria-controls') === 'ww-panel')].filter(Boolean);
 moved.forEach(b => { b.classList.add('fx-menu-item'); menu.append(b); });
 function menuItem(label, onClick) { const b = document.createElement('button'); b.type = 'button'; b.className = 'wi-btn fx-menu-item'; b.textContent = label; b.addEventListener('click', onClick); menu.append(b); return b; }
 const briefing = menuItem('Show visual briefing', () => { const on = !root.classList.contains('fx-briefing'); root.classList.toggle('fx-briefing', on); briefing.setAttribute('aria-pressed', String(on)); briefing.textContent = on ? 'Hide visual briefing' : 'Show visual briefing'; if (on) openSheet(); });
 briefing.setAttribute('aria-pressed', 'false');
 const liveToggle = q('#wl-toggle');
 if (liveToggle) menuItem('Voice connection help', () => { if (liveToggle.getAttribute('aria-expanded') !== 'true') liveToggle.click(); q('#wi-live')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); });
 function setMenu(open) { menu.hidden = !open; more.setAttribute('aria-expanded', String(open)); if (open) { place(menu, more, 260); menu.querySelector('button')?.focus({ preventScroll: true }); } }
 more.addEventListener('click', () => { const open = menu.hidden; setMenu(open); if (open) { setFilters(false); setSheet(false); } });
 menu.addEventListener('click', e => { if (e.target.closest('button')) setMenu(false); });

 // Capsule: one place to talk, type and read the current answer.
 const wrap = document.createElement('div'); wrap.className = 'fx-capsule-wrap';
 wrap.innerHTML = `<div class="fx-capsule" data-state="idle"><button type="button" class="fx-orb"></button><button type="button" class="fx-display" aria-controls="wi-conversation" aria-expanded="false"><span class="fx-text">Ask Workforce</span></button><button type="button" class="fx-end" hidden aria-label="End conversation">${svg.send}<span>End</span></button><button type="button" class="fx-nav fx-back" hidden aria-label="Previous view">${svg.left}</button><button type="button" class="fx-nav fx-fwd" hidden aria-label="Next view">${svg.right}</button><button type="button" class="fx-expand" hidden aria-controls="wi-conversation" aria-expanded="false" aria-label="Show answer detail">${svg.down}</button><span class="fx-progress" aria-hidden="true"></span></div><span class="fx-sr" role="status" aria-live="polite"></span>`;
 chip.after(wrap);
 const cap = wrap.querySelector('.fx-capsule'), orb = cap.querySelector('.fx-orb'), display = cap.querySelector('.fx-display'), text = cap.querySelector('.fx-text'), end = cap.querySelector('.fx-end'), expand = cap.querySelector('.fx-expand'), back = cap.querySelector('.fx-back'), fwd = cap.querySelector('.fx-fwd'), sr = wrap.querySelector('.fx-sr');
 sheet.classList.add('fx-sheet');
 const askToggle = root.querySelector('.vc-toggle');
 const ensureAskOpen = () => { if (askToggle && askToggle.getAttribute('aria-expanded') !== 'true') askToggle.click(); };
 function setSheet(open) {
  root.dataset.fxSheet = open ? 'open' : 'closed';
  display.setAttribute('aria-expanded', String(open)); expand.setAttribute('aria-expanded', String(open)); expand.setAttribute('aria-label', open ? 'Hide answer detail' : 'Show answer detail');
  if (open) place(sheet, cap, 580);
 }
 function openSheet({ focusInput = false } = {}) {
  ensureAskOpen(); setMenu(false); setFilters(false); setSheet(true);
  if (focusInput) q('#vc-question')?.focus({ preventScroll: true });
 }
 setSheet(false);
 display.addEventListener('click', () => root.dataset.fxSheet === 'open' ? setSheet(false) : openSheet({ focusInput: !hasAnswer() }));
 expand.addEventListener('click', () => root.dataset.fxSheet === 'open' ? setSheet(false) : openSheet());
 end.addEventListener('click', () => q('#wl-stop')?.click());
 // Going to the data closes the sheet so the dashboard is unobstructed.
 sheet.addEventListener('click', e => { if (e.target.closest('#vc-actions .vc-primary')) setSheet(false); });

 let notice = null, noticeTimer = 0, prevLiveState = '', liveAttempt = false;
 function flash(message, kind = 'error') { notice = { text: message, kind }; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { notice = null; render(); }, 8000); render(); }
 const visible = el => !!el && !el.hidden;
 const hasAnswer = () => visible(q('#vc-result')) && !!q('#vc-title')?.textContent;
 const canLive = () => { const b = q('#wl-start'); return !!b && !b.disabled; };
 const canRecord = () => { const b = q('#vc-mic'); return !!b && !b.disabled; };
 orb.addEventListener('click', () => {
  const s = cap.dataset.state;
  if (s === 'listening' || s === 'muted') { q('#wl-mute')?.click(); return; }
  if (s === 'connecting') return;
  if (s === 'recording') { q('#vc-mic')?.click(); return; }
  if (s === 'speaking') { q('#vc-stop')?.click(); return; }
  notice = null;
  if (canLive()) { liveAttempt = true; q('#wl-start').click(); return; }
  if (canRecord()) { ensureAskOpen(); setSheet(root.dataset.fxSheet === 'open'); q('#vc-mic').click(); return; }
  openSheet({ focusInput: true });
 });
 document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (root.classList.contains('fx-filters-open')) { setFilters(false); chip.focus(); }
  else if (!menu.hidden) { setMenu(false); more.focus(); }
  else if (root.dataset.fxSheet === 'open' && (sheet.contains(document.activeElement) || cap.contains(document.activeElement))) { setSheet(false); display.focus(); }
 });
 document.addEventListener('pointerdown', e => {
  const t = e.target;
  if (root.classList.contains('fx-filters-open') && !filters.contains(t) && !chip.contains(t)) setFilters(false);
  if (!menu.hidden && !menu.contains(t) && !more.contains(t)) setMenu(false);
  if (root.dataset.fxSheet === 'open' && !sheet.contains(t) && !wrap.contains(t)) setSheet(false);
 });
 addEventListener('resize', () => { if (root.dataset.fxSheet === 'open') place(sheet, cap, 580); if (!menu.hidden) place(menu, more, 260); if (root.classList.contains('fx-filters-open')) place(filters, chip, 760); });

 function derive() {
  const liveLabel = liveToggle?.textContent || '', mic = q('#wl-mic')?.textContent || '', status = q('#vc-status'), statusText = status?.textContent || '';
  if (/finishing/i.test(liveLabel)) return { state: 'thinking', text: 'Finishing the conversation…' };
  if (/connecting/i.test(liveLabel)) return { state: 'connecting', text: 'Connecting voice…' };
  if (/active/i.test(liveLabel)) {
   if (/muted/i.test(mic)) return { state: 'muted', text: 'Muted — tap the mic to talk' };
   const liveResult = q('#wl-result')?.textContent || '';
   if (/^Checking/.test(liveResult)) return { state: 'thinking', text: 'Finding the evidence…', live: true };
   const said = (q('#wl-user-caption')?.textContent || '').trim();
   const tail = said && !/^Your speech will appear/.test(said) ? (said.length > 64 ? '…' + said.slice(-64) : said) : 'Listening — speak naturally';
   return { state: 'listening', text: tail };
  }
  if (q('#vc-mic')?.getAttribute('aria-pressed') === 'true') return { state: 'recording', text: 'Recording — tap the mic to send' };
  if (/Finding the evidence|transcrib|Preparing/i.test(statusText) && status?.dataset.kind !== 'error') return { state: 'thinking', text: /transcrib/i.test(statusText) ? 'Transcribing…' : 'Finding the evidence…' };
  if (visible(q('#vc-stop'))) return { state: 'speaking', text: headline() || 'Speaking…' };
  if (notice) return { state: notice.kind === 'info' ? 'answered' : 'error', text: notice.text };
  if (status?.dataset.kind === 'error' && statusText) return { state: 'error', text: statusText };
  if (looseAnswer) return { state: 'answered', text: headlineOf(looseAnswer) };
  const entry = trail[pointer];
  if (entry?.answer) return { state: 'answered', text: headlineOf(entry.answer) };
  if (entry && trail.some(x => x.answer)) return { state: 'viewing', text: entry.label };
  if (hasAnswer()) return { state: 'answered', text: headline() };
  return { state: 'idle', text: 'Ask Workforce' };
 }
 function headline() {
  const title = q('#vc-title')?.textContent?.trim() || '', value = q('#vc-facts .vc-fact-value')?.textContent?.trim() || '';
  return value && title ? value + ' · ' + title : title;
 }
 let lastSpoken = '';
 function render() {
  const liveNow = q('#wl-state')?.textContent || '';
  if (liveNow !== prevLiveState) { const had = prevLiveState; prevLiveState = liveNow; if (had && liveAttempt && !/active|connecting/i.test(liveToggle?.textContent || '') && /denied|unavailable|failed|could not|timed out|lost|unexpectedly|needs a WebRTC/i.test(liveNow)) { liveAttempt = false; flash(liveNow); return; } if (/Connected/.test(liveNow)) liveAttempt = false; }
  const d = derive(), live = ['listening', 'muted', 'connecting'].includes(d.state) || (d.state === 'thinking' && d.live);
  cap.dataset.state = d.state; cap.classList.toggle('fx-live', live || ['recording', 'thinking', 'speaking'].includes(d.state));
  text.textContent = d.text; display.title = d.text;
  const typingOnly = !canLive() && !canRecord() && !live && d.state !== 'recording';
  orb.innerHTML = d.state === 'muted' ? svg.muted : d.state === 'recording' || d.state === 'speaking' ? svg.send : typingOnly ? svg.keys : svg.mic;
  orb.setAttribute('aria-label', d.state === 'listening' ? 'Microphone on — tap to mute' : d.state === 'muted' ? 'Microphone muted — tap to talk' : d.state === 'recording' ? 'Stop recording and send' : d.state === 'speaking' ? 'Stop voice playback' : d.state === 'connecting' ? 'Connecting voice' : typingOnly ? 'Type a question' : 'Talk to Workforce');
  orb.setAttribute('aria-pressed', String(d.state === 'listening' || d.state === 'recording'));
  display.setAttribute('aria-label', (d.state === 'answered' ? 'Current answer: ' : '') + d.text + (d.state === 'answered' ? '. Show detail' : d.state === 'idle' ? '. Type a question' : ''));
  end.hidden = !['listening', 'muted', 'connecting'].includes(d.state) && !(d.state === 'thinking' && d.live);
  expand.hidden = !hasAnswer() || live;
  back.hidden = fwd.hidden = trail.length < 2 || live;
  back.disabled = pointer <= 0; fwd.disabled = pointer >= trail.length - 1;
  back.title = pointer > 0 ? 'Back to ' + trail[pointer - 1].label : ''; fwd.title = pointer < trail.length - 1 ? 'Forward to ' + trail[pointer + 1].label : '';
  if (d.text !== lastSpoken && d.state !== 'listening') { sr.textContent = d.text; lastSpoken = d.text; }
 }
 let frame = 0;
 const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; render(); }); };
 const watch = ['#vc-status', '#vc-result', '#vc-title', '#vc-facts', '#vc-stop', '#vc-mic', '#wl-toggle', '#wl-mic', '#wl-user-caption', '#wl-result', '#wl-state', '#wl-start', '#wl-mute'];
 const observer = new MutationObserver(schedule);
 watch.forEach(sel => { const el = q(sel); if (el) observer.observe(el, { attributes: true, childList: true, characterData: true, subtree: true }); });
 // Session trail: every screen change (asked, typed or tapped) is a step. The trail is append-only;
 // stepping back moves a pointer and a new step is always added at the end, so nothing is lost.
 const app = root.__WI_APP, main = q('#wi-main');
 const trail = []; let pointer = -1, restoring = null, pendingAnswer = null, looseAnswer = null;
 const copy = v => { try { return structuredClone(v); } catch { return JSON.parse(JSON.stringify(v)); } };
 function viewOf() { const s = app.state; return { page: s.page, domain: s.domain, people: s.people, operations: s.operations, metric: s.metric, trustTab: s.trustTab, function: s.function, region: s.region, period: s.period, audience: s.audience, decide: copy(s.decide) }; }
 const keyOf = v => [v.page, v.page === 'monitor' ? v.domain + '/' + (v[v.domain] || '') : '', v.page === 'investigate' ? v.metric : '', v.page === 'decide' ? (v.decide?.caseId || '') + '/' + (v.decide?.subview || '') : '', v.page === 'trust' ? v.trustTab : '', v.function, v.region, v.period, v.audience].join('|');
 function labelOf(v) {
  const name = v.page === 'monitor' ? (q('#wi-domains [aria-current="page"]')?.textContent || 'Executive overview').replace(/^\s*\d+\s*/, '').trim() : (main.querySelector('h1')?.textContent || v.page).trim();
  const where = [v.function === 'all' ? '' : v.function, v.region === 'all' ? '' : v.region].filter(Boolean).join(', ');
  return where ? name + ' · ' + where : name;
 }
 const answerKey = a => a ? a.title + '|' + a.answer : '';
 function headlineOf(a) { const v = a?.facts?.[0]?.value, t = a?.title || ''; return v && t && v.length < 24 ? v + ' · ' + t : t; }
 function record() {
  if (!app || app.state.presenting) return;
  const v = viewOf(), key = keyOf(v);
  if (restoring !== null && trail[restoring]) { pointer = restoring; restoring = null; trail[pointer].view = v; schedule(); return; }
  restoring = null;
  if (pointer >= 0 && trail[pointer].key === key) { trail[pointer].view = v; if (pendingAnswer) { trail[pointer].answer = pendingAnswer; pendingAnswer = null; looseAnswer = null; } schedule(); return; }
  trail.push({ key, view: v, label: labelOf(v), answer: pendingAnswer, at: Date.now() }); pendingAnswer = null; looseAnswer = null;
  if (trail.length > 60) trail.shift();
  pointer = trail.length - 1; schedule();
 }
 let recordTimer = 0;
 if (app && main) new MutationObserver(() => { clearTimeout(recordTimer); recordTimer = setTimeout(record, 120); }).observe(main, { childList: true });
 function restore(i, { announce = false } = {}) {
  const e = trail[i]; if (!e || !app) return false;
  restoring = i; notice = null; looseAnswer = null; pendingAnswer = null;
  if (e.answer && window.WI_CONVERSATION?.showResponse) {
   const a = copy(e.answer); delete a.question; delete a.navigation; lastAnswer = answerKey(a);
   window.WI_CONVERSATION.showResponse(a).catch(() => {});
  }
  const s = app.state, v = e.view;
  Object.assign(s, { page: v.page, domain: v.domain, people: v.people, operations: v.operations, metric: v.metric, trustTab: v.trustTab, function: v.function, region: v.region, period: v.period, audience: v.audience, presenting: false });
  if (v.decide) Object.assign(s.decide, copy(v.decide));
  app.render(); setSheet(false); scrollTo({ top: 0, behavior: 'smooth' });
  if (announce) flash('Back to ' + e.label, 'info'); else schedule();
  return true;
 }
 back.addEventListener('click', () => restore(pointer - 1));
 fwd.addEventListener('click', () => restore(pointer + 1));
 const stop = new Set(['the', 'and', 'for', 'with', 'view', 'screen', 'page', 'show', 'one', 'that', 'this', 'about', 'our']);
 function textMatch(target) {
  const words = String(target).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2 && !stop.has(w));
  if (!words.length) return -1;
  for (let i = trail.length - 1; i >= 0; i--) { if (i === pointer) continue; const label = trail[i].label.toLowerCase(); if (words.every(w => label.includes(w.slice(0, 5)))) return i; }
  return -1;
 }
 // "Go back" and "go back to X" arrive as answers carrying a navigation flag, from typed and voice questions alike.
 function navigate(data) {
  const nav = data?.navigation; if (!nav) return false;
  if (!nav.target) { if (pointer > 0) restore(pointer - 1, { announce: true }); else flash('This is the first view in this session.', 'info'); return true; }
  const a = nav.intent === 'clarify' ? {} : data.action || {}; let idx = -1;
  for (let i = trail.length - 1; i >= 0 && idx < 0; i--) {
   if (i === pointer) continue; const v = trail[i].view;
   if ((a.type === 'metric' && v.page === 'investigate' && v.metric === a.metricId) || (a.type === 'scenario' && v.page === 'decide' && v.decide?.caseId === a.caseId) || (a.type === 'overview' && v.page === 'monitor' && v.domain === 'overview')) idx = i;
  }
  if (idx < 0) idx = textMatch(nav.target);
  return idx >= 0 ? restore(idx, { announce: true }) : false;
 }
 window.WI_FOCUS = Object.freeze({ navigate, trail: () => trail.map(({ label, at, answer }) => ({ label, at, question: answer?.question || null })), position: () => pointer });
 addEventListener('wi-source-updated', () => { trail.forEach(e => { e.answer = null; }); looseAnswer = null; pendingAnswer = null; schedule(); });
 // A new answer takes the dashboard to its view; the capsule keeps the headline. Answers without a view open the sheet.
 let lastAnswer = '';
 new MutationObserver(() => {
  const now = hasAnswer() ? q('#vc-title').textContent + '|' + (q('#vc-answer')?.textContent || '') : '';
  if (!now) { lastAnswer = ''; return; }
  if (now === lastAnswer) return;
  lastAnswer = now;
  notice = null; clearTimeout(noticeTimer);
  const data = window.WI_CONVERSATION?.getAnswer?.(), primary = q('#vc-actions .vc-primary');
  // Clarifications have no facts and stay in the sheet rather than moving the dashboard.
  if (primary && data?.facts?.length) { pendingAnswer = data; looseAnswer = null; primary.click(); setSheet(false); clearTimeout(recordTimer); recordTimer = setTimeout(record, 120); }
  else { pendingAnswer = null; looseAnswer = data; setSheet(true); }
  schedule();
 }).observe(q('#vc-result') || sheet, { attributes: true, childList: true, subtree: true, characterData: true });
 record();
 render();
})();
