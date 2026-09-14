/* Network-only application; cache only the public offline explanation and icon.
   API responses, HTML app shells, messages, GPS and uploads are NEVER cached. */
const CACHE='rigrx-offline-v1';
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['/offline.html','/app-icon.svg'])));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('rigrx-offline-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||event.request.mode!=='navigate')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/uploads/'))return;
  event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html')));
});
