const CACHE = 'everwell-static-v2';
const STATIC = ['/offline.html','/manifest.webmanifest','/icon-192.png','/icon-512.png'];
self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(STATIC)).then(() => self.skipWaiting())));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (event) => {
  const request=event.request;
  if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).catch(async()=>await caches.match('/offline.html')));
    return;
  }
  event.respondWith(caches.match(request).then((cached)=>cached||fetch(request).then((response)=>{
    if(response.ok&&new URL(request.url).pathname.startsWith('/_next/static/')){const copy=response.clone();caches.open(CACHE).then((cache)=>cache.put(request,copy));}
    return response;
  })));
});
self.addEventListener('push', (event) => {
  let payload={title:'Everwell',body:'You have a new reminder.',url:'/account#notifications'};
  try { if(event.data) payload={...payload,...event.data.json()}; } catch { if(event.data) payload.body=event.data.text(); }
  event.waitUntil(self.registration.showNotification(payload.title,{body:payload.body,icon:'/icon-192.png',badge:'/icon-192.png',data:{url:payload.url||'/account#notifications'},tag:payload.tag||undefined}));
});
self.addEventListener('notificationclick',(event)=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||'/account#notifications',self.location.origin).href;
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then((windows)=>{
    const match=windows.find((client)=>new URL(client.url).origin===self.location.origin);
    if(match){match.navigate(target);return match.focus();}
    return clients.openWindow(target);
  }));
});
