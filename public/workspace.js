let fleetSnapshot=null;
async function vFleet(){
 const d=await api('GET','/fleet');fleetSnapshot=d;
 const pending=(d.invitations||[]).map(i=>'<div class="card"><h3>'+esc(i.name)+'</h3><p>Invitation to join as '+esc(i.role)+'</p><button class="btn" onclick="acceptFleet('+i.id+')">Accept invitation</button></div>').join('');
 if(!d.fleet)return pageHeading('Fleet office','Shared equipment, drivers and roadside requests.')+pending+
  '<form class="card" onsubmit="event.preventDefault();createFleet()"><h3>Create your fleet</h3><label class="f" for="fleet-name">Company name</label><input id="fleet-name" required maxlength="100"><button class="btn" style="margin-top:20px">Create fleet</button><p class="muted">Drivers join by accepting an invitation after signing in with their phone.</p></form>';
 const office=['owner','dispatcher'].includes(S.me.fleet_role);
 if(!office)return pageHeading(d.fleet.name,'Your fleet office manages your assigned equipment.')+'<div class="card"><p>Your assigned trucks and trailers appear in My Garage and when you request service.</p><button class="btn" onclick="nav(\'d-garage\')">Open my garage</button></div>';
 const active=d.requests.filter(r=>['open','selected'].includes(r.status));
 return pageHeading(d.fleet.name,'Fleet operations / '+S.me.fleet_role,'<button class="btn dark" onclick="render()">Refresh</button><button class="btn dark" onclick="exportFleet()">Export requests</button>')+
  '<div class="fleet-metrics">'+[['Active requests',active.length],['Drivers & office',d.members.length],['Trucks',d.trucks.length],['Trailers',d.trailers.length]].map(([label,n])=>'<div class="card"><span class="sec">'+label+'</span><strong>'+n+'</strong></div>').join('')+'</div>'+
  '<section class="card"><h3>Roadside requests</h3><label class="f" for="fleet-filter">Show requests</label><select id="fleet-filter" onchange="filterFleetRequests(this.value)"><option value="all">All recent requests</option><option value="active">Active only</option></select><div class="table-scroll"><table class="tbl"><thead><tr><th>Request</th><th>Driver</th><th>Area</th><th>Status</th><th></th></tr></thead><tbody>'+d.requests.map(r=>'<tr data-fleet-status="'+esc(r.status)+'"><td>#'+r.id+' · '+esc(r.service_label)+'</td><td>'+esc(r.driver_name)+'</td><td>'+esc(r.area_label)+'</td><td>'+statusBadge(r.status)+'</td><td><button class="btn dark" onclick="nav(\'d-active\',{activeRequestId:'+r.id+'})">Open</button></td></tr>').join('')+'</tbody></table></div>'+(!d.requests.length?'<p class="muted">Requests from your fleet drivers will appear here.</p>':'')+'</section>'+
  '<section class="card"><h3>Equipment & assignments</h3><div class="grid2"><button class="btn dark" onclick="S.editTruck=null;nav(\'d-setup2\')">Add truck</button><button class="btn dark" onclick="S.editTrailer=null;nav(\'d-setup3\')">Add trailer</button></div>'+['trucks','trailers'].map(kind=>'<h4>'+kind.toUpperCase()+'</h4>'+d[kind].map(t=>'<div class="fleet-asset"><div><b>'+esc(kind==='trucks'?[t.data.unit,t.data.make,t.data.model].filter(Boolean).join(' · '):[t.data.num,t.data.type].filter(Boolean).join(' · '))+'</b><p class="muted">'+esc(t.data.vin||t.data.tires||'Equipment profile saved')+'</p></div><label>Assigned driver<select aria-label="Assigned driver for vehicle '+t.id+'" onchange="assignFleet(\''+kind+'\','+t.id+',this.value)"><option value="">Unassigned</option>'+d.members.filter(u=>u.fleet_role!=='dispatcher').map(u=>'<option value="'+u.id+'" '+(u.id===t.assigned_driver?'selected':'')+'>'+esc(u.name||u.phone)+'</option>').join('')+'</select></label><button class="btn dark" onclick="editFleetAsset(\''+kind+'\','+t.id+')">Edit</button></div>').join('')).join('')+'</section>'+
  '<section class="card"><h3>People</h3>'+d.members.map(u=>'<div class="fleet-person"><span><b>'+esc(u.name||u.phone)+'</b><br>'+esc(u.phone)+' · '+esc(u.fleet_role)+'</span>'+(S.me.fleet_role==='owner'&&u.id!==S.me.id?'<button class="btn dark" onclick="removeFleetMember('+u.id+')">Remove</button>':'')+'</div>').join('')+
  (S.me.fleet_role==='owner'?'<form onsubmit="event.preventDefault();inviteFleet()"><h4>Invite a driver or dispatcher</h4><div class="grid2"><label>Mobile number<input id="fleet-phone" type="tel" required></label><label>Role<select id="fleet-role"><option value="driver">Driver</option><option value="dispatcher">Dispatcher</option></select></label></div><button class="btn" style="margin-top:16px">Create invitation</button><p class="muted">Ask them to sign in and open Fleet office to accept. An invitation does not give access until they accept.</p></form>'+d.pending.map(i=>'<p>'+esc(i.phone)+' · '+esc(i.role)+' <button onclick="revokeFleetInvite('+i.id+')">Revoke</button></p>').join(''):'')+'</section>';
}
async function createFleet(){await api('POST','/fleet',{name:qv('fleet-name')});await loadMe();render();}
async function inviteFleet(){await api('POST','/fleet/invitations',{phone:qv('fleet-phone'),role:qv('fleet-role')});toast('Invitation ready');render();}
async function acceptFleet(id){await api('POST','/fleet/invitations/'+id+'/accept');await loadMe();render();}
async function revokeFleetInvite(id){await api('DELETE','/fleet/invitations/'+id);render();}
async function removeFleetMember(id){if(!confirm('Remove this person’s fleet access and vehicle assignments?'))return;await api('DELETE','/fleet/members/'+id);render();}
async function assignFleet(kind,id,driver){await api('PUT','/fleet/vehicles/'+kind+'/'+id+'/assignment',{driver_id:driver||null});toast('Assignment saved');await loadMe();}
function editFleetAsset(kind,id){const item=fleetSnapshot[kind].find(t=>t.id===id);if(kind==='trucks'){S.editTruck=item;nav('d-setup2');}else{S.editTrailer=item;nav('d-setup3');}}
function filterFleetRequests(value){document.querySelectorAll('[data-fleet-status]').forEach(row=>row.hidden=value==='active'&&!['open','selected'].includes(row.dataset.fleetStatus));}
function exportFleet(){
 const clean=value=>'"'+String(value??'').replace(/^[=+@\-]/,"' $&").replace(/"/g,'""')+'"';
 const rows=[['Request','Service','Driver','Area','Status','Created'],...fleetSnapshot.requests.map(r=>[r.id,r.service_label,r.driver_name,r.area_label,r.status,r.created_at])];
 const url=URL.createObjectURL(new Blob([rows.map(row=>row.map(clean).join(',')).join('\r\n')],{type:'text/csv'}));
 const a=document.createElement('a');a.href=url;a.download='rigrx-fleet-requests.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function vSystem(){
 const d=await api('GET','/admin/system');
 const orders=await api('GET','/admin/payment-orders');
 return pageHeading('System & payments','Integration status and interrupted payment recovery.')+
 '<div class="card"><h3>Connected services</h3>'+Object.entries(d).map(([key,value])=>'<p><b>'+esc(key)+'</b> · '+esc(value)+'</p>').join('')+'</div>'+
 '<div class="card"><h3>Payments awaiting confirmation</h3><p class="muted">Reconciliation looks up the original Stripe payment. It does not charge the company again.</p>'+orders.map(o=>'<div class="fleet-person"><span>'+esc(o.name)+' · Request #'+o.request_id+' · '+fmt$(o.amount_cents)+'<br>'+esc(o.created_at)+'</span><button class="btn dark" onclick="reconcilePayment(\''+o.id+'\')">Reconcile</button></div>').join('')+(!orders.length?'<p>No pending payments.</p>':'')+'</div>';
}
async function reconcilePayment(id){const result=await api('POST','/admin/payment-orders/'+id+'/reconcile');toast(result.message||'Payment reconciled');render();}
