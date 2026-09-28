import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from '../server.mjs';
import { createJournal } from '../storage.mjs';

test('investigations recalculate evidence, reject stale revisions and survive restart alongside legacy decisions', async()=>{
 const dir=await mkdtemp(join(tmpdir(),'chro-investigation-test-'));let server;
 const start=async()=>{server=createServer({apiKey:'',storageDir:dir,fetchImpl:()=>{throw Error('Unexpected external request');}});await server.ready;await new Promise(r=>server.listen(0,'127.0.0.1',r));return `http://127.0.0.1:${server.address().port}`;};
 const close=async()=>{await new Promise(r=>server.close(r));await server.whenClosed();};
 try{
  await writeFile(join(dir,'workspace.json'),JSON.stringify({schema:1,decisions:[],audit:[{type:'legacy-preserved'}]}));
  let base=await start();
  const get=async path=>(await fetch(base+path)).json();
  const post=(path,value)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
  const snapshot=await get('/api/data/snapshot');
  const scope={function:'Engineering',region:'EMEA',period:'2026-09'};
  const ref={metricId:'P07',scope,sourceVersion:snapshot.sourceVersion,value:999999};
  const input={...ref,question:'Are goals complete?',notes:'Review denominator',challenge:'alternatives',evidenceLedger:[ref]};
  let response=await post('/api/investigations',input);assert.equal(response.status,201);const saved=await response.json();
  assert.notEqual(saved.observation.value,999999);assert.equal(saved.evidenceLedger[0].sourceVersion,snapshot.sourceVersion);assert.equal(saved.observation.denominator>0,true);
  assert.equal((await (await post('/api/investigations',input)).json()).id,saved.id);
  await close();base=await start();
  assert.deepEqual((await get('/api/investigations')).items,[saved]);
  assert.equal((await get('/api/audit')).events[0].type,'legacy-preserved');
  assert.equal((await post('/api/workday/sync',{batch:'correction'})).status,200);
  assert.equal((await post('/api/investigations',input)).status,409);
  const fresh=await get('/api/data/snapshot');
  assert.equal((await post('/api/investigations',{...input,sourceVersion:fresh.sourceVersion})).status,409);
  assert.equal((await post('/api/investigations',{...input,sourceVersion:fresh.sourceVersion,evidenceLedger:[],metricId:'invalid'})).status,400);
  assert.equal((await post('/api/investigations',{...input,sourceVersion:fresh.sourceVersion,evidenceLedger:[],notes:'x'.repeat(4001)})).status,400);
  assert.deepEqual((await get('/api/investigations')).items,[saved]);
 }finally{if(server?.listening)await close();await rm(dir,{recursive:true,force:true});}
});
