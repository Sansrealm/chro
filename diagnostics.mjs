import { randomUUID } from 'node:crypto';

// Reports contain allowlisted metadata only. Never include a key, proxy URL,
// raw provider error, transcript, SDP, request body, stack or local file path.
const TLS_CODES = new Set(['UNABLE_TO_VERIFY_LEAF_SIGNATURE','SELF_SIGNED_CERT_IN_CHAIN','DEPTH_ZERO_SELF_SIGNED_CERT','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','CERT_HAS_EXPIRED','ERR_TLS_CERT_ALTNAME_INVALID','CERT_NOT_YET_VALID']);
const DNS_CODES = new Set(['ENOTFOUND','EAI_AGAIN']);
const NETWORK_CODES = new Set(['ECONNREFUSED','ECONNRESET','ETIMEDOUT','ENETUNREACH','EHOSTUNREACH','UND_ERR_CONNECT_TIMEOUT','UND_ERR_SOCKET','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT']);
const STATE_CODES = new Set(['EACCES','EPERM','ENOSPC','EROFS','ENOENT','ENOTDIR']);
const PROVIDER_CODES = new Set(['invalid_api_key','insufficient_quota','rate_limit_exceeded','model_not_found','permission_denied','invalid_request_error','invalid_value','invalid_type','missing_required_parameter','unknown_parameter','unsupported_parameter','unsupported_value','context_length_exceeded','server_error','service_unavailable','billing_hard_limit_reached','organization_restricted','access_denied']);
const PROVIDER_TYPES = new Set(['invalid_request_error','authentication_error','permission_error','insufficient_quota','rate_limit_error','server_error']);
const PROVIDER_PARAMS = new Set(['model','session','session.model','session.store','session.input','session.delegation','session.delegation.type','transport','transport.type','transport.sdp','sdp','input']);
const ERROR_NAMES = new Set(['TypeError','RangeError','Error','SyntaxError','AbortError','TimeoutError']);
const FAULTS = {
  KEY_MISSING:[503,'No OpenAI API key is configured. Set OPENAI_API_KEY in .env and restart the server.'],
  KEY_FORMAT:[503,'OPENAI_API_KEY has an invalid format. Enter only the key value in .env, without a Bearer prefix, spaces or placeholder text; then restart.'],
  TLS_TRUST:[502,'The Node.js server could not verify the API TLS certificate. Check the computer clock and your organization’s approved certificate/proxy configuration. Keep certificate verification enabled.'],
  DNS_LOOKUP:[502,'The Node.js server could not resolve api.openai.com. Check DNS and the approved proxy/network configuration.'],
  NETWORK_CONNECT:[502,'The Node.js server could not connect to api.openai.com. Check the approved proxy, firewall and outbound HTTPS connection.'],
  REQUEST_TIMEOUT:[504,'The API request timed out. Check connectivity and try again after the connection diagnostic.'],
  REQUEST_CANCELLED:[499,'The API request was cancelled.'],
  AUTHENTICATION:[502,'OpenAI rejected the API credentials (HTTP 401). Check the active project key in .env and restart the server.'],
  ACCESS_DENIED:[502,'The API request was denied (HTTP 403). Check project/key permissions, organization restrictions and permitted model access.'],
  MODEL_OR_ENDPOINT:[502,'The requested API model or endpoint was unavailable to this request (HTTP 404). Check model access and the current API contract.'],
  QUOTA:[502,'The API reported insufficient quota. Check API billing, credits and the project’s usage limits.'],
  RATE_LIMIT:[502,'The API rate limit was reached. Wait before retrying and check the project’s rate limits.'],
  INVALID_API_REQUEST:[502,'The API rejected the session/request format. Download the connection report so the application request can be corrected.'],
  INVALID_API_RESPONSE:[502,'The API connection returned an unexpected response format. Download the connection report to inspect the failure stage.'],
  PROVIDER_UNAVAILABLE:[502,'The API service returned a server error. Retry later; the connection report includes the request reference when available.'],
  HTTP_REJECTED:[502,'The upstream HTTP request was rejected. Download the connection report for its status and safe error code.'],
  STATE_WRITE:[500,'The app could not access its saved-state directory. Check STATE_DIR permissions and available disk space; keep the existing saved state.'],
  CONNECTION_FAILED:[502,'The API connection failed before a usable response arrived. Download the connection report to inspect the failure stage.'],
  APP_FAILURE:[500,'The app encountered a server error. Download the connection report; the failure alone does not establish a saved-data problem.']
};

function fault(category, details = {}) {
  const [status,message] = FAULTS[category];
  return Object.assign(new Error(message),{status,diagnostic:{category,...details}});
}
export function assertAPIKey(key) {
  if (!key) throw fault('KEY_MISSING');
  if (typeof key !== 'string' || /[^\x21-\x7e]/.test(key) || /^Bearer/i.test(key) || /^(?:your[_-]|replace[_-]|paste[_-]|sk-\.\.\.)/i.test(key)) throw fault('KEY_FORMAT');
}
function causes(error) {
  const values=[], seen=new Set();
  function visit(value,depth=0) {
    if (!value || typeof value!=='object' || seen.has(value) || depth>5) return;
    seen.add(value);values.push(value);visit(value.cause,depth+1);
    if (Array.isArray(value.errors)) for (const child of value.errors.slice(0,8)) visit(child,depth+1);
  }
  visit(error);return values;
}
export function connectionError(error, stage='api.request', signal) {
  if (error?.status) return error;
  const chain=causes(error);
  const code=chain.map(e=>e.code).find(code=>TLS_CODES.has(code)||DNS_CODES.has(code)||NETWORK_CODES.has(code)||STATE_CODES.has(code));
  const errorType=chain.map(e=>e.name).find(name=>ERROR_NAMES.has(name))||'Error';
  let category='CONNECTION_FAILED';
  if (TLS_CODES.has(code)) category='TLS_TRUST';
  else if (DNS_CODES.has(code)) category='DNS_LOOKUP';
  else if (NETWORK_CODES.has(code)) category='NETWORK_CONNECT';
  else if (STATE_CODES.has(code)) category='STATE_WRITE';
  else if (chain.some(e=>e.name==='TimeoutError') || signal?.reason?.name==='TimeoutError') category='REQUEST_TIMEOUT';
  else if (signal?.aborted || chain.some(e=>e.name==='AbortError')) category='REQUEST_CANCELLED';
  return fault(category,{stage,errorType,causeCode:code||null});
}
export function applicationError(error, stage='server.request') {
  const identified=connectionError(error,stage);
  return !identified?.diagnostic || identified.diagnostic.category==='CONNECTION_FAILED'
    ? fault('APP_FAILURE',{stage,errorType:ERROR_NAMES.has(error?.name)?error.name:'Error'}) : identified;
}

export async function apiResponseError(response, stage='api.response') {
  // Inspect a bounded JSON body only for known provider codes. Arbitrary provider
  // text may echo credentials or user content and is never forwarded.
  let value;
  try {
    const parts=[];let size=0;
    if (response.body) for await(const part of response.body) {
      size+=part.length;if(size>16000)break;parts.push(Buffer.from(part));
    }
    if(size<=16000)value=JSON.parse(Buffer.concat(parts).toString('utf8'));
  } catch { /* Status is sufficient when the body is not bounded JSON. */ }
  const code=PROVIDER_CODES.has(value?.error?.code)?value.error.code:null;
  const type=PROVIDER_TYPES.has(value?.error?.type)?value.error.type:null;
  const param=PROVIDER_PARAMS.has(value?.error?.param)?value.error.param:null;
  const ref=response.headers?.get?.('x-request-id');
  const providerRequestId=typeof ref==='string'&&/^req_[A-Za-z0-9_-]{1,120}$/.test(ref)?ref:null;
  let category=response.status>=500?'PROVIDER_UNAVAILABLE':response.status===401?'AUTHENTICATION':response.status===403?'ACCESS_DENIED':response.status===404?'MODEL_OR_ENDPOINT':response.status===429?'RATE_LIMIT':[400,422].includes(response.status)?'INVALID_API_REQUEST':'HTTP_REJECTED';
  if (['insufficient_quota','billing_hard_limit_reached'].includes(code)||type==='insufficient_quota')category='QUOTA';
  return fault(category,{stage,httpStatus:response.status,providerCode:code,providerType:type,providerParam:param,providerRequestId});
}

export function createDiagnostics({apiKey='',fetchImpl=globalThis.fetch,version='2.0.1',timeoutMs=10000,env=process.env}={}) {
  const errors=[];let lastCheck=null;
  function record(error,route) {
    const safe=error?.diagnostic?error:applicationError(error,route);
    const category=Object.hasOwn(FAULTS,safe.diagnostic?.category)?safe.diagnostic.category:'APP_FAILURE';
    // This service records only faults constructed by our own error classifiers.
    const entry={id:randomUUID(),at:new Date().toISOString(),route,...safe.diagnostic,category,message:FAULTS[category][1]};
    errors.unshift(entry);if(errors.length>10)errors.pop();return structuredClone(entry);
  }
  function report() {
    let keyFormatValid=false;try{assertAPIKey(apiKey);keyFormatValid=true;}catch{}
    return {schema:'workforce-connection-report.v1',at:new Date().toISOString(),appVersion:version,
      runtime:{node:process.version,platform:process.platform,architecture:process.arch,
        proxyEnvironmentPresent:!!(env.HTTPS_PROXY||env.https_proxy||env.HTTP_PROXY||env.http_proxy),
        environmentProxyRequested:env.NODE_USE_ENV_PROXY==='1'||/--use-env-proxy(?:\s|$)/.test(env.NODE_OPTIONS||'')||process.execArgv.includes('--use-env-proxy'),
        extraCAConfigured:!!env.NODE_EXTRA_CA_CERTS,
        systemCARequested:env.NODE_USE_SYSTEM_CA==='1'||/--use-system-ca(?:\s|$)/.test(env.NODE_OPTIONS||'')||process.execArgv.includes('--use-system-ca'),
        tlsVerificationDisabled:env.NODE_TLS_REJECT_UNAUTHORIZED==='0'},
      configuration:{openaiKeyConfigured:!!apiKey,keyFormatValid,voiceModel:'gpt-live-1',analysisModel:'gpt-6-astra'},
      lastConnectionCheck:structuredClone(lastCheck),recentErrors:structuredClone(errors),
      scope:'Metadata and sanitized failure diagnostics only. No API keys, audio, transcripts, SDP, proxy addresses, local paths or workforce records. Model metadata access does not prove a working Live session.'};
  }
  async function check(signal) {
    const started=Date.now();let combined;
    try {
      assertAPIKey(apiKey);
      combined=signal?AbortSignal.any([signal,AbortSignal.timeout(timeoutMs)]):AbortSignal.timeout(timeoutMs);
      let response;
      try { response=await fetchImpl('https://api.openai.com/v1/models/gpt-live-1',{method:'GET',redirect:'error',headers:{Authorization:`Bearer ${apiKey}`},signal:combined}); }
      catch(e){throw connectionError(e,'openai.model_metadata',combined);}
      if(!response.ok)throw await apiResponseError(response,'openai.model_metadata');
      const parts=[];let bytes=0,value;
      if(response.body) for await(const part of response.body) {
        bytes+=part.length;
        if(bytes>32000)throw fault('INVALID_API_RESPONSE',{stage:'openai.model_metadata',httpStatus:response.status});
        parts.push(Buffer.from(part));
      }
      try{value=JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{}
      if(value?.object!=='model'||typeof value.id!=='string'||!value.id)throw fault('INVALID_API_RESPONSE',{stage:'openai.model_metadata',httpStatus:response.status});
      lastCheck={at:new Date().toISOString(),status:'metadata_reachable',httpStatus:response.status,elapsedMs:Date.now()-started,
        message:'The server reached the model-metadata endpoint successfully. This did not start a voice session or test microphone/WebRTC. Try Start conversation next.'};
    }catch(error){
      const known=error?.diagnostic?error:connectionError(error,'openai.model_metadata',combined);
      const entry=record(known,'connection.check');
      lastCheck={at:new Date().toISOString(),status:'failed',elapsedMs:Date.now()-started,error:entry,
        message:entry.message+([403,404].includes(entry.httpStatus)?' A metadata endpoint denial does not by itself prove that session creation is denied.':'')};
    }
    return report();
  }
  return {record,report,check};
}
