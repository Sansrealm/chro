import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const base=process.env.CHRO_CLOUD_URL||'https://chro-127316151094.us-central1.run.app';
const password=process.env.APP_PASSWORD||(await readFile('.cloud-local/workspace-password.txt','utf8')).trim();
const out='docs/cloud';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHRO_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1920,height:1080},reducedMotion:'reduce'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const denied=await context.request.get(base+'/api/investigations');assert.equal(denied.status(),401);
 await page.goto(base);await page.locator('#password').fill(password);await page.locator('form button').click();
 await page.waitForFunction(()=>window.WI_EXPERIENCE&&window.WI_INVESTIGATIONS);
 const cookies=await context.cookies();assert.ok(cookies.some(c=>c.name==='wi_session'&&c.secure&&c.httpOnly));
 const status=await (await page.request.get(base+'/api/status')).json();assert.equal(status.persistence,'cloud-storage');assert.equal(status.authentication,'password');
 if(process.env.CHRO_EXPECT_INVESTIGATION){const previous=(await (await page.request.get(base+'/api/investigations')).json()).items;assert.ok(previous.some(x=>x.id===process.env.CHRO_EXPECT_INVESTIGATION),'Investigation must survive replacement revision');}
 for(const name of ['monitor','investigate','decide']){await page.locator(`[data-page="${name}"]`).click();await page.screenshot({path:`${out}/${name}.png`});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 await page.locator('[data-page="investigate"]').click();await page.locator('[data-pin="C01"]').click();await page.locator('#wi-investigation-save summary').click();
 await page.locator('#wi-investigation-question').fill('Cloud deployment verification: retain evidence lineage across revisions');await page.locator('#wi-investigation-notes').fill('Synthetic deployment verification record.');
 await page.locator('[data-investigation="save"]').click();await page.waitForFunction(()=>document.querySelector('#wi-investigation-save [role="status"]').textContent.startsWith('Investigation saved'),null,{timeout:30000});
 const items=(await (await page.request.get(base+'/api/investigations')).json()).items;const saved=items.find(x=>x.question.startsWith('Cloud deployment verification:'));assert.ok(saved);assert.ok(saved.evidenceLedger.length);
 await page.reload();await page.locator('[data-page="investigate"]').click();await page.locator('#wi-investigation-save summary').click();await page.locator('#wi-investigation-list').selectOption(saved.id);await page.locator('[data-investigation="load"]').click();assert.equal(await page.locator('#wi-investigation-notes').inputValue(),'Synthetic deployment verification record.');
 await page.screenshot({path:`${out}/saved-investigation.png`});
 await page.setViewportSize({width:390,height:844});await page.locator('#wi-explore').click();await page.screenshot({path:`${out}/mobile-navigation.png`});await page.keyboard.press('Escape');assert.deepEqual(errors,[]);
 const result={at:new Date().toISOString(),url:base,persistence:status.persistence,authentication:status.authentication,unauthenticatedApi:denied.status(),secureCookie:true,savedInvestigationId:saved.id,evidenceCount:saved.evidenceLedger.length,investigationCount:items.length,browserErrors:errors,providerCallsMade:false};await writeFile(out+'/verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
