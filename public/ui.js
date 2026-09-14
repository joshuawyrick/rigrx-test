/* Shared presentation and browser capabilities. No credentials or request data are persisted here. */
function brandMark() {
  return '<span class="brand-word" aria-label="RigRx">RIG<span>RX</span></span>';
}
function pageHeading(title, subtitle, actions = '') {
  return '<header class="page-heading"><div><div class="eyebrow">' + T('RIGRX / ROADSIDE SERVICES') +
    '</div><h2 class="scr lg" tabindex="-1">' + esc(title) + '</h2><p class="scrsub">' +
    esc(subtitle) + '</p></div>' + (actions ? '<div class="heading-actions">' + actions + '</div>' : '') + '</header>';
}
function requestSteps(step) {
  return '<ol class="request-steps" aria-label="' + T('Request progress') + '">' +
    ['Service','Details','Location','Review'].map((label,i) =>
      '<li class="' + (i+1===step?'current':i+1<step?'done':'') + '"' +
      (i+1===step?' aria-current="step"':'') + '><span>' + (i+1) + '</span>' + T(label) + '</li>'
    ).join('') + '</ol>';
}
function statusBadge(status) {
  const cls = ['completed','selected'].includes(status) ? 'success' : ['cancelled','expired'].includes(status) ? 'gray' : 'red';
  return '<span class="pill ' + cls + '">' + esc(T(status)) + '</span>';
}
function assetSummary(kind, data) {
  const trailer = kind === 'trailer';
  const title = trailer ? [T('Trailer'),data.num].filter(Boolean).join(' ') :
    [T('Unit'),data.unit].filter(Boolean).join(' ');
  return '<div class="asset-summary"><div class="asset-symbol" aria-hidden="true">' + ic(trailer?'trailer':'truck',40) +
    '</div><div><span class="eyebrow">' + esc(title) + '</span><h3>' +
    esc(trailer?data.type:[data.year,data.make,data.model].filter(Boolean).join(' ')) +
    '</h3><p>' + esc(trailer?[data.len,data.axles].filter(Boolean).join(' · '):
      [data.engine,data.trans].filter(Boolean).join(' · ')) + '</p></div></div>';
}
function editEquipment(kind, id) {
  const asset = (kind === 'truck' ? S.trucks : S.trailers).find(x=>x.id === id);
  if (!asset) return;
  if (kind === 'truck') S.editTruck = {id:asset.id,...asset.data};
  else S.editTrailer = {id:asset.id,...asset.data};
  nav(kind === 'truck' ? 'd-setup2':'d-setup3');
}
function deleteEquipment(kind, id) {
  const asset = (kind === 'truck' ? S.trucks:S.trailers).find(x=>x.id === id);
  if (!asset) return;
  const label = kind === 'truck' ? [asset.data.year,asset.data.make,asset.data.model].filter(Boolean).join(' ') :
    [asset.data.type,asset.data.num].filter(Boolean).join(' ');
  return kind === 'truck' ? removeTruck(id,label):removeTrailer(id,label);
}
function equipmentCard(kind, asset) {
  const d=asset.data, trailer=kind==='trailer';
  const specs=trailer ? [[T('Length'),d.len],[T('Axles'),d.axles],[T('Tire size'),d.tires],[T('Suspension'),d.susp]] :
    [[T('Engine'),d.engine],[T('Transmission'),d.trans],[T('Steer tire size'),d.steer],[T('Drive tire size'),d.drive]];
  return '<article class="card equipment-card">' +
    '<div class="equipment-top"><span class="sec">' + T(trailer?'Trailer':'Truck') + '</span>' +
    (!trailer?dutyPill(d.duty):'') + '</div>' + assetSummary(kind,d) +
    '<dl class="spec-grid">' + specs.map(([label,value])=>'<div><dt>'+label+'</dt><dd>'+esc(value||'—')+'</dd></div>').join('')+'</dl>' +
    (trailer&&d.hazmat?'<div class="hazmat-note">'+ic('warn',16)+' '+T('Hazmat: Class')+' '+esc(d.hzClass)+' · UN '+esc(d.un)+'</div>':'')+
    '<div class="equipment-actions"><button class="btn ghost" onclick="editEquipment(\''+kind+'\','+asset.id+')">'+ic('edit',16)+' '+T('Edit details')+'</button>'+
    '<button class="icon-button danger" aria-label="'+T('Delete')+'" onclick="deleteEquipment(\''+kind+'\','+asset.id+')">'+ic('trash',18)+'</button></div></article>';
}
function currentNavItems() {
  const key=S.me.role==='provider'&&S.me.member_role==='tech'?'tech':S.me.role;
  return (NAVS[key]||NAVS.driver).filter(t=>!(t.v==='p-settings'&&S.me.member_role==='dispatcher'));
}
function vMore() {
  return pageHeading(T('Workspace'),T('Your tools, team and account.'))+
    '<div class="workspace-menu">'+currentNavItems().map(t=>'<button class="card workspace-link" onclick="nav(\''+t.v+'\')">'+
      ic(t.ico,24)+'<span>'+T(t.label)+'</span>'+ic('arrowR',18)+'</button>').join('')+'</div>';
}
function threadRows(rows) {
  return rows.map(t=>'<button class="thread-row" onclick="openThread('+t.request_id+','+t.provider_id+',null)">'+
    '<span class="thread-avatar" aria-hidden="true">'+ic('chat',22)+'</span><span class="thread-copy"><strong>'+esc(t.other_name||T('Conversation'))+
    '</strong><span>'+T('Request #')+t.request_id+' · '+esc(T(t.service_label))+'</span><span class="thread-preview">'+
    esc((t.last_body||T('Open conversation')).slice(0,100))+'</span></span>'+statusBadge(t.status)+'</button>').join('');
}
function filterThreads(value) {
  const query=value.trim().toLowerCase();
  document.querySelectorAll('.thread-row').forEach(el=>{el.hidden=!el.textContent.toLowerCase().includes(query);});
}
function enhanceUI() {
  document.documentElement.lang=getLang();
  document.querySelectorAll('.chip[onclick],.dutycard[onclick],.svc[onclick],.card.click[onclick],a[onclick]:not([href]),.cityopt[onclick]').forEach(el=>{
    el.setAttribute('role','button'); el.tabIndex=0;
    if(el.matches('.chip,.dutycard')) el.setAttribute('aria-pressed',String(el.classList.contains('sel')));
  });
  document.querySelectorAll('label.f').forEach(label=>{
    if(label.htmlFor) return;
    const next=label.nextElementSibling;
    const input=next?.matches('input,select,textarea')?next:next?.querySelector('input,select,textarea');
    if(input?.id) label.htmlFor=input.id;
  });
  document.querySelectorAll('table.tbl').forEach(table=>{
    if(table.parentElement.classList.contains('table-scroll')) return;
    const wrap=document.createElement('div'); wrap.className='table-scroll'; wrap.tabIndex=0;
    wrap.setAttribute('role','region'); wrap.setAttribute('aria-label',T('Scrollable table'));
    table.replaceWith(wrap); wrap.appendChild(table);
  });
  document.querySelectorAll('.modalwrap').forEach(wrap=>{
    const modal=wrap.querySelector('.modal');
    if(!modal||modal.getAttribute('role')) return;
    modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true');
    const title=modal.querySelector('h3');
    if(title){ title.id='dialog-title'; modal.setAttribute('aria-labelledby',title.id); }
  });
}
document.addEventListener('keydown',event=>{
  const target=event.target.closest?.('[role="button"]');
  if(target&&(event.key==='Enter'||event.key===' ')&&!event.target.matches('input,textarea,select')){
    event.preventDefault(); target.click(); enhanceUI();
  }
  const modal=document.querySelector('.modalwrap:last-of-type .modal');
  if(!modal) return;
  if(event.key==='Escape'){ closeConfirm(); return; }
  if(event.key==='Tab'){
    const focusables=[...modal.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length);
    const first=focusables[0], last=focusables[focusables.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
});
let uiObserverPending=false;
new MutationObserver(()=>{
  if(uiObserverPending)return;
  uiObserverPending=true;
  queueMicrotask(()=>{uiObserverPending=false;enhanceUI();});
}).observe(document.body,{childList:true,subtree:true});

function updateConnectionNotice() {
  const el=document.getElementById('connection-notice');
  if(!el)return;
  el.hidden=navigator.onLine;
  el.textContent=getLang()==='es'?'Sin conexión. Los mensajes y solicitudes requieren internet.':
    'You’re offline. Messages and requests need an internet connection.';
}
window.addEventListener('online',updateConnectionNotice);
window.addEventListener('offline',updateConnectionNotice);
window.addEventListener('load',()=>{
  updateConnectionNotice();
  if(!document.body.classList.contains('design-preview') && 'serviceWorker' in navigator && location.protocol==='https:'){
    navigator.serviceWorker.register('/sw.js').catch(()=>{});
  }
});
