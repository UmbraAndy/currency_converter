//launch serviceworker registration on page load
let amountInput;
let convertedSpan;
let fromSelect;
let toSelect;
let converButton;
let currencyPair;
let dbPromise;

const DB_NAME = 'currency-db-store';
const DB_VERSION = 1;
const CURRENCY_STORE = 'currency';
const CONVERSION_STORE = 'conversions';
const API_BASE_URL ='https://free.currencyconverterapi.com/api/v5';


window.addEventListener('load', loadEvent => {

    //handleMessageChannel();
    //TODO check if database is set up and has value before goin to network
    setUpDatabase();
    registerServiceWorker();
    getAllCurrenciesFromDB()
        .then(currencies => {
            if (currencies == null || currencies.length <= 0) {
                //fetch from API
                console.log('Currencies from API')
                fetch(API_BASE_URL+'/currencies').then(response => {
                    return response.json();
                })
                    .then(jsonResponse => {
                        let currencies = jsonResponse.results;
                        return saveCurrenciesToDatastore(currencies);
                    })
                    .then(() => {
                        return getAllCurrenciesFromDB()
                    }).then(currencies => {
                        setupUiComponents(currencies);
                    })
            }
            else {
                console.log('Currencies from DB')
                setupUiComponents(currencies);
            }

        })
})

function setUpDatabase() {
    dbPromise = idb.open(DB_NAME, DB_VERSION, upgradeDB => {
        switch (upgradeDB.oldVersion) {
            case 0:
                //create object store to hold currencies
                upgradeDB.createObjectStore(CURRENCY_STORE);

                //create object store to hold conversion history
                upgradeDB.createObjectStore(CONVERSION_STORE);
        }
    });

}

function saveCurrenciesToDatastore(currencies) {
    //set up transaction to store currencies;
    return dbPromise.then(db => {
        let transaction = db.transaction(CURRENCY_STORE, 'readwrite');
        for (currency in currencies) {
            let currencyKey = "" + currency;
            let localCurrency = currencies[currencyKey];
            transaction.objectStore(CURRENCY_STORE).put(localCurrency, currencyKey);
        }
        return transaction.complete;
    })
}

function handleMessageChannel() {
    console.log('Channel sub');
    const channel = new BroadcastChannel('broadcasts');
    channel.addEventListener('message', event => {

        //check action is saveCurrency
        //populate from and to currency 
        let action = event.data.action;
        console.log('Action', action);
        switch (action) {
            case 'currencyFetched':
                let currencies = event.data.currencies.results;
                //save currencies to db
                saveCurrenciesToDatastore(currencies).then(transactionComplete => {
                    console.log('Tx complete');
                    setupUiComponents();
                })
                break;
        }
    });
}


function registerServiceWorker() {
    //check if service worker is not available return
    console.log('Start Reg MAIN');
    if (!navigator.serviceWorker) return;
    navigator.serviceWorker.register('/currency_converter/sw.js', { scope: "/" })
        .then(serviceWorkerRegistration => {
            if (navigator.serviceWorker.controller) {
                console.log('Service worker controlled');
            }
            else {
                console.log('Service worker not controlled');
            }
            //if there is a service worker in wating state, force update
            if (serviceWorkerRegistration.wating) {
                console.log('Found a waitng SW');
                notifyUIAboutUpdate(serviceWorkerRegistration.wating)
                //forceUpdate(reg.wating);
                return;
            }

            //if the service worker is in installing phase, 
            //track the isntallation and force update when the state changes
            if (serviceWorkerRegistration.installing) {
                console.log('Found an installling SW');
                attacheEventToPendingServiceWorker(serviceWorkerRegistration.installing);
                return;
            }
            //use the registration updatefound event to force update
            serviceWorkerRegistration.addEventListener('updatefound', updateFoundEvent => {
                attacheEventToPendingServiceWorker(serviceWorkerRegistration.installing)
            })

        })
        .catch(registrationError => {
            console.log('Service worker was not registered ', registrationError);
        });

}


function notifyUIAboutUpdate(watingServiceWorker) {
    //send message to worker to skip waiting
    watingServiceWorker.postMessage({ action: 'skipWaitingStage' });
    console.log('Got message to update');
}

function attacheEventToPendingServiceWorker(pendingServiceWorker) {
    pendingServiceWorker.addEventListener('statechange',
        statechangeEvent => {
            if (pendingServiceWorker.state == 'installed') {
                console.log('SW installed');
                notifyUIAboutUpdate(pendingServiceWorker);
            }
        });
}

function setupUiComponents(currencies) {
    amountInput = document.getElementById('amountInput');
    convertedSpan = document.getElementById('convertedSpan');
    fromSelect = document.getElementById('fromCurrency');
    toSelect = document.getElementById('toCurrency');
    converButton = document.getElementById('converButton');
    converButton.addEventListener('click', clickEvent => {
        convertCurrencies();
    })

    //populate select options
    currencies.map(currency => {
        let fromOption = new Option(currency.currencyName, currency.id);
        let toOption = new Option(currency.currencyName, currency.id);
        fromSelect.add(fromOption);
        toSelect.add(toOption);
    });
    //})

}

function getAllCurrenciesFromDB() {

    return dbPromise.then(db => {
        let transaction = db.transaction(CURRENCY_STORE);
        return transaction.objectStore(CURRENCY_STORE).getAll();
    })
}

function convertCurrencies() {
    //disable UI
    disableUI(true);
    let currencyPair = fromSelect.value + "_" + toSelect.value;
    console.log("The pair " + currencyPair);
    fetch(API_BASE_URL+'/convert?q=' + currencyPair + "&compact=y").then(convertResponse => {
        return convertResponse.json();
    }).then(json => {
        const rate = json[currencyPair].val;
        const amount = amountInput.value;
        const convertedAmount = multiplyByRate(amount, rate);
        //to two decimal places
        convertedSpan.textContent = convertedAmount.toFixed(2);        
        disableUI(false);
    })
}

function disableUI(disableFlag)
{
    amountInput.disabled = disableFlag;
    toSelect.disabled = disableFlag;
    fromSelect.disabled = disableFlag;
    converButton.disabled = disableFlag;
}


function multiplyByRate(amount, rate) {
    return parseFloat(amount) * parseFloat(rate);
}


