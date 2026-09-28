import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {mkdir} from 'node:fs/promises';
import {createServer} from '../server.mjs';
let server, receivedHeaders;const remote=process.env.CHRO_CLOUD_URL;
if(!remote){server=createServer({apiKey:'',password:'synthetic-shared-link-test'});server.on('request',req=>{if(req.url==='/' )receivedHeaders=req.headers;});await server.ready;await new Promise(r=>server.listen(0,'127.0.0.1',r));}
const base=remote||`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:process.env.CHRO_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1366,height:900}});
 await page.route('https://sharing.example.invalid/',route=>route.fulfill({contentType:'text/html',body:`<a href="${base}/">Open shared CHRO workspace</a>`}));
 await page.goto('https://sharing.example.invalid/');const responsePromise=page.waitForResponse(r=>r.url()===base+'/');await page.getByRole('link').click();const response=await responsePromise;
 const headers=receivedHeaders||Object.fromEntries(Object.entries(await response.request().allHeaders()).map(([k,v])=>[k.toLowerCase(),v]));if(!remote){assert.equal(headers['sec-fetch-site'],'cross-site');assert.equal(headers['sec-fetch-mode'],'navigate');}assert.equal(response.status(),200);await page.locator('#password').waitFor();assert.match(await page.title(),/Sign in/);
 await mkdir('docs/cloud',{recursive:true});await page.screenshot({path:'docs/cloud/shared-link-signin.png'});console.log('PASS: real browser cross-site link opens workspace sign-in (HTTP 200)');
}finally{await browser.close();if(server){await new Promise(r=>server.close(r));await server.whenClosed();}}



