import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudState} from '../cloud-state.mjs';
import {createJournal} from '../storage.mjs';
function store(){let data=null,generation='0';return {async read(){return {data:structuredClone(data),generation};},async write(name,next,expected){if(expected!==generation)throw Object.assign(Error('conflict'),{status:409});data=structuredClone(next);generation=String(Number(generation)+1);return generation;}};}
test('cloud journal preserves concurrent updates and survives a new runtime',async()=>{
 const objectStore=store(),a=createJournal(null,{objectStore}),b=createJournal(null,{objectStore});await Promise.all([a.init(),b.init()]);
 await Promise.all([a.saveInvestigation({question:'a'}),b.saveInvestigation({question:'b'})]);
 const restored=createJournal(null,{objectStore});await restored.init();assert.equal(restored.investigations().length,2);assert.equal(restored.audit().length,2);
 await a.refresh();assert.equal(a.investigations().length,2);
});
test('cloud adapter uses authenticated generation preconditions and bounded errors',async()=>{
 const calls=[];let response=new Response(JSON.stringify({schema:1}),{headers:{'x-goog-generation':'123'}});
 const api=createCloudState({bucket:'test-bucket',tokenProvider:async()=> 'test-only-token',fetchImpl:async(url,opts)=>{calls.push({url,opts});return response;}});
 assert.deepEqual(await api.read('workspace.json'),{data:{schema:1},generation:'123'});
 response=new Response(JSON.stringify({generation:'124'}));assert.equal(await api.write('workspace.json',{},'123'),'124');
 assert.match(calls[1].url,/ifGenerationMatch=123/);assert.equal(calls[1].opts.headers.Authorization,'Bearer test-only-token');
 response=new Response('private upstream details',{status:412});await assert.rejects(api.write('workspace.json',{},'123'),{status:409});
 response=new Response('private upstream details',{status:403});await assert.rejects(api.read('workspace.json'),e=>e.status===503&&!e.message.includes('private upstream'));
 response=new Response('',{status:404});assert.deepEqual(await api.read('workspace.json'),{data:null,generation:'0'});
});
test('failed cloud writes leave confirmed journal state intact',async()=>{
 const objectStore=store(),journal=createJournal(null,{objectStore});await journal.init();await journal.saveInvestigation({question:'saved'});
 objectStore.write=async()=>{throw Error('unavailable');};await assert.rejects(journal.saveInvestigation({question:'unsaved'}));assert.equal(journal.investigations().length,1);
});
