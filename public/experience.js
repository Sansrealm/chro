/* Editorial visual layer. Decorative artwork contains no workforce data. */
(() => {
 'use strict';
 const root=document.getElementById('wi-app'),app=root?.__WI_APP,main=root?.querySelector('#wi-main');if(!app||!main)return;
 const icons={overview:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M18 8a3 3 0 0 1 0 6 M22 21v-2a4 4 0 0 0-3-4',operations:'M4 5h16v15H4z M8 2v6 M16 2v6 M4 10h16 M8 14h3 M14 14h2',economics:'M4 20V10 M10 20V4 M16 20v-8 M22 20H2',readiness:'M12 3l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z',experience:'M20 11c0 5-8 10-8 10S4 16 4 11a4 4 0 0 1 8-3 4 4 0 0 1 8 3z',signals:'M3 12h4l3-8 4 16 3-8h4',trust:'M12 2l8 4v6c0 5-8 10-8 10S4 17 4 12V6z M8 12l3 3 5-6'};
 const icon=id=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${icons[id]||icons.overview}"/></svg>`;
 const project=(x,y,z)=>{const a=.5,b=-.38,xx=x*Math.cos(a)+z*Math.sin(a),zz=-x*Math.sin(a)+z*Math.cos(a),yy=y*Math.cos(b)-zz*Math.sin(b);return [310+xx*151,185+yy*151];};
 const path=points=>points.map((p,i)=>(i?'L':'M')+p.map(n=>n.toFixed(2)).join(',')).join(' ');
 let grid='';
 for(let j=0;j<28;j++){const a=j*Math.PI/14;let pts=[];for(let i=0;i<=80;i++){const t=i*Math.PI/80;pts.push(project(Math.sin(t)*Math.cos(a),Math.cos(t),Math.sin(t)*Math.sin(a)));}grid+=`<path d="${path(pts)}"/>`;}
 for(let j=1;j<18;j++){const t=j*Math.PI/18;let pts=[];for(let i=0;i<=100;i++){const a=i*Math.PI/50;pts.push(project(Math.sin(t)*Math.cos(a),Math.cos(t),Math.sin(t)*Math.sin(a)));}grid+=`<path d="${path(pts)}"/>`;}
 const art=`<div class="wi-orbit-art" aria-hidden="true"><svg viewBox="0 0 620 380"><defs><radialGradient id="wi-orbit-glow"><stop stop-color="#f6a86f" stop-opacity=".95"/><stop offset=".58" stop-color="#f7cba3" stop-opacity=".75"/><stop offset="1" stop-color="#f3eadf" stop-opacity="0"/></radialGradient><linearGradient id="wi-orbit-stroke" x2="1" y2="1"><stop stop-color="#8b4222"/><stop offset=".5" stop-color="#ae6840"/><stop offset="1" stop-color="#dd9a65"/></linearGradient></defs><ellipse cx="310" cy="185" rx="257" ry="184" fill="url(#wi-orbit-glow)"/><g class="wi-orbit-mesh" fill="none" stroke="url(#wi-orbit-stroke)" stroke-width=".55" opacity=".65">${grid}</g><ellipse cx="310" cy="185" rx="235" ry="62" transform="rotate(-25 310 185)" fill="none" stroke="#fff9ed" stroke-width="2" opacity=".8"/><circle cx="112" cy="290" r="5" fill="#fff7e8"/><circle cx="500" cy="75" r="3" fill="#895036"/></svg><span>Perspective changes everything.</span></div>`;
 const menu=document.createElement('button');menu.type='button';menu.id='wi-explore';menu.className='wi-btn';menu.innerHTML='<span aria-hidden="true">☰</span> Explore';menu.setAttribute('aria-haspopup','dialog');menu.setAttribute('aria-controls','wi-navigation-dialog');
 const dialog=document.createElement('dialog');dialog.id='wi-navigation-dialog';dialog.setAttribute('aria-labelledby','wi-navigation-title');dialog.innerHTML='<div class="wi-menu-head"><h2 id="wi-navigation-title">Explore the enterprise</h2><button type="button" class="wi-btn" data-menu-close>Close ×</button></div><nav class="wi-domains" aria-label="Explore workforce views"></nav>';
 root.append(dialog);root.querySelector('.wi-toolbar')?.prepend(menu);
 menu.addEventListener('click',()=>dialog.showModal());
 dialog.addEventListener('click',e=>{if(e.target.closest('[data-go],[data-menu-close]')||e.target===dialog)dialog.close();});
 function render(){
  root.dataset.view=app.state.page;root.dataset.domain=app.state.domain;
  root.querySelectorAll('[data-go]').forEach(button=>{const number=button.querySelector('.wi-nav-number');if(number){number.innerHTML=icon(button.dataset.go);number.setAttribute('aria-hidden','true');}});
  dialog.querySelector('nav').innerHTML=root.querySelector('#wi-domains').innerHTML;
  const overview=app.state.page==='monitor'&&app.state.domain==='overview';
  main.classList.toggle('wi-overview',overview);
  if(overview){const head=main.querySelector('.wi-head');head?.classList.add('wi-launch');if(head&&!head.querySelector('.wi-orbit-art'))head.insertAdjacentHTML('beforeend',art);
   const hero=main.querySelector('.wi-hero'),split=main.querySelector('.wi-split');
   if(hero&&split&&!split.querySelector('.wi-agenda')){const agenda=document.createElement('div');agenda.className='wi-agenda';const signals=split.lastElementChild;split.append(agenda);agenda.append(hero,signals);}
  }
  const status=root.querySelector('.wi-demo-tag');if(status)status.textContent='Synthetic workspace';
  const connection=root.querySelector('.wo-toggle');if(connection){connection.textContent='Connections';connection.title='Connections & readiness';connection.setAttribute('aria-label','Connections & readiness');}
 }
 window.WI_EXPERIENCE={render};render();
})();
