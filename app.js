/* =====================================================
   FuelExplorer · Light UX
   Stato semplificato: view, hasLocation, fuel, results
   ===================================================== */

const FUEL_TYPES = ['Benzina', 'Gasolio', 'Diesel Premium', 'GPL', 'Metano'];
const FUEL_META = {
    Benzina: { icon: 'fa-gas-pump' },
    Gasolio: { icon: 'fa-truck' },
    'Diesel Premium': { icon: 'fa-oil-can' },
    GPL:     { icon: 'fa-fire' },
    Metano:  { icon: 'fa-wind' }
};

const state = {
    map: null,
    markersLayer: null,
    userLocation: null,
    lastGpsAddress: null,
    selectedFuel: 'Benzina',
    view: 'map',                // 'map' | 'list'
    results: [],
    searchContext: null,        // { coordinates, radius }
    autoSearchTimer: null,
    toastTimer: null,
};

const dom = {};

document.addEventListener('DOMContentLoaded', init);

function init() {
    cacheDom();
    initMap();
    renderFuelPills();
    bindEvents();
    updateDatasetInfo();
    updateFuelAverageLabel();
    updateCalcUi();
}

function cacheDom() {
    const id = (x) => document.getElementById(x);
    dom.body = document.body;
    dom.viewMapBtn = id('viewMapBtn');
    dom.viewListBtn = id('viewListBtn');
    dom.openFiltersBtn = id('openFiltersBtn');
    dom.infoBtn = id('infoBtn');
    dom.fuelPills = id('fuelPills');
    dom.fuelAvg = id('fuelAvg');
    dom.dataTimestamp = id('dataTimestamp');

    dom.welcomeBanner = id('welcomeBanner');
    dom.welcomeGpsBtn = id('welcomeGpsBtn');
    dom.welcomeAddressForm = id('welcomeAddressForm');
    dom.welcomeAddressInput = id('welcomeAddressInput');
    dom.welcomeMessage = id('welcomeMessage');

    dom.map = id('map');
    dom.locationChip = id('locationChip');
    dom.locationChipText = id('locationChipText');
    dom.changeLocationBtn = id('changeLocationBtn');
    dom.fabFilters = id('fabFilters');

    dom.listHeadline = id('listHeadline');
    dom.listSubline = id('listSubline');
    dom.listContainer = id('listContainer');

    dom.filtersPanel = id('filtersPanel');
    dom.filtersBackdrop = id('filtersBackdrop');
    dom.closeFiltersBtn = id('closeFiltersBtn');
    dom.addressInput = id('addressInput');
    dom.gpsBtn = id('gpsBtn');
    dom.radiusRange = id('radiusRange');
    dom.radiusValue = id('radiusValue');
    dom.maxResultsRange = id('maxResultsRange');
    dom.maxResultsValue = id('maxResultsValue');
    dom.calcSection = id('calcSection');
    dom.calcInput = id('calcInput');
    dom.calcUnit = id('calcUnit');
    dom.calcResult = id('calcResult');
    dom.calcSummary = id('calcSummary');
    dom.searchBtn = id('searchBtn');

    dom.infoPanel = id('infoPanel');
    dom.closeInfoBtn = id('closeInfoBtn');
    dom.infoStationCount = id('infoStationCount');
    dom.infoTimestamp = id('infoTimestamp');
    dom.infoDataSource = id('infoDataSource');

    dom.loadingOverlay = id('loadingOverlay');
    dom.loadingText = id('loadingText');
    dom.toast = id('toast');
}

function initMap() {
    state.map = L.map('map', { zoomControl: false, preferCanvas: true })
        .setView([41.9028, 12.4964], 6); // Italia overview

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(state.map);

    L.control.zoom({ position: 'bottomright' }).addTo(state.map);
    state.markersLayer = L.layerGroup().addTo(state.map);
}

function renderFuelPills() {
    dom.fuelPills.innerHTML = FUEL_TYPES.map((fuel) => `
        <button class="fuel-pill ${fuel === state.selectedFuel ? 'is-active' : ''}" type="button" role="tab" data-fuel="${fuel}">
            <i class="fas ${FUEL_META[fuel].icon}" aria-hidden="true"></i>
            <span>${fuel}</span>
        </button>
    `).join('');
}

function bindEvents() {
    // View toggle
    dom.viewMapBtn.addEventListener('click', () => setView('map'));
    dom.viewListBtn.addEventListener('click', () => setView('list'));

    // Topbar
    dom.openFiltersBtn.addEventListener('click', () => openFilters());
    dom.infoBtn.addEventListener('click', () => {
        const isOpen = dom.infoPanel.classList.contains('is-open');
        toggleInfo(!isOpen);
    });
    dom.closeInfoBtn.addEventListener('click', () => toggleInfo(false));
    dom.infoPanel.addEventListener('click', (e) => { if (e.target === dom.infoPanel) toggleInfo(false); });

    // Fuel pills (event delegation)
    dom.fuelPills.addEventListener('click', (e) => {
        const pill = e.target.closest('.fuel-pill');
        if (!pill) return;
        state.selectedFuel = pill.dataset.fuel;
        renderFuelPills();
        updateFuelAverageLabel();
        updateCalcUi();
        if (hasLocation()) queueAutoSearch();
    });

    // Welcome banner
    dom.welcomeGpsBtn.addEventListener('click', useGps);
    dom.welcomeAddressForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const addr = dom.welcomeAddressInput.value.trim();
        if (!addr) return;
        dom.addressInput.value = addr;
        searchByAddress(addr, dom.welcomeMessage);
    });

    // Filters panel
    dom.closeFiltersBtn.addEventListener('click', closeFilters);
    dom.filtersBackdrop.addEventListener('click', closeFilters);

    dom.gpsBtn.addEventListener('click', useGps);
    dom.addressInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); handleSearch(); }
    });
    dom.addressInput.addEventListener('input', () => {
        if (!dom.addressInput.value.trim()) state.lastGpsAddress = null;
    });

    dom.radiusRange.addEventListener('input', () => {
        dom.radiusValue.textContent = `${dom.radiusRange.value} km`;
    });
    dom.radiusRange.addEventListener('change', () => {
        updateFuelAverageLabel();
        updateCalcUi();
        if (hasLocation()) queueAutoSearch();
    });

    dom.maxResultsRange.addEventListener('input', () => {
        const v = Number(dom.maxResultsRange.value);
        dom.maxResultsValue.textContent = v >= 100 ? 'Tutti' : String(v);
    });
    dom.maxResultsRange.addEventListener('change', () => {
        if (hasLocation()) queueAutoSearch();
    });

    document.querySelectorAll('input[name="calcMode"]').forEach((r) => r.addEventListener('change', updateCalcUi));
    dom.calcInput.addEventListener('input', updateCalcUi);

    dom.searchBtn.addEventListener('click', () => { handleSearch(); closeFilters(); });

    // Lista
    dom.listContainer.addEventListener('click', (e) => {
        const dirBtn = e.target.closest('[data-role="directions"]');
        if (dirBtn) {
            const station = state.results.find((s) => s.id === Number(dirBtn.dataset.id));
            if (station) openDirections(station);
            return;
        }
        const card = e.target.closest('.station-card');
        if (card) {
            const station = state.results.find((s) => s.id === Number(card.dataset.id));
            if (station) {
                setView('map');
                focusStationOnMap(station);
            }
        }
    });

    document.querySelectorAll('[data-go-map]').forEach((b) => b.addEventListener('click', () => setView('map')));
    document.querySelectorAll('[data-open-filters]').forEach((b) => b.addEventListener('click', () => openFilters()));

    // Location chip
    dom.changeLocationBtn.addEventListener('click', () => openFilters());

    // FAB filtri (mobile)
    dom.fabFilters.addEventListener('click', () => openFilters());

    // ESC chiude pannelli
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (dom.filtersPanel.classList.contains('is-open')) closeFilters();
        else if (dom.infoPanel.classList.contains('is-open')) toggleInfo(false);
    });

    // Resize -> ricalcola mappa
    window.addEventListener('resize', () => {
        if (state.map) setTimeout(() => state.map.invalidateSize(), 100);
    });
}

/* ============ STATE HELPERS ============ */
function hasLocation() {
    return Boolean(state.userLocation || dom.addressInput.value.trim());
}

function setView(view) {
    state.view = view;
    dom.body.dataset.view = view;
    dom.viewMapBtn.classList.toggle('is-active', view === 'map');
    dom.viewListBtn.classList.toggle('is-active', view === 'list');
    dom.viewMapBtn.setAttribute('aria-selected', view === 'map');
    dom.viewListBtn.setAttribute('aria-selected', view === 'list');
    if (state.map) setTimeout(() => state.map.invalidateSize(), 150);
}

function setHasLocation(yes) {
    dom.body.dataset.hasLocation = yes ? 'true' : 'false';
    dom.locationChip.hidden = !yes;
}

function openFilters() {
    dom.filtersPanel.classList.add('is-open');
    dom.filtersPanel.setAttribute('aria-hidden', 'false');
    dom.filtersBackdrop.hidden = false;
    requestAnimationFrame(() => dom.filtersBackdrop.classList.add('is-visible'));
}

function closeFilters() {
    dom.filtersPanel.classList.remove('is-open');
    dom.filtersPanel.setAttribute('aria-hidden', 'true');
    dom.filtersBackdrop.classList.remove('is-visible');
    setTimeout(() => { dom.filtersBackdrop.hidden = true; }, 200);
}

function toggleInfo(open) {
    dom.infoPanel.classList.toggle('is-open', open);
    dom.infoPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
}

function setLoading(on, text = 'Ricerca in corso…') {
    dom.loadingOverlay.hidden = !on;
    dom.loadingText.textContent = text;
}

function showToast(message, type = 'info', ms = 3000) {
    if (!message) { dom.toast.hidden = true; return; }
    dom.toast.textContent = message;
    dom.toast.className = `toast${type === 'error' ? ' is-error' : type === 'success' ? ' is-success' : ''}`;
    dom.toast.hidden = false;
    if (state.toastTimer) clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => { dom.toast.hidden = true; }, ms);
}

function setWelcomeMessage(msg, type = 'error') {
    if (!msg) { dom.welcomeMessage.hidden = true; dom.welcomeMessage.textContent = ''; return; }
    dom.welcomeMessage.textContent = msg;
    dom.welcomeMessage.hidden = false;
    dom.welcomeMessage.classList.toggle('is-info', type === 'info');
}

/* ============ DATASET INFO / AVERAGES ============ */
function updateDatasetInfo() {
    dom.dataTimestamp.textContent = (typeof DATA_TIMESTAMP !== 'undefined' && DATA_TIMESTAMP)
        ? `Aggiornati ${DATA_TIMESTAMP}` : 'Dati MIMIT';
    dom.infoTimestamp.textContent = (typeof DATA_TIMESTAMP !== 'undefined' && DATA_TIMESTAMP) || '—';
    dom.infoStationCount.textContent = Array.isArray(realFuelStations)
        ? realFuelStations.length.toLocaleString('it-IT')
        : '0';
    dom.infoDataSource.textContent = (typeof DATA_SOURCE !== 'undefined' && DATA_SOURCE) || 'MIMIT';
}

function getScopedStations() {
    const radius = Number(dom.radiusRange.value);
    const center = state.searchContext?.coordinates || state.userLocation;
    if (!center) return realFuelStations;
    return realFuelStations.filter((s) => {
        const d = haversine(center.lat, center.lng, s.latitude, s.longitude);
        return d <= radius;
    });
}

function getAveragePrice(fuel = state.selectedFuel, stations = getScopedStations()) {
    const prices = stations
        .map((s) => s?.prices?.[fuel])
        .filter((p) => Number.isFinite(p) && p > 0);
    if (prices.length === 0) return null;
    return prices.reduce((a, b) => a + b, 0) / prices.length;
}

function updateFuelAverageLabel() {
    const avg = getAveragePrice();
    const scope = (state.searchContext?.coordinates || state.userLocation)
        ? `nel raggio di ${dom.radiusRange.value} km`
        : 'media nazionale';
    dom.fuelAvg.innerHTML = avg === null
        ? `<span>${state.selectedFuel}: <strong>N/D</strong></span>`
        : `<span>${state.selectedFuel}: <strong>€${avg.toFixed(3)}/L</strong> · <em style="font-style:normal;color:var(--text-soft)">${scope}</em></span>`;
}

/* ============ CALC ============ */
function getCalcMode() {
    return document.querySelector('input[name="calcMode"]:checked')?.value || 'liters';
}

function updateCalcUi() {
    const mode = getCalcMode();
    const val = parseFloat(dom.calcInput.value) || 0;
    const avg = getAveragePrice();

    if (mode === 'liters') {
        dom.calcUnit.textContent = 'L';
        dom.calcInput.step = '0.1';
        dom.calcSummary.textContent = `${val || 0} L`;
        dom.calcResult.textContent = avg === null ? '≈ —' : `≈ €${(val * avg).toFixed(2)}`;
    } else {
        dom.calcUnit.textContent = '€';
        dom.calcInput.step = '1';
        dom.calcSummary.textContent = `€${val || 0}`;
        dom.calcResult.textContent = avg === null ? '≈ —' : `≈ ${(val / avg).toFixed(1)} L`;
    }

    if (state.results.length > 0) renderResults();
}

/* ============ GPS / GEOCODING ============ */
async function useGps() {
    if (!navigator.geolocation) {
        setWelcomeMessage('Geolocalizzazione non disponibile sul dispositivo.');
        showToast('Geolocalizzazione non disponibile', 'error');
        return;
    }
    setLoading(true, 'Rilevo la tua posizione…');
    setWelcomeMessage(null);
    try {
        const pos = await new Promise((res, rej) =>
            navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 })
        );
        state.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const address = await reverseGeocode(state.userLocation.lat, state.userLocation.lng).catch(() => null);
        if (address) {
            dom.addressInput.value = address;
            state.lastGpsAddress = address;
        }
        commitLocation(address || 'Posizione GPS attiva');
        await runSearch();
    } catch (err) {
        const msg = err?.code === 1 ? 'Permesso negato.' : err?.code === 3 ? 'Timeout.' : 'Posizione non disponibile.';
        setWelcomeMessage(msg);
        showToast(msg, 'error');
    } finally {
        setLoading(false);
    }
}

async function searchByAddress(address, msgTarget) {
    setLoading(true, 'Cerco l\'indirizzo…');
    try {
        const coords = await geocodeAddress(address);
        state.userLocation = coords;
        state.lastGpsAddress = null;
        if (msgTarget) setWelcomeMessage(null);
        commitLocation(address);
        await runSearch();
    } catch {
        const msg = 'Indirizzo non trovato. Riprova.';
        if (msgTarget) setWelcomeMessage(msg);
        showToast(msg, 'error');
    } finally {
        setLoading(false);
    }
}

function commitLocation(label) {
    setHasLocation(true);
    dom.locationChipText.textContent = label;
}

async function geocodeAddress(address) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address + ', Italy')}&limit=1`;
    const r = await fetch(url);
    const data = await r.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('not found');
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

async function reverseGeocode(lat, lng) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const r = await fetch(url);
    const data = await r.json();
    if (!data?.display_name) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const a = data.address || {};
    const parts = [];
    if (a.road) parts.push(a.road + (a.house_number ? ' ' + a.house_number : ''));
    if (a.city || a.town || a.village) parts.push(a.city || a.town || a.village);
    if (a.province) parts.push(a.province);
    return parts.join(', ') || data.display_name.split(',').slice(0, 3).join(',');
}

/* ============ SEARCH ============ */
function queueAutoSearch() {
    if (state.autoSearchTimer) clearTimeout(state.autoSearchTimer);
    state.autoSearchTimer = setTimeout(() => { state.autoSearchTimer = null; runSearch({ auto: true }); }, 350);
}

async function handleSearch() {
    const addr = dom.addressInput.value.trim();
    if (!state.userLocation && !addr) {
        showToast('Inserisci un indirizzo o usa il GPS', 'error');
        openFilters();
        return;
    }
    setLoading(true, 'Cerco distributori…');
    try {
        if (addr && addr !== state.lastGpsAddress) {
            const coords = await geocodeAddress(addr);
            state.userLocation = coords;
            state.lastGpsAddress = null;
            commitLocation(addr);
        } else if (state.userLocation && !dom.locationChip.hidden) {
            // ok
        } else if (state.userLocation) {
            commitLocation(addr || 'Posizione GPS attiva');
        }
        await runSearch();
    } catch {
        showToast('Indirizzo non trovato', 'error');
    } finally {
        setLoading(false);
    }
}

async function runSearch({ auto = false } = {}) {
    if (!state.userLocation) return;

    const radius = Number(dom.radiusRange.value);
    const maxResults = Number(dom.maxResultsRange.value);
    state.searchContext = { coordinates: state.userLocation, radius };

    const stations = findStations(state.userLocation, radius, state.selectedFuel);
    state.results = maxResults >= 100 ? stations : stations.slice(0, maxResults);

    updateFuelAverageLabel();
    updateCalcUi();
    renderMarkers();
    renderResults();

    if (state.results.length === 0) {
        showToast(`Nessun distributore con ${state.selectedFuel} entro ${radius} km`, 'info');
    } else if (auto) {
        // silenzioso
    } else {
        showToast(`${state.results.length} distributori trovati`, 'success', 1800);
    }
}

function findStations(center, radius, fuel) {
    return realFuelStations
        .filter((s) => {
            const d = haversine(center.lat, center.lng, s.latitude, s.longitude);
            return d <= radius && Number.isFinite(s?.prices?.[fuel]);
        })
        .map((s) => ({
            id: s.id,
            name: s.name,
            brand: s.brand,
            address: s.address,
            lat: s.latitude,
            lng: s.longitude,
            fuel,
            price: parseFloat(s.prices[fuel].toFixed(3)),
            distance: haversine(center.lat, center.lng, s.latitude, s.longitude)
        }))
        .sort((a, b) => a.price - b.price);
}

/* ============ RENDER ============ */
function renderResults() {
    if (state.results.length === 0) {
        dom.listHeadline.textContent = 'Nessun risultato';
        dom.listSubline.textContent = state.userLocation
            ? `Nessun distributore con ${state.selectedFuel} nel raggio scelto`
            : 'Imposta una posizione per iniziare';
        dom.listContainer.innerHTML = `
            <div class="list-empty">
                <i class="fas fa-magnifying-glass"></i>
                <p>${state.userLocation ? 'Prova ad aumentare il raggio di ricerca.' : 'Usa il GPS o inserisci un indirizzo.'}</p>
            </div>`;
        return;
    }

    const withCosts = computeCosts(state.results);
    const bestPrice = Math.min(...withCosts.map((s) => s.price));

    dom.listHeadline.textContent = `${withCosts.length} distributori`;
    dom.listSubline.textContent = `${state.selectedFuel} · ${dom.radiusRange.value} km`;

    dom.listContainer.innerHTML = withCosts.map((s) => {
        const isBest = Math.abs(s.price - bestPrice) < 0.001;
        return `
            <article class="station-card ${isBest ? 'best' : ''}" data-id="${s.id}">
                <div>
                    <span class="station-name">${esc(s.name)}</span>
                    <span class="station-brand">${esc(s.brand || 'Indipendente')}</span>
                    <div class="station-address">${esc(s.address)}</div>
                    <div class="station-meta">
                        <span class="meta-chip"><i class="fas fa-route"></i> ${s.distance.toFixed(1)} km</span>
                        <span class="meta-chip"><i class="fas fa-gas-pump"></i> ${esc(s.fuel)}</span>
                        ${isBest ? '<span class="meta-chip best"><i class="fas fa-award"></i> Migliore</span>' : ''}
                    </div>
                </div>
                <div class="station-side">
                    <div class="price-tag">
                        <strong>€${s.price.toFixed(3)}</strong>
                        <span>al litro</span>
                    </div>
                    ${s.costInfo ? `<div class="cost-chip ${s.costInfo.isBest ? 'best' : ''}">${s.costInfo.display}</div>` : ''}
                    <button class="directions-btn" type="button" data-role="directions" data-id="${s.id}">
                        <i class="fas fa-diamond-turn-right"></i> Indicazioni
                    </button>
                </div>
            </article>`;
    }).join('');
}

function computeCosts(stations) {
    const mode = getCalcMode();
    const v = parseFloat(dom.calcInput.value) || 0;
    if (v <= 0) return stations.map((s) => ({ ...s, costInfo: null }));
    const best = Math.min(...stations.map((s) => s.price));
    return stations.map((s) => {
        const isBest = Math.abs(s.price - best) < 0.001;
        if (mode === 'liters') {
            const tot = s.price * v;
            const extra = Math.max(0, (s.price - best) * v);
            return { ...s, costInfo: { isBest, display: isBest ? `€${tot.toFixed(2)}` : `+€${extra.toFixed(2)}` } };
        }
        const liters = v / s.price;
        const bestLiters = v / best;
        const less = Math.max(0, bestLiters - liters);
        return { ...s, costInfo: { isBest, display: isBest ? `${liters.toFixed(1)} L` : `-${less.toFixed(1)} L` } };
    });
}

function renderMarkers() {
    state.markersLayer.clearLayers();

    if (state.userLocation) {
        const userIcon = L.divIcon({
            className: 'user-location-icon',
            html: '<div class="user-pin"></div>',
            iconSize: [18, 18],
            iconAnchor: [9, 9]
        });
        L.marker([state.userLocation.lat, state.userLocation.lng], { icon: userIcon })
            .bindPopup('<div class="popup-card"><strong>La tua posizione</strong></div>')
            .addTo(state.markersLayer);
    }

    if (state.results.length === 0) {
        if (state.userLocation) state.map.setView([state.userLocation.lat, state.userLocation.lng], 13);
        return;
    }

    const best = Math.min(...state.results.map((s) => s.price));
    const bounds = [];

    state.results.forEach((s) => {
        const isBest = Math.abs(s.price - best) < 0.001;
        const icon = L.divIcon({
            className: 'station-location-icon',
            html: `<div class="station-pin ${isBest ? 'best' : ''}"></div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9]
        });
        const marker = L.marker([s.lat, s.lng], { icon, zIndexOffset: isBest ? 1000 : 0 })
            .bindPopup(`
                <div class="popup-card">
                    <strong>${esc(s.name)}</strong>
                    <span>${esc(s.brand || 'Indipendente')}</span>
                    <span class="popup-price">€${s.price.toFixed(3)}/L</span>
                    <span>${s.distance.toFixed(1)} km</span>
                    ${isBest ? '<span class="popup-best">Miglior prezzo</span>' : ''}
                </div>
            `)
            .addTo(state.markersLayer);
        marker.stationId = s.id;
        bounds.push([s.lat, s.lng]);
    });

    if (state.userLocation) bounds.push([state.userLocation.lat, state.userLocation.lng]);
    if (bounds.length > 0) state.map.fitBounds(bounds, { padding: [48, 48] });
}

function focusStationOnMap(station) {
    state.map.setView([station.lat, station.lng], 16);
    state.markersLayer.eachLayer((layer) => {
        if (layer.stationId === station.id) layer.openPopup();
    });
}

function openDirections(s) {
    const addr = dom.addressInput.value.trim();
    let origin = '';
    if (addr) origin = encodeURIComponent(addr);
    else if (state.userLocation) origin = `${state.userLocation.lat},${state.userLocation.lng}`;

    const dest = `${s.lat},${s.lng}`;
    const url = origin
        ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`
        : `https://www.google.com/maps/search/?api=1&query=${dest}`;
    window.open(url, '_blank', 'noopener');
}

/* ============ UTILS ============ */
function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function esc(v) {
    return String(v ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
