const FUEL_TYPES = ['Benzina', 'Gasolio', 'GPL', 'Metano'];
const FUEL_META = {
    Benzina: { icon: 'fa-gas-pump', className: 'benzina' },
    Gasolio: { icon: 'fa-truck', className: 'gasolio' },
    GPL: { icon: 'fa-fire', className: 'gpl' },
    Metano: { icon: 'fa-wind', className: 'metano' }
};

const appState = {
    map: null,
    markersLayer: null,
    userLocation: null,
    lastGpsAddress: null,
    selectedFuel: 'Benzina',
    currentView: 'map',
    currentResults: [],
    currentSearchContext: null,
    sheetExpanded: false,
    sheetState: 'half',
    listSetupOpen: true,
    autoSearchTimer: null,
    loading: false
};

const ui = {};

document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
    cacheDom();
    setLoadingState(false);
    initializeMap();
    initializeFuelGrid();
    bindEvents();
    updateDatasetInfo();
    updateStatusLocation('Posizione da impostare');
    updateFuelAverages();
    updateCalcUi();
    updateResultsSummary();
    updateSheetPresentation();
    syncSearchHint();
}

function isMobileViewport() {
    return window.matchMedia('(max-width: 900px)').matches;
}

function cacheDom() {
    ui.appShell = document.querySelector('.app-shell');
    ui.sheet = document.getElementById('controlSheet');
    ui.sheetTitle = document.getElementById('sheetTitle');
    ui.emptyState = document.getElementById('emptyState');
    ui.statusLocation = document.getElementById('statusLocation');
    ui.statusTimestamp = document.getElementById('statusTimestamp');
    ui.statusDataset = document.getElementById('statusDataset');
    ui.addressInput = document.getElementById('addressInput');
    ui.radiusSelect = document.getElementById('radiusSelect');
    ui.maxResultsSelect = document.getElementById('maxResultsSelect');
    ui.searchBtn = document.getElementById('searchBtn');
    ui.searchHint = document.getElementById('searchHint');
    ui.resultsHeadline = document.getElementById('resultsHeadline');
    ui.resultsSummaryChips = document.getElementById('resultsSummaryChips');
    ui.resultsSetupToggle = document.getElementById('resultsSetupToggle');
    ui.listContainer = document.getElementById('listContainer');
    ui.inlineMessage = document.getElementById('inlineMessage');
    ui.calcInput = document.getElementById('calcInput');
    ui.calcInputLabel = document.getElementById('calcInputLabel');
    ui.calcInputUnit = document.getElementById('calcInputUnit');
    ui.calcSummaryTag = document.getElementById('calcSummaryTag');
    ui.avgPriceLabel = document.getElementById('avgPriceLabel');
    ui.avgPriceValue = document.getElementById('avgPriceValue');
    ui.calcPreviewValue = document.getElementById('calcPreviewValue');
    ui.infoPanel = document.getElementById('infoPanel');
    ui.infoStationCount = document.getElementById('infoStationCount');
    ui.infoTimestamp = document.getElementById('infoTimestamp');
    ui.loadingState = document.getElementById('loadingState');
    ui.loadingTitle = document.getElementById('loadingTitle');
    ui.loadingText = document.getElementById('loadingText');
    ui.fuelGrid = document.getElementById('fuelGrid');
}

function initializeMap() {
    appState.map = L.map('map', {
        zoomControl: false,
        preferCanvas: true
    }).setView([45.4642, 9.19], 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(appState.map);

    L.control.zoom({ position: 'bottomright' }).addTo(appState.map);
    appState.markersLayer = L.layerGroup().addTo(appState.map);
}

function initializeFuelGrid() {
    ui.fuelGrid.innerHTML = '';
    FUEL_TYPES.forEach((fuelType) => {
        const fuelMeta = FUEL_META[fuelType];
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `fuel-option ${fuelType === appState.selectedFuel ? 'is-active' : ''}`;
        button.dataset.fuel = fuelType;
        button.innerHTML = `
            <div class="fuel-option-head">
                <span class="fuel-badge ${fuelMeta.className}">
                    <i class="fas ${fuelMeta.icon}" aria-hidden="true"></i>
                </span>
                <span class="summary-tag">Media</span>
            </div>
            <div class="fuel-meta">
                <strong>${fuelType}</strong>
                <span data-role="avg-price">N/D</span>
                <small data-role="avg-scope">Tutte le pompe</small>
            </div>
        `;
        ui.fuelGrid.appendChild(button);
    });
}

function bindEvents() {
    document.getElementById('heroGpsBtn').addEventListener('click', handleGpsRequest);
    document.getElementById('gpsBtn').addEventListener('click', handleGpsRequest);
    document.getElementById('sheetHandleBtn').addEventListener('click', toggleSheet);
    document.getElementById('collapseSheetBtn').addEventListener('click', toggleSheet);
    document.getElementById('addressSearchBtn').addEventListener('click', handleSearch);
    document.getElementById('searchBtn').addEventListener('click', handleSearch);
    document.getElementById('viewMapBtn').addEventListener('click', () => setView('map'));
    document.getElementById('viewListBtn').addEventListener('click', () => setView('list'));
    document.getElementById('infoToggleBtn').addEventListener('click', () => toggleInfoPanel(true));
    document.getElementById('closeInfoBtn').addEventListener('click', () => toggleInfoPanel(false));
    ui.resultsSetupToggle.addEventListener('click', () => setListSetupOpen(!appState.listSetupOpen));

    window.addEventListener('resize', () => {
        if (!isMobileViewport() && appState.currentView === 'map') {
            appState.sheetState = appState.sheetExpanded ? 'full' : 'peek';
        }
        updateSheetPresentation();
    });

    ui.addressInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleSearch();
        }
    });

    ui.addressInput.addEventListener('input', () => {
        if (!ui.addressInput.value.trim()) {
            appState.lastGpsAddress = null;
        }
        syncSearchHint();
    });

    ui.addressInput.addEventListener('change', () => {
        if (ui.addressInput.value.trim()) {
            queueAutoSearch('indirizzo');
        }
    });

    ui.radiusSelect.addEventListener('change', () => {
        updateFuelAverages();
        updateCalcUi();
        syncSearchHint();
        queueAutoSearch('raggio');
    });

    ui.maxResultsSelect.addEventListener('change', () => {
        syncSearchHint();
        queueAutoSearch('numero risultati');
    });

    ui.fuelGrid.addEventListener('click', (event) => {
        const option = event.target.closest('.fuel-option');
        if (!option) {
            return;
        }
        appState.selectedFuel = option.dataset.fuel;
        refreshFuelSelection();
        updateCalcUi();
        syncSearchHint();
        queueAutoSearch('carburante');
    });

    document.querySelectorAll('input[name="calcMode"]').forEach((radio) => {
        radio.addEventListener('change', updateCalcUi);
    });

    ui.calcInput.addEventListener('input', updateCalcUi);

    ui.listContainer.addEventListener('click', (event) => {
        const stationCard = event.target.closest('.station-card');
        const directionsButton = event.target.closest('[data-role="directions"]');

        if (directionsButton) {
            const stationId = Number(directionsButton.dataset.stationId);
            const station = appState.currentResults.find((result) => result.id === stationId);
            if (station) {
                openDirections(station);
            }
            return;
        }

        if (stationCard) {
            const stationId = Number(stationCard.dataset.stationId);
            const station = appState.currentResults.find((result) => result.id === stationId);
            if (station) {
                focusStationOnMap(station);
            }
        }
    });

    ui.infoPanel.addEventListener('click', (event) => {
        if (event.target === ui.infoPanel) {
            toggleInfoPanel(false);
        }
    });
}

function setView(view) {
    appState.currentView = view;
    ui.appShell.dataset.view = view;
    document.getElementById('viewMapBtn').classList.toggle('is-active', view === 'map');
    document.getElementById('viewListBtn').classList.toggle('is-active', view === 'list');

    if (view === 'list') {
        appState.sheetExpanded = true;
        appState.listSetupOpen = appState.currentResults.length === 0;
    } else {
        appState.listSetupOpen = true;
        if (isMobileViewport()) {
            appState.sheetState = appState.currentResults.length > 0 ? 'peek' : 'half';
        }
    }

    updateSheetPresentation();

    if (appState.map) {
        setTimeout(() => appState.map.invalidateSize(), 120);
    }
}

function toggleSheet() {
    if (appState.currentView === 'list') {
        setListSetupOpen(!appState.listSetupOpen);
        return;
    }

    if (isMobileViewport()) {
        cycleSheetState();
        return;
    }

    setSheetExpanded(!appState.sheetExpanded);
}

function cycleSheetState() {
    const sequence = ['peek', 'half', 'full'];
    const currentIndex = sequence.indexOf(appState.sheetState);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % sequence.length;
    appState.sheetState = sequence[nextIndex];
    appState.sheetExpanded = appState.sheetState !== 'peek';
    updateSheetPresentation();
}

function setSheetExpanded(expanded) {
    appState.sheetExpanded = expanded;
    if (isMobileViewport() && appState.currentView === 'map') {
        appState.sheetState = expanded ? 'full' : 'peek';
    }
    updateSheetPresentation();
}

function setListSetupOpen(open) {
    appState.listSetupOpen = open;
    updateSheetPresentation();
}

function updateSheetPresentation() {
    const isListView = appState.currentView === 'list';
    const collapseButton = document.getElementById('collapseSheetBtn');
    const collapseIcon = collapseButton.querySelector('i');

    ui.sheet.classList.toggle('is-peek', !isListView && !appState.sheetExpanded);
    ui.appShell.dataset.listSetup = appState.listSetupOpen ? 'open' : 'closed';
    ui.appShell.dataset.sheetState = appState.sheetState;

    if (isListView) {
        ui.sheetTitle.textContent = appState.listSetupOpen ? 'Lista risultati e filtri' : 'Lista risultati';
        ui.resultsSetupToggle.hidden = false;
        ui.resultsSetupToggle.innerHTML = appState.listSetupOpen
            ? '<i class="fas fa-xmark" aria-hidden="true"></i>Chiudi filtri'
            : '<i class="fas fa-sliders" aria-hidden="true"></i>Modifica ricerca';
        collapseIcon.className = `fas ${appState.listSetupOpen ? 'fa-xmark' : 'fa-sliders'}`;
        collapseButton.setAttribute('aria-label', appState.listSetupOpen ? 'Chiudi filtri' : 'Apri filtri');
    } else {
        ui.sheetTitle.textContent = appState.sheetExpanded ? 'Controlli e risultati' : 'Imposta la ricerca';
        ui.resultsSetupToggle.hidden = true;
        if (isMobileViewport()) {
            collapseIcon.className = 'fas fa-grip-lines';
            collapseButton.setAttribute('aria-label', 'Cambia stato pannello: peek, half, full');
        } else {
            collapseIcon.className = `fas ${appState.sheetExpanded ? 'fa-chevron-down' : 'fa-chevron-up'}`;
            collapseButton.setAttribute('aria-label', appState.sheetExpanded ? 'Comprimi pannello' : 'Espandi pannello');
        }
    }
}

function hasSearchContext() {
    return Boolean(ui.addressInput.value.trim() || appState.userLocation);
}

function queueAutoSearch(sourceLabel) {
    if (!hasSearchContext()) {
        return;
    }

    if (appState.autoSearchTimer) {
        clearTimeout(appState.autoSearchTimer);
    }

    appState.autoSearchTimer = setTimeout(() => {
        appState.autoSearchTimer = null;
        handleSearch({ auto: true, sourceLabel });
    }, 350);
}

function toggleInfoPanel(open) {
    ui.infoPanel.classList.toggle('is-open', open);
    ui.infoPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
}

function setLoadingState(isLoading, title = 'Ricerca in corso', text = 'Sto cercando i distributori migliori per te') {
    appState.loading = isLoading;
    ui.loadingState.hidden = !isLoading;
    ui.loadingTitle.textContent = title;
    ui.loadingText.textContent = text;
}

function syncSearchHint() {
    const address = ui.addressInput.value.trim();
    const radius = Number(ui.radiusSelect.value);
    const locationReady = Boolean(address || appState.userLocation);
    ui.searchHint.textContent = locationReady
        ? `${appState.selectedFuel} entro ${radius} km`
        : 'Imposta prima una posizione';
}

function updateDatasetInfo() {
    ui.statusTimestamp.textContent = DATA_TIMESTAMP ? `Aggiornati ${DATA_TIMESTAMP}` : 'Dati disponibili';
    ui.infoTimestamp.textContent = DATA_TIMESTAMP || '-';
    ui.infoStationCount.textContent = Array.isArray(realFuelStations)
        ? realFuelStations.length.toLocaleString('it-IT')
        : '0';
    ui.statusDataset.textContent = DATA_SOURCE || 'Dati MIMIT';
}

function updateStatusLocation(label) {
    ui.statusLocation.innerHTML = `<i class="fas fa-location-dot" aria-hidden="true"></i>${label}`;
}

function getSelectedCalcMode() {
    return document.querySelector('input[name="calcMode"]:checked')?.value || 'liters';
}

function updateCalcUi() {
    const mode = getSelectedCalcMode();
    const rawValue = parseFloat(ui.calcInput.value) || 0;

    document.querySelectorAll('.mode-pill').forEach((pill) => {
        const input = pill.querySelector('input');
        pill.classList.toggle('is-active', input.checked);
    });

    if (mode === 'liters') {
        ui.calcInputLabel.textContent = 'Quanti litri vuoi acquistare?';
        ui.calcInputUnit.textContent = 'L';
        ui.calcInput.min = '1';
        ui.calcInput.step = '0.1';
        if (!ui.calcInput.value || Number(ui.calcInput.value) <= 0) {
            ui.calcInput.value = '55';
        }
    } else {
        ui.calcInputLabel.textContent = 'Qual e il tuo budget?';
        ui.calcInputUnit.textContent = '€';
        ui.calcInput.min = '1';
        ui.calcInput.step = '1';
        if (!ui.calcInput.value || Number(ui.calcInput.value) <= 0) {
            ui.calcInput.value = '50';
        }
    }

    ui.calcSummaryTag.textContent = mode === 'liters' ? `${rawValue || 0}L` : `€${rawValue || 0}`;

    const avgPrice = getAveragePriceForFuel(appState.selectedFuel);
    ui.avgPriceLabel.textContent = `Prezzo medio ${appState.selectedFuel.toLowerCase()}`;
    ui.avgPriceValue.textContent = avgPrice === null ? 'N/D' : `€${avgPrice.toFixed(3)}/L`;

    if (avgPrice === null || rawValue <= 0) {
        ui.calcPreviewValue.textContent = 'N/D';
        return;
    }

    if (mode === 'liters') {
        ui.calcPreviewValue.textContent = `€${(rawValue * avgPrice).toFixed(2)}`;
    } else {
        ui.calcPreviewValue.textContent = `${(rawValue / avgPrice).toFixed(1)}L`;
    }

    if (appState.currentResults.length > 0) {
        renderResults(appState.currentResults);
    }
}

function refreshFuelSelection() {
    document.querySelectorAll('.fuel-option').forEach((option) => {
        option.classList.toggle('is-active', option.dataset.fuel === appState.selectedFuel);
    });
}

function getCurrentAverageScope() {
    const selectedRadius = parseInt(ui.radiusSelect.value, 10);

    if (appState.currentSearchContext?.coordinates) {
        return {
            coordinates: appState.currentSearchContext.coordinates,
            radius: selectedRadius
        };
    }

    if (appState.userLocation) {
        return {
            coordinates: appState.userLocation,
            radius: selectedRadius
        };
    }

    return null;
}

function getScopedStationsForAverages() {
    const scope = getCurrentAverageScope();

    if (!scope) {
        return realFuelStations;
    }

    return realFuelStations.filter((station) => {
        const distance = calculateDistance(
            scope.coordinates.lat,
            scope.coordinates.lng,
            station.latitude,
            station.longitude
        );
        return distance <= scope.radius;
    });
}

function getAveragePriceForFuel(fuelType, stations = getScopedStationsForAverages()) {
    const prices = stations
        .map((station) => station?.prices?.[fuelType])
        .filter((price) => Number.isFinite(price) && price > 0);

    if (prices.length === 0) {
        return null;
    }

    const total = prices.reduce((sum, price) => sum + price, 0);
    return total / prices.length;
}

function updateFuelAverages() {
    const scopedStations = getScopedStationsForAverages();
    const scopeLabel = getCurrentAverageScope() ? `Entro ${ui.radiusSelect.value} km` : 'Tutte le pompe';

    document.querySelectorAll('.fuel-option').forEach((option) => {
        const fuelType = option.dataset.fuel;
        const avgPrice = getAveragePriceForFuel(fuelType, scopedStations);
        option.querySelector('[data-role="avg-price"]').textContent = avgPrice === null ? 'N/D' : `€${avgPrice.toFixed(3)}/L`;
        option.querySelector('[data-role="avg-scope"]').textContent = scopeLabel;
    });
}

async function handleGpsRequest() {
    if (!navigator.geolocation) {
        showInlineMessage('La geolocalizzazione non e supportata dal browser.', 'error');
        return;
    }

    setLoadingState(true, 'Sto rilevando la posizione', 'Uso il GPS per trovare il tuo punto di partenza');
    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000
            });
        });

        appState.userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
        };

        appState.map.setView([appState.userLocation.lat, appState.userLocation.lng], 13);

        setLoadingState(true, 'Sto traducendo la posizione', 'Converto le coordinate GPS in un indirizzo leggibile');
        const address = await reverseGeocode(appState.userLocation.lat, appState.userLocation.lng);
        ui.addressInput.value = address;
        appState.lastGpsAddress = address;
        updateStatusLocation(address);
        updateFuelAverages();
        updateCalcUi();
        syncSearchHint();
        showInlineMessage('Posizione rilevata. Puoi cercare subito oppure rifinire i filtri.', 'info');
    } catch (error) {
        const code = error?.code;
        const message = code === 1
            ? 'Accesso alla posizione negato.'
            : code === 2
                ? 'Posizione non disponibile.'
                : code === 3
                    ? 'Timeout nella richiesta posizione.'
                    : 'Impossibile ottenere la posizione GPS.';
        showInlineMessage(message, 'error');
    } finally {
        setLoadingState(false);
    }
}

async function handleSearch(options = {}) {
    const normalizedOptions = options instanceof Event ? {} : options;
    const isAuto = Boolean(normalizedOptions.auto);
    const sourceLabel = normalizedOptions.sourceLabel || 'impostazioni';
    const address = ui.addressInput.value.trim();
    let coordinates = null;

    if (appState.autoSearchTimer) {
        clearTimeout(appState.autoSearchTimer);
        appState.autoSearchTimer = null;
    }

    if (!isAuto) {
        setLoadingState(true, 'Ricerca distributori', 'Sto preparando il contesto di ricerca');
    }

    try {
        const isManualAddress = address && address !== appState.lastGpsAddress;

        if (isManualAddress) {
            coordinates = await geocodeAddress(address);
            appState.userLocation = coordinates;
            appState.lastGpsAddress = null;
            updateStatusLocation(address);
        } else if (address && appState.userLocation) {
            coordinates = appState.userLocation;
            updateStatusLocation(address);
        } else if (address) {
            coordinates = await geocodeAddress(address);
            appState.userLocation = coordinates;
            updateStatusLocation(address);
        } else if (appState.userLocation) {
            coordinates = appState.userLocation;
        }

        if (!coordinates) {
            if (!isAuto) {
                showInlineMessage('Imposta un indirizzo oppure usa il GPS prima di cercare.', 'error');
            }
            return;
        }

        const radius = parseInt(ui.radiusSelect.value, 10);
        const maxResults = parseInt(ui.maxResultsSelect.value, 10);
        appState.currentSearchContext = { coordinates, radius };
        updateFuelAverages();
        updateCalcUi();

        if (!isAuto) {
            setLoadingState(true, 'Ricerca distributori', `Cerco ${appState.selectedFuel} entro ${radius} km`);
        }
        const stations = await searchFuelStations(coordinates, radius, appState.selectedFuel);

        if (stations.length === 0) {
            appState.currentResults = [];
            renderMapMarkers([]);
            renderResults([]);
            if (appState.currentView === 'list') {
                setListSetupOpen(true);
            } else {
                setSheetExpanded(true);
            }
            ui.emptyState.style.display = 'block';
            showInlineMessage(`Nessun distributore con ${appState.selectedFuel} trovato entro ${radius} km.`, 'info');
            return;
        }

        appState.currentResults = maxResults === 100 ? stations : stations.slice(0, maxResults);
        renderResults(appState.currentResults);
        renderMapMarkers(appState.currentResults);
        if (appState.currentView === 'list') {
            setListSetupOpen(false);
        } else {
            setSheetExpanded(true);
            if (isMobileViewport()) {
                appState.sheetState = 'peek';
                updateSheetPresentation();
            }
        }
        ui.emptyState.style.display = 'none';
        if (isAuto) {
            showInlineMessage(`Risultati aggiornati automaticamente (${sourceLabel}).`, 'info');
        } else {
            showInlineMessage('', 'info');
        }
    } catch (error) {
        showInlineMessage(`Errore durante la ricerca: ${error.message}`, 'error');
    } finally {
        if (!isAuto) {
            setLoadingState(false);
        }
    }
}

function renderResults(stations) {
    ui.listContainer.innerHTML = '';

    if (stations.length === 0) {
        ui.resultsHeadline.textContent = 'Nessun risultato disponibile';
        updateResultsSummary();
        return;
    }

    const stationsWithCosts = calculateCosts(stations);
    appState.currentResults = stationsWithCosts;
    const bestPrice = Math.min(...stationsWithCosts.map((station) => station.price));

    stationsWithCosts.forEach((station) => {
        const card = document.createElement('article');
        const isBest = Math.abs(station.price - bestPrice) < 0.001;
        card.className = `station-card ${isBest ? 'best' : ''}`;
        card.dataset.stationId = String(station.id);

        const costMarkup = station.costInfo
            ? `<div class="cost-chip ${station.costInfo.isBest ? 'best' : ''}">${station.costInfo.display}</div>`
            : '';

        card.innerHTML = `
            <div class="station-main">
                <div class="station-topline">
                    <span class="station-name">${escapeHtml(station.name)}</span>
                    <span class="station-brand">${escapeHtml(station.brand || 'Indipendente')}</span>
                </div>
                <div class="station-address">${escapeHtml(station.address)}</div>
                <div class="station-meta">
                    <span class="meta-chip"><i class="fas fa-route" aria-hidden="true"></i>${station.distance.toFixed(1)} km</span>
                    <span class="meta-chip"><i class="fas fa-gas-pump" aria-hidden="true"></i>${escapeHtml(station.fuel)}</span>
                    ${isBest ? '<span class="meta-chip"><i class="fas fa-award" aria-hidden="true"></i>Miglior prezzo</span>' : ''}
                </div>
            </div>
            <div class="station-side">
                <div class="price-tag">
                    <strong>€${station.price.toFixed(3)}</strong>
                    <span>al litro</span>
                </div>
                ${costMarkup}
                <button class="direction-button" type="button" data-role="directions" data-station-id="${station.id}">Indicazioni</button>
            </div>
        `;
        ui.listContainer.appendChild(card);
    });

    ui.resultsHeadline.textContent = `${stationsWithCosts.length} distributori trovati`;
    updateResultsSummary();
}

function updateResultsSummary() {
    ui.resultsSummaryChips.innerHTML = '';

    if (appState.currentResults.length === 0) {
        ui.resultsHeadline.textContent = 'Nessuna ricerca eseguita';
        return;
    }

    const chips = [
        appState.selectedFuel,
        `${ui.radiusSelect.value} km`,
        `${appState.currentResults.length} risultati`
    ];

    chips.forEach((label) => {
        const chip = document.createElement('span');
        chip.className = 'status-chip';
        chip.textContent = label;
        ui.resultsSummaryChips.appendChild(chip);
    });
}

function calculateCosts(stations) {
    const mode = getSelectedCalcMode();
    const calcValue = parseFloat(ui.calcInput.value) || 0;
    if (calcValue <= 0 || stations.length === 0) {
        return stations.map((station) => ({ ...station, costInfo: null }));
    }

    const bestPrice = Math.min(...stations.map((station) => station.price));

    return stations.map((station) => {
        const isBest = Math.abs(station.price - bestPrice) < 0.001;
        if (mode === 'liters') {
            const totalCost = station.price * calcValue;
            const extraCost = Math.max(0, (station.price - bestPrice) * calcValue);
            return {
                ...station,
                costInfo: {
                    isBest,
                    display: isBest ? `€${totalCost.toFixed(2)}` : `+€${extraCost.toFixed(2)}`
                }
            };
        }

        const liters = calcValue / station.price;
        const bestLiters = calcValue / bestPrice;
        const lessLiters = Math.max(0, bestLiters - liters);
        return {
            ...station,
            costInfo: {
                isBest,
                display: isBest ? `${liters.toFixed(1)}L` : `-${lessLiters.toFixed(1)}L`
            }
        };
    });
}

function renderMapMarkers(stations) {
    appState.markersLayer.clearLayers();

    if (appState.userLocation) {
        const userIcon = L.divIcon({
            className: 'user-location-icon',
            html: '<div class="user-pin"></div>',
            iconSize: [18, 18],
            iconAnchor: [9, 9]
        });

        L.marker([appState.userLocation.lat, appState.userLocation.lng], { icon: userIcon })
            .bindPopup('<div class="popup-card"><strong>La tua posizione</strong><span>Punto di partenza attuale</span></div>')
            .addTo(appState.markersLayer);
    }

    if (stations.length === 0) {
        return;
    }

    const bestPrice = Math.min(...stations.map((station) => station.price));
    const bounds = [];

    stations.forEach((station) => {
        const isBest = Math.abs(station.price - bestPrice) < 0.001;
        const stationIcon = L.divIcon({
            className: 'station-location-icon',
            html: `<div class="station-pin ${isBest ? 'best' : ''}"></div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9]
        });

        const marker = L.marker([station.lat, station.lng], {
            icon: stationIcon,
            zIndexOffset: isBest ? 1200 : 0
        })
            .bindPopup(`
                <div class="popup-card">
                    <strong>${escapeHtml(station.name)}</strong>
                    <span>${escapeHtml(station.brand || 'Indipendente')}</span>
                    <span class="popup-price">€${station.price.toFixed(3)}/L</span>
                    <span>${station.distance.toFixed(1)} km</span>
                    ${isBest ? '<span><i class="fas fa-award" aria-hidden="true"></i> Miglior prezzo in area</span>' : ''}
                </div>
            `)
            .addTo(appState.markersLayer);

        marker.stationId = station.id;
        bounds.push([station.lat, station.lng]);
    });

    if (appState.userLocation) {
        bounds.push([appState.userLocation.lat, appState.userLocation.lng]);
    }

    if (bounds.length > 0) {
        appState.map.fitBounds(bounds, { padding: [56, 56] });
    }
}

function focusStationOnMap(station) {
    setView('map');
    appState.map.setView([station.lat, station.lng], 16);

    appState.markersLayer.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
            const latLng = layer.getLatLng();
            if (Math.abs(latLng.lat - station.lat) < 0.0001 && Math.abs(latLng.lng - station.lng) < 0.0001) {
                layer.openPopup();
            }
        }
    });
}

function openDirections(station) {
    const userAddress = ui.addressInput.value.trim();
    let origin = '';

    if (userAddress) {
        origin = encodeURIComponent(userAddress);
    } else if (appState.userLocation) {
        origin = `${appState.userLocation.lat},${appState.userLocation.lng}`;
    } else {
        const destinationOnly = `https://www.google.com/maps/search/?api=1&query=${station.lat},${station.lng}`;
        window.open(destinationOnly, '_blank', 'noopener');
        return;
    }

    const destination = `${station.lat},${station.lng}`;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
    window.open(url, '_blank', 'noopener');
}

function showInlineMessage(message, type = 'info') {
    if (!message) {
        ui.inlineMessage.textContent = '';
        ui.inlineMessage.className = 'inline-message is-hidden';
        return;
    }

    ui.inlineMessage.textContent = message;
    ui.inlineMessage.className = `inline-message ${type}`;
}

async function geocodeAddress(address) {
    const encodedAddress = encodeURIComponent(`${address}, Italy`);
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`);
    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Indirizzo non trovato');
    }

    return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
    };
}

async function reverseGeocode(lat, lng) {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
    const data = await response.json();
    if (!data.display_name) {
        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }

    const address = data.address || {};
    const parts = [];
    if (address.road) parts.push(address.road);
    if (address.house_number && parts.length > 0) parts[parts.length - 1] += ` ${address.house_number}`;
    if (address.city || address.town || address.village) parts.push(address.city || address.town || address.village);
    if (address.province) parts.push(address.province);
    return parts.join(', ') || data.display_name.split(',').slice(0, 3).join(',');
}

async function searchFuelStations(coordinates, radius, fuelType) {
    return realFuelStations
        .filter((station) => {
            const distance = calculateDistance(
                coordinates.lat,
                coordinates.lng,
                station.latitude,
                station.longitude
            );
            return distance <= radius && Number.isFinite(station?.prices?.[fuelType]);
        })
        .map((station) => ({
            id: station.id,
            name: station.name,
            brand: station.brand,
            address: station.address,
            lat: station.latitude,
            lng: station.longitude,
            price: parseFloat(station.prices[fuelType].toFixed(3)),
            fuel: fuelType,
            distance: calculateDistance(
                coordinates.lat,
                coordinates.lng,
                station.latitude,
                station.longitude
            )
        }))
        .sort((a, b) => a.price - b.price);
}

function calculateDistance(lat1, lng1, lat2, lng2) {
    const earthRadius = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadius * c;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
