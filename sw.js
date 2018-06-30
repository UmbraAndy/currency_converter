//SW v21

//const channel = new BroadcastChannel('broadcasts');
const appName = 'converter';
const staticContentCache = appName + '-static-v2';
const apiContentCache = 'converter-api';
const staticFilesToCache = ['/index.html',
    '/js/app.js',
    '/js/idb.js'
];
const appCaches = [staticContentCache, apiContentCache]
const convertApiBaseUrl = 'https://free.currencyconverterapi.com';


//handler for install
self.addEventListener('install', installEvent => {
    console.log('SW install started');
    installEvent.waitUntil(
        //save static files to cache
        caches.open(staticContentCache)
            .then(cache => {
                return cache.addAll(staticFilesToCache);
            })
    );
})


//handler for activate
self.addEventListener('activate', activteEvent => {
    console.log('SW activated started');
    //force the current page be controlled by this worker immediately
    
    //clean up old cache
    self.clients.claim();
    activteEvent.waitUntil(
        caches.keys()
        .then(cacheNames => {
            //filter out all caches that belog to this app
            //and is not the currenct static cache version
            //then delete them
            return Promise.all(
                cacheNames.filter(cacheName =>{
                     return cacheName.startsWith(appName && !appCaches.includes(cacheName))})
                     .map(filteredCacheName => {
                        return caches.delete(filteredCacheName)
                    })
            )
                    
        })
        
    )
})


//handler for fetch
self.addEventListener('fetch', fetchevent => {
    //capture the requested url
    const requestedUrl = new URL(fetchevent.request.url);
    console.log('FETCH: ' + requestedUrl + " origin: " + requestedUrl.origin);
    //check is it has the same origin with our app
    //to prevent highjacking of wrong request
    if (requestedUrl.origin === location.origin) {
        console.log('Serving APP origin')
        const urlPath = requestedUrl.pathname;
        //if toot url was requested, return index.html
        if (urlPath === '/') {
            fetchevent.respondWith(caches.match('/index.html'));
        }
        return;
    }
    if (requestedUrl.origin.startsWith(convertApiBaseUrl)) {
        console.log('Serving API origin');
        fetchevent.respondWith(serveCahcedAPI(fetchevent.request))
        return;
    }
    fetchevent.respondWith(
        caches.match(fetchevent.request).then(cacheResponse => {
            return cacheResponse || fetch(fetchevent.request);
        })
    );
})

function serveCahcedAPI(request) {
    let storageUrl = request.url;
    return caches.open(apiContentCache)
        .then(cache => {
            return cache.match(request)
                .then(cachedResponse => {
                    if (cachedResponse) {
                        console.log('Served ' + cachedResponse + ' from cache');
                        return cachedResponse;
                    }
                    return fetch(request).then(networkResponse => {
                        console.log('Served ' + networkResponse + ' from network');
                        cache.put(storageUrl, networkResponse.clone());
                        return networkResponse;
                    });
                })
        })
}

//handle message event
self.addEventListener('message', function (event) {
    if (event.data.action === 'skipWaitingStage') {
        self.skipWaiting();
        console.log('SW skipWaiting');
    }
});


