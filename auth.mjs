import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
const hash = text => createHash('sha256').update(text).digest();
export function createAuth({ password = '', secure = false } = {}) {
  if (password && password.length < 16) throw Error('APP_PASSWORD must contain at least 16 characters.');
  const sessions = new Map(), attempts = new Map(), ttl = 8 * 60 * 60 * 1000;
  function token(req) { return /(?:^|;\s*)wi_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1]; }
  return {
    enabled: !!password,
    identity(req) {
      if (!password) return 'local-synthetic-demo';
      const key = token(req), expires = sessions.get(key);
      if (!expires || expires < Date.now()) { sessions.delete(key); return null; }
      return key;
    },
    login(req, value, res) {
      const ip = req.socket.remoteAddress, now = Date.now(), last = attempts.get(ip);
      const attempt = last && now - last.at < 60000 ? last : { count: 0, at: now };
      if (attempt.count >= 5) throw Object.assign(Error('Too many sign-in attempts. Try again in one minute.'), { status: 429 });
      if (typeof value !== 'string' || value.length > 1024 || !timingSafeEqual(hash(value), hash(password))) {
        attempt.count++; attempts.set(ip, attempt); throw Object.assign(Error('Incorrect password'), { status: 401 });
      }
      attempts.delete(ip);
      for (const [key, expires] of sessions) if (expires < now) sessions.delete(key);
      if (sessions.size >= 100) sessions.delete(sessions.keys().next().value);
      const key = randomBytes(32).toString('hex'); sessions.set(key, now + ttl);
      res.setHeader('set-cookie', `wi_session=${key}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${ttl / 1000}${secure ? '; Secure' : ''}`);
      return { authenticated: true };
    },
    logout(req, res) { sessions.delete(token(req)); res.setHeader('set-cookie', `wi_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`); }
  };
}
export const loginPage = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Workforce Intelligence — Sign in</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#102e3e;color:#eef8f6;font:16px/1.5 system-ui}main{width:min(390px,82vw)}h1{font:38px Georgia}label,input,button{display:block;width:100%;box-sizing:border-box}input,button{padding:13px;margin:10px 0;border:1px solid #8db8b8;border-radius:6px;font:inherit}button{background:#b9e6d8;color:#102e3e;cursor:pointer}p{color:#b7d0d5}#error{color:#ffbea9}</style><main><p>WORKFORCE INTELLIGENCE</p><h1>Enter your workspace.</h1><p>Synthetic demonstration · shared workspace access</p><form><label for="password">Workspace password</label><input id="password" type="password" autocomplete="current-password" required maxlength="1024"><button>Sign in</button><p id="error" role="status"></p></form></main><script>document.querySelector('form').addEventListener('submit',async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;try{const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:document.querySelector('input').value})});const j=await r.json();if(!r.ok)throw Error(j.error);location.reload();}catch(e){document.querySelector('#error').textContent=e.message;}finally{b.disabled=false;}});</script></html>`;
