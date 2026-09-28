(() => {
  'use strict';
  const CORE = {
    sources: [
      ['Core HCM', 'Workday · synthetic', 'Headcount, effective-dated movements and organizational scope'],
      ['Talent', 'Workday · synthetic', 'Requisitions, internal mobility and succession'],
      ['Payroll', 'Workday · synthetic', 'Pay components and workforce cost'],
      ['Talent cohorts', 'Workday · synthetic', 'Matured hire cohort and first-year outcomes'],
      ['HR service', 'Synthetic supplement', 'Case arrivals, resolution, backlog and SLA'],
      ['Finance', 'Synthetic supplement', 'Budget and business run-rate measures'],
      ['Listening', 'Synthetic supplement', 'Pulse and experience measures']
    ],
    questions: [
      'Show employee headcount',
      'Explain E03 for Engineering',
      'What is the first-year exit rate, and what evidence should we inspect?',
      'How is the HR service queue changing?',
      'What is workforce cost versus plan?',
      'Explain E04'
    ],
    // A configured key is a server setting, never evidence that a model call succeeded.
    modelLabel(status) { return status?.mode === 'api' ? 'Configured · live behavior unverified' : 'Not configured · deterministic demo'; },
    getSnapshot(reply) { return reply?.snapshot && Array.isArray(reply.snapshot.cells) ? reply.snapshot : Array.isArray(reply?.cells) ? reply : null; },
    validSnapshot(snapshot) { return !!snapshot && Array.isArray(snapshot.cells) && snapshot.cells.length > 0 && !!snapshot.cohorts && typeof snapshot.sourceVersion === 'string'; },
    mediaSupport(env) {
      if (!env.secure) return 'Requires a secure context (HTTPS or localhost).';
      if (!env.mediaDevices) return 'Microphone capture is unavailable in this browser.';
      if (!env.mediaRecorder) return 'MediaRecorder is unavailable in this browser.';
      if (!env.audioContext || !env.canvasCapture) return 'Canvas or Web Audio capture is unavailable in this browser.';
      if (!env.webm) return 'WebM recording is unsupported in this browser.';
      return '';
    }
  };
  if (typeof globalThis !== 'undefined') globalThis.WI_OPERATIONS_CORE = CORE;
  if (typeof document === 'undefined') return;
  const root = document.getElementById('wi-app');
  const main = root?.querySelector('#wi-main');
  const anchor = root?.querySelector('#wi-present');
  if (!root || !main || !anchor) return;

  const toggle = document.createElement('button');
  toggle.type = 'button'; toggle.className = 'wi-btn wo-toggle';
  toggle.textContent = 'Connections & readiness';
  toggle.setAttribute('aria-controls', 'wi-operations');
  toggle.setAttribute('aria-expanded', 'false');
  anchor.before(toggle);
  const panel = document.getElementById('wi-operations') || document.createElement('section');
  panel.id = 'wi-operations'; panel.className = 'wo-panel'; panel.hidden = true;
  panel.setAttribute('aria-label', 'Connections and readiness');
  main.before(panel);
  panel.innerHTML = `<div class="wo-inner">
    <div class="wo-header"><div><div class="wo-eyebrow">SYSTEM READINESS / SYNTHETIC DEMONSTRATION</div><h2>Connections &amp; readiness</h2><p>See what powers this demonstration, rehearse a governed source refresh, and test media in this browser.</p></div><button type="button" class="wo-close" data-wo="close" aria-label="Close connections and readiness">Close ×</button></div>
    <div class="wo-banner" role="note"><strong>No company tenant connected.</strong> Workday feeds and supplemental systems below are generated records. A local server setting may enable model APIs; it does not validate a model call or authorize enterprise data.</div>
    <div class="wo-grid"><section class="wo-card"><div class="wo-kicker">01 / SERVICE</div><h3>Runtime signals</h3><dl class="wo-facts"><div><dt>Answer mode</dt><dd id="wo-mode">Checking…</dd></div><div><dt>Voice input / output</dt><dd id="wo-voice">Checking…</dd></div><div><dt>Workday simulation</dt><dd id="wo-workday">Checking…</dd></div><div><dt>Source revision</dt><dd id="wo-revision">Checking…</dd></div><div><dt>Last sync</dt><dd id="wo-sync-time">Checking…</dd></div><div><dt>Quality</dt><dd id="wo-quality">Checking…</dd></div></dl><p class="wo-foot" id="wo-disclosure"></p><button type="button" class="wi-btn" data-wo="refresh">Refresh readiness</button></section>
    <section class="wo-card"><div class="wo-kicker">02 / CONTROLLED REFRESH</div><h3>Rehearse a source update</h3><p>Baseline refreshes the generated feed. Correction replays a revised upstream record. Reset returns to the original synthetic baseline. Each accepted revision hydrates the dashboard.</p><div class="wo-actions"><button type="button" class="wi-btn primary" data-batch="baseline">Refresh baseline</button><button type="button" class="wi-btn" data-batch="correction">Apply correction</button><button type="button" class="wi-btn" data-batch="reset">Reset baseline</button></div><button type="button" class="wo-text-button" data-batch="invalid">Simulate invalid batch</button><p class="wo-hint">An invalid batch should be rejected without changing the visible snapshot.</p><p id="wo-sync-result" class="wo-result" role="status" aria-live="polite">No sync run in this browser session.</p></section></div>
    <section class="wo-card wo-section"><div class="wo-card-title"><div><div class="wo-kicker">03 / LINEAGE</div><h3>Source coverage</h3></div><span class="wo-pill">Generated aggregates</span></div><div id="wo-sources" class="wo-sources"></div><p class="wo-foot">Reporting grain: function × region × month, plus matured cohort aggregates. Records are fictional; privacy rules are display examples, not source permissions.</p></section>
    <div class="wo-grid wo-section"><section class="wo-card"><div class="wo-kicker">04 / GUIDED QUESTIONS</div><h3>Take the executive path</h3><p>Open a representative question in Ask Workforce. All answers use synthetic evidence and visible definitions.</p><div id="wo-questions" class="wo-questions"></div></section><section class="wo-card"><div class="wo-kicker">05 / BROWSER DIAGNOSTIC</div><h3>Test microphone &amp; video</h3><p>On click, this browser requests microphone permission, samples up to 3 seconds, then records a 2-second canvas and test tone with audio and video tracks. It does not open the camera.</p><div class="wo-actions"><button type="button" class="wi-btn primary" data-wo="test">Test microphone &amp; video</button><button type="button" class="wi-btn" data-wo="stop" hidden>Stop test</button></div><p class="wo-hint">The tone tests export plumbing. It is not a spoken briefing or proof of live model speech.</p><p id="wo-media-result" class="wo-result" role="status" aria-live="polite">Not tested in this browser.</p><div id="wo-downloads" class="wo-actions" hidden></div></section></div>
  </div>`;
  const $ = selector => panel.querySelector(selector);
  const put = (selector, value) => { const el = $(selector); if (el) el.textContent = String(value ?? 'Unavailable'); };
  const short = value => String(value ?? '').slice(0, 240);
  const stamp = value => { if (!value) return 'Not synced'; const d = new Date(value); return Number.isNaN(d.getTime()) ? short(value) : d.toLocaleString(); };
  CORE.sources.forEach(([name, origin, desc]) => {
    const row = document.createElement('div'); row.className = 'wo-source';
    const title = document.createElement('strong'); title.textContent = name;
    const from = document.createElement('span'); from.textContent = origin;
    const detail = document.createElement('p'); detail.textContent = desc;
    row.append(title, from, detail); $('#wo-sources').append(row);
  });
  CORE.questions.forEach((q, i) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'wo-question';
    button.dataset.questionIndex = String(i); button.textContent = `${String(i + 1).padStart(2, '0')}  ${q} →`;
    $('#wo-questions').append(button);
  });
  let open = false, requestGeneration = 0, mediaGeneration = 0, abort = null;
  let mediaAbort = null, mediaCleanup = () => {}, urls = [];
  const revokeUrls = () => { urls.forEach(url => URL.revokeObjectURL(url)); urls = []; $('#wo-downloads').replaceChildren(); $('#wo-downloads').hidden = true; };
  function cancelMedia() { mediaGeneration++; mediaAbort?.abort(); mediaAbort = null; mediaCleanup(); mediaCleanup = () => {}; $('[data-wo="test"]').disabled = false; $('[data-wo="stop"]').hidden = true; }
  function close() { open = false; requestGeneration++; abort?.abort(); abort = null; cancelMedia(); revokeUrls(); panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.focus({ preventScroll: true }); }
  async function json(path, options = {}, signal) {
    const res = await fetch(path, { ...options, signal, cache: 'no-store' });
    let body; try { body = await res.json(); } catch { throw Error(`Service returned an unreadable response (${res.status}).`); }
    if (!res.ok) throw Error(short(body?.error || body?.message || `Service returned ${res.status}.`));
    return body;
  }
  function showStatus(api, workday) {
    put('#wo-mode', CORE.modelLabel(api));
    put('#wo-voice', api?.mode === 'api' ? `Input ${api.voiceInput ? 'configured' : 'unavailable'} · Output ${api.voiceOutput ? 'configured' : 'unavailable'} · unverified` : 'API voice not configured');
    put('#wo-disclosure', api?.disclosure || 'No API disclosure returned.');
    const wd = workday?.workday || workday || {};
    put('#wo-workday', wd.synthetic && wd.connected === false ? 'Synthetic Workday-style reports · no tenant connection' : 'Status unavailable · no connection verified');
    put('#wo-revision', wd.sourceRevision ? `${short(wd.sourceRevision)} · ${short(wd.sourceVersion).slice(0, 12)}` : wd.sourceVersion || window.WI_DATA?.sourceVersion || 'Baseline synthetic revision');
    put('#wo-sync-time', wd.lastSuccess?.at ? `${stamp(wd.lastSuccess.at)} · ${wd.lastSuccess.batch}` : 'No manual sync yet');
    const coverage = wd.coverage;
    const attempt = wd.lastAttempt;
    put('#wo-quality', attempt?.result === 'rejected' ? `Last batch rejected · ${short(attempt.error)}` : coverage ? `${coverage.complete ? 'Complete' : 'Incomplete'} · ${coverage.cells}/${coverage.expectedCells} cells · ${coverage.cohorts} cohorts` : 'No quality report supplied');
    const counts = wd.lastSuccess?.reportRows;
    if (counts) {
      const names = ['CoreHCM', 'Talent', 'Payroll', 'TalentCohorts', 'HRServiceSupplement', 'FinanceSupplement', 'ListeningSupplement'];
      $('#wo-sources').querySelectorAll('.wo-source').forEach((row, i) => {
        let badge = row.querySelector('em'); if (!badge) { badge = document.createElement('em'); row.append(badge); }
        badge.textContent = Number.isInteger(counts[names[i]]) ? `${counts[names[i]]} generated rows` : '';
      });
    }
  }
  async function refresh() {
    const generation = ++requestGeneration;
    abort?.abort(); abort = new AbortController();
    put('#wo-mode', 'Checking…'); put('#wo-workday', 'Checking…');
    try {
      const [api, wd] = await Promise.all([json('/api/status', {}, abort.signal), json('/api/workday/status', {}, abort.signal)]);
      if (generation !== requestGeneration) return;
      showStatus(api, wd);
    } catch (error) { if (generation === requestGeneration && error.name !== 'AbortError') { put('#wo-mode', 'Service unavailable'); put('#wo-workday', short(error.message)); put('#wo-disclosure', 'Retry after starting the local service.'); } }
  }
  async function sync(batch) {
    const generation = ++requestGeneration;
    abort?.abort(); abort = new AbortController();
    panel.querySelectorAll('[data-batch]').forEach(b => { b.disabled = true; });
    put('#wo-sync-result', `Running ${batch} synthetic batch…`);
    try {
      const result = await json('/api/workday/sync', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ batch: batch === 'reset' ? 'baseline' : batch }) }, abort.signal);
      if (generation !== requestGeneration) return;
      if (batch === 'invalid') { put('#wo-sync-result', 'The service accepted the invalid batch. Inspect its quality report before relying on the snapshot.'); await refresh(); return; }
      let snapshot = CORE.getSnapshot(result);
      if (!snapshot) snapshot = await json('/api/data/snapshot', {}, abort.signal);
      if (generation !== requestGeneration) return;
      if (!CORE.validSnapshot(snapshot) || typeof window.WI_DATA?.hydrate !== 'function') throw Error('The source snapshot did not pass client checks; dashboard was not updated.');
      const previousVersion = window.WI_DATA.sourceVersion;
      window.WI_DATA.hydrate(snapshot);
      if (previousVersion !== snapshot.sourceVersion) window.dispatchEvent(new Event('wi-source-updated'));
      root.__WI_APP?.render?.();
      put('#wo-sync-result', `${batch === 'correction' ? 'Correction applied' : batch === 'reset' ? 'Baseline restored' : 'Baseline replayed'} · source ${short(snapshot.sourceVersion)}. Dashboard and evidence views updated.`);
      await refresh();
    } catch (error) {
      if (generation !== requestGeneration || error.name === 'AbortError') return;
      put('#wo-sync-result', batch === 'invalid' ? `Invalid batch rejected. Visible data is unchanged. ${short(error.message)}` : `Sync did not update the dashboard. ${short(error.message)}`);
      if (batch === 'invalid') refresh();
    } finally { panel.querySelectorAll('[data-batch]').forEach(b => { b.disabled = false; }); }
  }
  function linkDownload(blob, filename, label) {
    const url = URL.createObjectURL(blob); urls.push(url);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.textContent = label; a.className = 'wi-btn';
    $('#wo-downloads').append(a); $('#wo-downloads').hidden = false;
  }
  const delay = (ms, signal) => new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return; }
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, ms);
    function cancel() { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')); }
    signal.addEventListener('abort', cancel, { once: true });
  });
  function record(stream, duration, type, signal) {
    return new Promise((resolve, reject) => {
      const recorder = new MediaRecorder(stream, { mimeType: type }); const chunks = []; let timer;
      const cancel = () => { clearTimeout(timer); if (recorder.state !== 'inactive') recorder.stop(); reject(new DOMException('Cancelled', 'AbortError')); };
      signal.addEventListener('abort', cancel, { once: true });
      recorder.ondataavailable = event => { if (event.data?.size) chunks.push(event.data); };
      recorder.onerror = () => { clearTimeout(timer); signal.removeEventListener('abort', cancel); reject(Error('MediaRecorder failed.')); };
      recorder.onstop = () => { clearTimeout(timer); signal.removeEventListener('abort', cancel); resolve(new Blob(chunks, { type })); };
      recorder.start(200); timer = setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop(); }, duration);
      if (signal.aborted) cancel();
    });
  }
  async function testMedia() {
    window.dispatchEvent(new Event('wi-stop-media'));
    cancelMedia(); revokeUrls();
    const generation = ++mediaGeneration; mediaAbort = new AbortController();
    const signal = mediaAbort.signal;
    const contextType = window.AudioContext || window.webkitAudioContext;
    const videoMime = ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm'].find(t => window.MediaRecorder?.isTypeSupported(t));
    const unavailable = CORE.mediaSupport({ secure: window.isSecureContext, mediaDevices: !!navigator.mediaDevices?.getUserMedia, mediaRecorder: !!window.MediaRecorder, audioContext: !!contextType, canvasCapture: !!HTMLCanvasElement.prototype.captureStream, webm: !!videoMime });
    if (unavailable) { put('#wo-media-result', unavailable); return; }
    $('[data-wo="test"]').disabled = true; $('[data-wo="stop"]').hidden = false;
    const report = { diagnostic: 'Browser-local media pipeline', timestamp: new Date().toISOString(), synthetic: true, cameraRequested: false, spokenBriefing: false, microphone: {}, video: {}, result: 'incomplete' };
    let mic, canvasStream, mixed, ctx, tone, frameId = 0;
    let cleaned = false;
    const cleanup = () => { if (cleaned) return; cleaned = true; if (frameId) cancelAnimationFrame(frameId); try { tone?.stop(); } catch {} [mic, canvasStream, mixed].forEach(stream => stream?.getTracks().forEach(track => track.stop())); ctx?.close().catch(() => {}); };
    mediaCleanup = cleanup;
    try {
      put('#wo-media-result', 'Requesting microphone permission…');
      mic = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (signal.aborted) { mic.getTracks().forEach(track => track.stop()); throw new DOMException('Cancelled', 'AbortError'); }
      const micTrack = mic.getAudioTracks()[0];
      report.microphone.permission = 'granted'; report.microphone.trackPresent = !!micTrack; report.microphone.initialState = micTrack?.readyState;
      put('#wo-media-result', 'Recording a 3-second microphone sample locally…');
      const micType = ['audio/webm;codecs=opus', 'audio/webm'].find(t => MediaRecorder.isTypeSupported(t));
      if (!micType) throw Error('Microphone WebM recording is unsupported.');
      const micBlob = await record(mic, 3000, micType, signal);
      report.microphone.recordedBytes = micBlob.size;
      mic.getTracks().forEach(track => track.stop()); mic = null;
      if (!micBlob.size) throw Error('Microphone recording was empty.');
      put('#wo-media-result', 'Recording test tone and canvas for 2 seconds…');
      ctx = new contextType(); await ctx.resume();
      if (ctx.state !== 'running') throw Error('Web Audio could not start.');
      const destination = ctx.createMediaStreamDestination(); tone = ctx.createOscillator(); const gain = ctx.createGain();
      tone.frequency.value = 440; gain.gain.value = 0.035; tone.connect(gain); gain.connect(destination); tone.start();
      const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 540;
      const pen = canvas.getContext('2d'); if (!pen) throw Error('Canvas could not initialize.');
      const start = performance.now();
      const paint = now => { pen.fillStyle = '#102a3a'; pen.fillRect(0, 0, 960, 540); pen.fillStyle = '#d7eee8'; pen.font = 'bold 44px sans-serif'; pen.fillText('Browser media diagnostic', 60, 140); pen.font = '25px sans-serif'; pen.fillText('Synthetic test tone · not a spoken briefing', 60, 205); pen.fillStyle = '#79d6ba'; pen.fillRect(60, 280, Math.min(810, (now - start) / 2000 * 810), 12); frameId = requestAnimationFrame(paint); };
      paint(start); canvasStream = canvas.captureStream(24);
      mixed = new MediaStream([...canvasStream.getVideoTracks(), ...destination.stream.getAudioTracks()]);
      report.video.audioTracks = mixed.getAudioTracks().length; report.video.videoTracks = mixed.getVideoTracks().length;
      if (!report.video.audioTracks || !report.video.videoTracks) throw Error('The combined stream lacks audio or video.');
      const videoBlob = await record(mixed, 2000, videoMime, signal);
      report.video.recordedBytes = videoBlob.size; report.video.mimeType = videoMime;
      if (!videoBlob.size) throw Error('Diagnostic video was empty.');
      if (generation !== mediaGeneration) return;
      report.result = 'passed'; report.microphone.tracksStopped = true;
      cleanup(); mediaCleanup = () => {};
      linkDownload(videoBlob, 'workforce-media-diagnostic.webm', 'Download diagnostic WebM');
      linkDownload(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }), 'workforce-media-report.json', 'Download verification report');
      put('#wo-media-result', `Browser diagnostic passed: microphone ${report.microphone.recordedBytes} bytes; WebM ${report.video.recordedBytes} bytes with audio and video tracks. Test tone only, no spoken briefing.`);
    } catch (error) {
      if (generation === mediaGeneration && error.name !== 'AbortError') put('#wo-media-result', error.name === 'NotAllowedError' ? 'Microphone permission denied. Allow it in this browser and try again.' : `Diagnostic incomplete: ${short(error.message)} All opened tracks were stopped.`);
    } finally {
      cleanup();
      if (generation === mediaGeneration) { mediaCleanup = () => {}; mediaAbort = null; $('[data-wo="test"]').disabled = false; $('[data-wo="stop"]').hidden = true; }
    }
  }
  toggle.addEventListener('click', () => { if (open) close(); else { open = true; panel.hidden = false; toggle.setAttribute('aria-expanded', 'true'); panel.scrollIntoView({ block: 'start', behavior: 'smooth' }); refresh(); } });
  panel.addEventListener('click', event => {
    const b = event.target.closest('button'); if (!b || !panel.contains(b) || b.disabled) return;
    if (b.dataset.wo === 'close') close();
    else if (b.dataset.wo === 'refresh') refresh();
    else if (b.dataset.wo === 'test') testMedia();
    else if (b.dataset.wo === 'stop') { cancelMedia(); put('#wo-media-result', 'Diagnostic stopped. Open tracks were closed.'); }
    else if (b.dataset.batch) sync(b.dataset.batch);
    else if (b.dataset.questionIndex) {
      const q = CORE.questions[Number(b.dataset.questionIndex)];
      if (!q) return;
      if (window.WI_CONVERSATION?.ask) { close(); window.WI_CONVERSATION.ask(q); }
      else put('#wo-sync-result', 'Ask Workforce is unavailable. Reload the page and try again.');
    }
  });
  panel.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  window.addEventListener('wi-stop-media', () => { if (mediaAbort) { cancelMedia(); put('#wo-media-result', 'Diagnostic stopped because another media activity started.'); } });
  window.addEventListener('pagehide', () => { requestGeneration++; abort?.abort(); cancelMedia(); revokeUrls(); });
  window.WI_OPERATIONS = { open: () => { if (!open) toggle.click(); }, close, refresh };
})();
