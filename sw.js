var CACHE='parknavi-sea-v1';var FILES=['./','index.html','app.js','data.js','icon.svg','manifest.webmanifest'];
self.addEventListener('install',function(e){e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(FILES)}).then(function(){return self.skipWaiting()}))});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k!==CACHE}).map(function(k){return caches.delete(k)}))}).then(function(){return self.clients.claim()}))});
self.addEventListener('fetch',function(e){var u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;
e.respondWith(fetch(e.request).then(function(r){if(r.ok){var c=r.clone();caches.open(CACHE).then(function(x){x.put(e.request,c)})}return r}).catch(function(){return caches.match(e.request).then(function(m){return m||caches.match('index.html')})}))});
