import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rename, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDiagnostics, connectionError, applicationError, apiResponseError, assertAPIKey } from '../diagnostics.mjs';
import { createServer } from '../server.mjs';

const SECRET = 'PRIVATE_CANARY_NOT_FOR_REPORTS';
const sdp = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n';
const broken = code => new TypeError('fetch failed: '+SECRET,{cause:Object.assign(new Error('https://proxy:'+SECRET+'@private.example'),{code})});
const post = (url,path,value={},cookie) => fetch(url+path,{method:'POST',headers:{'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(value)});
async function fixture(t,options={}) {
  const server=createServer({apiKey:SECRET,...options});await server.ready;
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await server.whenClosed();});
  return {server,url:`http://127.0.0.1:${server.address().port}`};
}

test('nested transport causes distinguish TLS, DNS, network and local state without exposing raw errors',()=>{
  for(const [code,category] of [['UNABLE_TO_VERIFY_LEAF_SIGNATURE','TLS_TRUST'],['ENOTFOUND','DNS_LOOKUP'],['ECONNREFUSED','NETWORK_CONNECT'],['ENOSPC','STATE_WRITE']]) {
    const result=connectionError(new AggregateError([broken(code)],SECRET),'live.session.request');
    assert.equal(result.diagnostic.category,category);assert.equal(result.diagnostic.causeCode,code);
    assert.equal(JSON.stringify(result).includes(SECRET),false);assert.equal(result.message.includes(SECRET),false);
  }
  assert.equal(applicationError(new Error(SECRET),'live.session.journal').diagnostic.category,'APP_FAILURE');
  const timeout=AbortSignal.abort(new DOMException(SECRET,'TimeoutError'));
  assert.equal(connectionError(new Error(SECRET),'api.request',timeout).diagnostic.category,'REQUEST_TIMEOUT');
});

test('provider HTTP errors retain only allowlisted codes, parameters and request references',async()=>{
  const result=await apiResponseError(Response.json({error:{message:SECRET,code:'invalid_value',type:'invalid_request_error',param:'session.input',internal:SECRET}},{status:400,headers:{'x-request-id':'req_test_123'}}),'live.session.response');
  assert.deepEqual(result.diagnostic,{category:'INVALID_API_REQUEST',stage:'live.session.response',httpStatus:400,providerCode:'invalid_value',providerType:'invalid_request_error',providerParam:'session.input',providerRequestId:'req_test_123'});
  assert.equal(JSON.stringify(result).includes(SECRET),false);
  const unknown=await apiResponseError(Response.json({error:{message:SECRET,code:SECRET,type:SECRET,param:SECRET}},{status:403,headers:{'x-request-id':SECRET}}));
  assert.equal(unknown.diagnostic.category,'ACCESS_DENIED');assert.equal(unknown.diagnostic.providerCode,null);assert.equal(unknown.diagnostic.providerParam,null);assert.equal(unknown.diagnostic.providerRequestId,null);
  assert.equal(JSON.stringify(unknown).includes(SECRET),false);
  const quota=await apiResponseError(Response.json({error:{code:'insufficient_quota'}},{status:429}));
  assert.equal(quota.diagnostic.category,'QUOTA');
});

test('missing and malformed keys fail before constructing an upstream request',async()=>{
  for(const key of ['',`Bearer ${SECRET}`,'your_api_key',SECRET+'\n',SECRET+' ']) {
    assert.throws(()=>assertAPIKey(key));
    const d=createDiagnostics({apiKey:key,fetchImpl:()=>assert.fail('Must not call upstream')});
    const report=await d.check();assert.equal(report.lastConnectionCheck.status,'failed');assert.equal(report.configuration.keyFormatValid,false);
    assert.equal(JSON.stringify(report).includes(SECRET),false);
  }
});

test('diagnostic report is bounded, detached and excludes environment values and raw exceptions',()=>{
  const d=createDiagnostics({apiKey:SECRET,env:{HTTPS_PROXY:'https://'+SECRET,NODE_EXTRA_CA_CERTS:'/private/'+SECRET,NODE_OPTIONS:'--use-env-proxy --use-system-ca'}});
  d.record(Object.assign(new Error(SECRET),{status:500}),'server.request');
  assert.equal(d.report().recentErrors[0].category,'APP_FAILURE');
  for(let n=0;n<12;n++)d.record(connectionError(broken('ENOTFOUND'),'live.session.request'),'/api/live/session');
  const report=d.report();assert.equal(report.recentErrors.length,10);assert.equal(report.runtime.proxyEnvironmentPresent,true);assert.equal(report.runtime.extraCAConfigured,true);
  assert.equal(JSON.stringify(report).includes(SECRET),false);
  report.recentErrors[0].category='tampered';assert.equal(d.report().recentErrors[0].category,'DNS_LOOKUP');
});

test('connection check calls only fixed model metadata, never creates a voice session, and does not overclaim readiness',async()=>{
  const calls=[];const d=createDiagnostics({apiKey:SECRET,fetchImpl:async(url,options)=>{calls.push({url,options});return Response.json({id:'gpt-live-1',object:'model'});}});
  const report=await d.check();assert.equal(calls.length,1);assert.equal(calls[0].url,'https://api.openai.com/v1/models/gpt-live-1');assert.equal(calls[0].options.method,'GET');assert.equal(calls[0].options.body,undefined);assert.equal(calls[0].options.redirect,'error');
  assert.equal(report.lastConnectionCheck.status,'metadata_reachable');assert.match(report.lastConnectionCheck.message,/did not start a voice session/);
  assert.equal(report.recentErrors.length,0);assert.equal(JSON.stringify(report).includes(SECRET),false);
});

test('metadata denial is qualified and a hung connection is aborted by its own deadline',async()=>{
  const denied=createDiagnostics({apiKey:SECRET,fetchImpl:async()=>new Response(null,{status:403})});
  const denial=await denied.check();assert.equal(denial.lastConnectionCheck.error.category,'ACCESS_DENIED');assert.match(denial.lastConnectionCheck.message,/does not by itself prove/);
  let signal;
  const d=createDiagnostics({apiKey:SECRET,timeoutMs:20,fetchImpl:async(_url,init)=>{signal=init.signal;return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));}});
  // AbortSignal.timeout does not keep Node alive by itself.
  const keepAlive=setTimeout(()=>{},500);
  try { const report=await d.check();assert.equal(signal.aborted,true);assert.equal(report.lastConnectionCheck.error.category,'REQUEST_TIMEOUT'); }
  finally { clearTimeout(keepAlive); }
});

test('an HTTP 200 proxy page is not mistaken for a successful model metadata response',async()=>{
  const d=createDiagnostics({apiKey:SECRET,fetchImpl:async()=>new Response('<html>'+SECRET+'</html>',{status:200})});
  const report=await d.check();assert.equal(report.lastConnectionCheck.status,'failed');assert.equal(report.lastConnectionCheck.error.category,'INVALID_API_RESPONSE');assert.equal(report.lastConnectionCheck.error.httpStatus,200);assert.equal(JSON.stringify(report).includes(SECRET),false);
});

test('actual HTTP voice startup now reports the transport category and correlation ID instead of generic saved-state advice',async t=>{
  let requests=0;const {url}=await fixture(t,{fetchImpl:async()=>{requests++;throw broken('UNABLE_TO_VERIFY_LEAF_SIGNATURE');}});
  const response=await post(url,'/api/live/session',{sdp});const failure=await response.json();
  assert.equal(response.status,502);assert.equal(failure.code,'TLS_TRUST');assert.equal(failure.stage,'live.session.request');assert.match(failure.diagnosticId,/^[a-f0-9-]{36}$/);
  assert.equal(JSON.stringify(failure).includes(SECRET),false);assert.equal(failure.error.includes('saved state'),false);
  const report=await(await fetch(url+'/api/diagnostics')).json();assert.equal(report.appVersion,'2.0.1');assert.equal(report.recentErrors[0].id,failure.diagnosticId);assert.equal(report.recentErrors[0].causeCode,'UNABLE_TO_VERIFY_LEAF_SIGNATURE');assert.equal(requests,1);
  assert.equal((await(await fetch(url+'/api/status')).json()).live.activeSessions,0);
  // A failed request releases capacity, so the next attempt reaches the provider.
  await post(url,'/api/live/session',{sdp});assert.equal(requests,2);
});

test('connection diagnostics require workspace authentication and reject cross-origin requests',async t=>{
  let calls=0;const password='test-only-workspace-password';
  const {url}=await fixture(t,{password,fetchImpl:async()=>{calls++;return Response.json({id:'gpt-live-1',object:'model'});}});
  assert.equal((await fetch(url+'/api/diagnostics')).status,401);assert.equal((await post(url,'/api/diagnostics/connection')).status,401);assert.equal(calls,0);
  const login=await post(url,'/api/login',{password});const cookie=login.headers.get('set-cookie').split(';')[0];
  const report=await(await fetch(url+'/api/diagnostics',{headers:{cookie}})).json();assert.equal(report.configuration.openaiKeyConfigured,true);assert.equal(calls,0);
  const checked=await(await post(url,'/api/diagnostics/connection',{},cookie)).json();assert.equal(checked.lastConnectionCheck.status,'metadata_reachable');assert.equal(calls,1);
  assert.equal((await fetch(url+'/api/diagnostics/connection',{method:'POST',headers:{cookie,origin:'https://untrusted.example','content-type':'application/json'},body:'{}'})).status,403);assert.equal(calls,1);
});

test('a local journal failure after voice allocation cleans up the new session and preserves a distinct state error',async t=>{
  const base=await mkdtemp(join(tmpdir(),'chro-diagnostic-test-'));t.after(()=>rm(base,{recursive:true,force:true}));
  const storageDir=join(base,'state');await mkdir(storageDir);const calls=[];
  const {url}=await fixture(t,{storageDir,fetchImpl:async endpoint=>{
    calls.push(endpoint);if(endpoint.endsWith('/hangup'))return new Response(null,{status:200});
    await rename(storageDir,join(base,'preserved-state'));await writeFile(storageDir,'Test-only blocked directory');
    return Response.json({session:{id:'live_journal_failure'},transport:{type:'webrtc',sdp}});
  }});
  const response=await post(url,'/api/live/session',{sdp});const failure=await response.json();
  assert.equal(response.status,500);assert.equal(failure.code,'STATE_WRITE');assert.equal(failure.stage,'live.session.journal');assert.equal(JSON.stringify(failure).includes(base),false);
  assert.ok(calls.includes('https://api.openai.com/v1/live/sessions/live_journal_failure/hangup'));
  assert.equal((await(await fetch(url+'/api/status')).json()).live.activeSessions,0);
  assert.equal((await post(url,'/api/live/close',{sessionId:'live_journal_failure'})).status,404);
});
