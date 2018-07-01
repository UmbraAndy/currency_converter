//SW v21

//const channel = new BroadcastChannel('broadcasts');
const appName = 'converter';
const staticContentCache = appName + '-static-v2';
const apiContentCache = 'converter-api';
const PREFIX_PATH = "/currency_converter";//make it empty for root path
const staticFilesToCache = [
    PREFIX_PATH+'/index.html',
    PREFIX_PATH+'/js/app.js',
    PREFIX_PATH+'/js/idb.js',
    PREFIX_PATH+'/css/bootstrap.min.css'
];
const appCaches = [staticContentCache, apiContentCache]
const convertApiBaseUrl = 'https://free.currencyconverterapi.com';
const API_REFERSH_INTERVAL = 120000;//units in millisec
let API_LAST_CALL_TIME = 0;


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
                    cacheNames.filter(cacheName => {
                        return cacheName.startsWith(appName && !appCaches.includes(cacheName))
                    })
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
        if ((urlPath === '/') || (urlPath === '/currency_converter/')) {
            fetchevent.respondWith(caches.match('/index.html'));
        }
        return;
    }
    if (requestedUrl.origin.startsWith(convertApiBaseUrl)) {
        console.log('Serving API origin');
        fetchevent.respondWith(serveCahcedApiOrNetworkApi(fetchevent.request))
        return;
    }
    fetchevent.respondWith(
        caches.match(fetchevent.request).then(cacheResponse => {
            return cacheResponse || fetch(fetchevent.request);
        })
    );
})

function serveCahcedApiOrNetworkApi(request) {
    let currentTime = new Date().getTime();
    let timeElapsed = currentTime - API_LAST_CALL_TIME;

    console.log('CurrentTime: ' + currentTime + ' TimeElapsed: ' + timeElapsed + ' Last call time: ' + API_LAST_CALL_TIME + ' Interval: ' + API_REFERSH_INTERVAL);
    //check if  cahce is stale
    if (timeElapsed >= API_REFERSH_INTERVAL) {
        console.log('Fetch from network')
        return fetchAPIFromNetwork(request);
    }
    else {
        console.log('Fetch from cache');
        let cachedResponse = fetchAPIFromCahce(request);
        return cachedResponse;
    }
}


function fetchAPIFromCahce(request) {
    return caches.open(apiContentCache)
        .then(cache => {
            return cache.match(request)
                .then(cachedResponse => {
                    if (cachedResponse) {
                        console.log('Served ' + cachedResponse + ' from cache');
                        return cachedResponse;
                    }
                    else {
                        console.log('New request.Could not serve from the cahce. Checking network');
                        return fetchAPIFromNetwork(request);

                    }
                })
        })
}

function fetchAPIFromNetwork(request) {
    let storageUrl = request.url;
    return fetch(request).then(networkResponse => {
        console.log('Served ' + networkResponse + ' from network');
        API_LAST_CALL_TIME = new Date().getTime();
        //save response to cahce
        return caches.open(apiContentCache).then(cache => {
            return cache.put(storageUrl, networkResponse.clone());
        }).then(() => {
            return networkResponse;
        })
    });
}

//handle message event
self.addEventListener('message', function (event) {
    if (event.data.action === 'skipWaitingStage') {
        self.skipWaiting();
        console.log('SW skipWaiting');
    }
});


