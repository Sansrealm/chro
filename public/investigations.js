(() => {
  'use strict';
  const root=document.getElementById('wi-app'), app=root?.__WI_APP, main=root?.querySelector('#wi-main');
  if(!app||!main)return;
  let items=[], selected=null, question='', notes='', expanded=false, busy=false, message='Save the question, scoped observation and pinned evidence on this server.';
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function request(body){const r=await fetch('/api/investigations',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)}:{signal:AbortSignal.timeout(15000)});const data=await r.json();if(!r.ok)throw Error(data.error||'Investigation request failed.');return data;}
  function render(){
    if(app.state.page!=='investigate')return;
    const active=document.activeElement;
    const focusId=active?.id?.startsWith('wi-investigation-')?active.id:null;
    const focusAction=active?.dataset?.investigation;
    const previous=main.querySelector('#wi-investigation-save');
    if(previous)expanded=previous.open;
    previous?.remove();
    const detail=document.createElement('details');detail.id='wi-investigation-save';detail.className='wi-investigation-save';detail.open=expanded;
    const stale=selected&&selected.sourceVersion!==window.WI_DATA.sourceVersion;
    detail.innerHTML=`<summary>Investigation notebook <span>${items.length} saved${selected?' · '+(stale?'Older evidence revision':'Saved investigation open'):''}</span></summary><div class="wi-notebook-grid"><div><label for="wi-investigation-question">Question to resolve</label><input id="wi-investigation-question" maxlength="500" value="${esc(question)}" placeholder="What would change our decision?"><label for="wi-investigation-notes">Notes and alternative explanations</label><textarea id="wi-investigation-notes" maxlength="4000" rows="3">${esc(notes)}</textarea><button type="button" class="wi-btn primary" data-investigation="save" ${busy?'disabled':''}>Save investigation</button></div><div><label for="wi-investigation-list">Saved investigations</label><select id="wi-investigation-list"><option value="">Select an investigation</option>${items.map(x=>`<option value="${esc(x.id)}" ${x.id===selected?.id?'selected':''}>${esc(x.question||x.observation.metricLabel)} · ${esc(x.scope.function)} · ${esc(new Date(x.savedAt).toLocaleString())}</option>`).join('')}</select><div class="wi-actions"><button type="button" class="wi-btn" data-investigation="load" ${!selected||busy?'disabled':''}>Open investigation</button><button type="button" class="wi-btn" data-investigation="export" ${busy?'disabled':''}>Export investigations</button></div>${selected?`<p class="wi-small"><strong>Saved observation:</strong> ${esc(selected.observation.metricLabel)} · ${esc(selected.observation.formatted)}<br>${esc(selected.observation.scopeLabel)} · ${esc(selected.observation.period)}</p><p class="wi-investigation-source">Evidence revision: ${esc(selected.sourceVersion)}</p>`:''}${stale?'<p class="wi-note warn">This saved evidence is from an older revision. Opening it shows current analytics alongside the saved observation. Reopen each metric and repin it before saving a new version.</p>':''}</div></div><p role="status" aria-live="polite" class="wi-small">${esc(message)}</p>`;
    detail.addEventListener('toggle',()=>{if(detail.isConnected)expanded=detail.open;});
    main.querySelector('.wi-head')?.after(detail);
    if(focusId)document.getElementById(focusId)?.focus({preventScroll:true});
    else if(focusAction)detail.querySelector('[data-investigation='+focusAction+']')?.focus({preventScroll:true});
  }
  root.addEventListener('input',e=>{if(e.target.id==='wi-investigation-question')question=e.target.value;if(e.target.id==='wi-investigation-notes')notes=e.target.value;});
  root.addEventListener('change',e=>{if(e.target.id==='wi-investigation-list'){selected=items.find(x=>x.id===e.target.value)||null;render();}});
  root.addEventListener('click',async e=>{
    const action=e.target.closest('[data-investigation]')?.dataset.investigation;if(!action||busy)return;
    expanded=true;busy=true;
    try{
      if(action==='save'){
        const s=app.state;
        const result=await request({question,notes,metricId:s.metric,scope:{function:s.function,region:s.region,period:s.period},challenge:s.question,evidenceLedger:s.pins,sourceVersion:window.WI_DATA.sourceVersion});
        items=(await request()).items;selected=result;message='Investigation saved with server-calculated evidence. It survives browser and server restarts.';
      }
      if(action==='load'&&selected){
        question=selected.question;notes=selected.notes;
        Object.assign(app.state,selected.scope,{metric:selected.metricId,question:selected.challenge,pins:structuredClone(selected.evidenceLedger),presenting:false});
        message='Saved question and scope restored. The dashboard displays the current source; the saved observation retains its original revision.';app.render();
      }
      if(action==='export'){
        const data=await request();const url=URL.createObjectURL(new Blob([JSON.stringify({synthetic:true,investigations:data.items},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='workforce-investigations.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      }
    }catch(e){message=e.message;}finally{busy=false;render();}
  });
  window.WI_INVESTIGATIONS={render};
  request().then(data=>{items=data.items;render();}).catch(e=>{message=e.message;render();});
  // Main navigation stays reachable after scrolling, and panels return focus to their trigger.
  root.addEventListener('click',e=>{if(e.target.closest('[data-page],[data-go],[data-tour]')){main.tabIndex=-1;window.scrollTo({top:0});main.focus({preventScroll:true});}});
  render();
})();
