self.addEventListener('fetch',fetchevent =>{
    console.log()
})

self.addEventListener('install',installEvent => {

    console.log('SW install complete');
    fetch('https://free.currencyconverterapi.com/api/v5/currencies').then(respose =>{
        return respose.json();
    })
    .then(json =>{
        console.log('Got here');
        console.log(json);
    });

})

self.addEventListener('activate',activteEvent =>{})