import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';

export function createJournal(storageDir, { objectStore } = {}) {
  let state = { schema: 1, decisions: [], investigations: [], audit: [] }, pending = Promise.resolve();
  const path = storageDir ? join(storageDir, 'workspace.json') : null;
  const clone = value => structuredClone(value);
  function validate(data) {
    if (data.schema !== 1 || !Array.isArray(data.decisions) || !Array.isArray(data.audit) || data.decisions.length > 100 || data.audit.length > 1000 || (data.investigations !== undefined && (!Array.isArray(data.investigations) || data.investigations.length > 100))) throw Error('Saved workspace schema is invalid.');
    return {...data, investigations:data.investigations||[]};
  }
  let remoteSeen=false;
  async function loadRemote() {
    const result=await objectStore.read('workspace.json');
    if(!result.data&&remoteSeen)throw Error('Saved cloud workspace is missing. Restore its previous object version.');
    if(result.data){result.data=validate(result.data);remoteSeen=true;}
    return result;
  }
  async function persist(next) {
    if (!path) return;
    const temp = `${path}.${randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify(next), { mode: 0o600 });
    await rename(temp, path);
  }
  function change(operation) {
    const run = pending.then(async () => {
      if(objectStore){
        for(let attempt=0;attempt<3;attempt++){
          const current=await loadRemote(), next=clone(current.data||{schema:1,decisions:[],investigations:[],audit:[]}), result=operation(next);
          try{await objectStore.write('workspace.json',next,current.generation);state=next;remoteSeen=true;return clone(result);}
          catch(error){if(error.status!==409||attempt===2)throw error;}
        }
      }
      const next = clone(state), result = operation(next);
      await persist(next); state = next; return clone(result);
    });
    pending = run.catch(() => {}); return run;
  }
  return {
    async refresh() { if(objectStore){await pending;const current=await loadRemote();if(current.data)state=current.data;} },
    async init() {
      if(objectStore){const current=await loadRemote();if(current.data)state=current.data;return;}
      if (!path) return;
      await mkdir(storageDir, { recursive: true, mode: 0o700 });
      let data;
      try { data = JSON.parse(await readFile(path, 'utf8')); }
      catch (error) { if (error.code === 'ENOENT') return; throw Error('Saved workspace cannot be read; restore or repair the state directory.'); }
      if (data.schema !== 1 || !Array.isArray(data.decisions) || !Array.isArray(data.audit) || data.decisions.length > 100 || data.audit.length > 1000) throw Error('Saved workspace schema is invalid.');
      if (data.investigations !== undefined && (!Array.isArray(data.investigations) || data.investigations.length > 100)) throw Error('Saved investigations schema is invalid.');
      state = { ...data, investigations: data.investigations || [] };
    },
    investigations: () => clone(state.investigations),
    saveInvestigation(draft) { return change(next => {
      const digest = createHash('sha256').update(JSON.stringify(draft)).digest('hex');
      const found = next.investigations.find(item => item.digest === digest);
      if (found) return found;
      if (next.investigations.length >= 100) throw Object.assign(Error('This workspace holds 100 investigations. Export before creating more.'), { status: 409 });
      const item = { ...draft, id: randomUUID(), digest, savedAt: new Date().toISOString() };
      next.investigations.unshift(item);
      next.audit.push({ id: randomUUID(), at: item.savedAt, type: 'investigation.saved', details: { id: item.id, metricId: item.metricId, sourceVersion: item.sourceVersion } });
      next.audit = next.audit.slice(-1000); return item;
    }); },
    decisions: () => clone(state.decisions),
    audit: () => clone(state.audit),
    get: id => clone(state.decisions.find(item => item.id === id) || null),
    log(type, details = {}) { return change(next => { const entry = { id: randomUUID(), at: new Date().toISOString(), type, details }; next.audit.push(entry); next.audit = next.audit.slice(-1000); return entry; }); },
    save(draft) { return change(next => {
      const digest = createHash('sha256').update(JSON.stringify(draft)).digest('hex');
      const found = next.decisions.find(item => item.digest === digest);
      if (found) return found;
      if (next.decisions.length >= 100) throw Object.assign(Error('This demo workspace holds 100 saved drafts. Export the workspace before creating a fresh state directory.'), { status: 409 });
      const item = { ...draft, id: randomUUID(), digest, savedAt: new Date().toISOString(), status: 'draft-unapproved', review: null };
      next.decisions.unshift(item);
      next.audit.push({ id: randomUUID(), at: item.savedAt, type: 'decision.saved', details: { id: item.id, caseId: item.caseId, sourceVersion: item.sourceVersion } });
      next.audit = next.audit.slice(-1000); return item;
    }); },
    attachReview(id, result) { return change(next => {
      const draft = next.decisions.find(item => item.id === id);
      if (!draft) throw Object.assign(Error('Saved draft not found'), { status: 404 });
      draft.review = { ...result, createdAt: new Date().toISOString() };
      next.audit.push({ id: randomUUID(), at: draft.review.createdAt, type: 'decision.reviewed', details: { id, mode: result.mode } });
      next.audit = next.audit.slice(-1000); return draft;
    }); },
    settled: () => pending
  };
}
