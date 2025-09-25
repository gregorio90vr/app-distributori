/* =========================================
   FUELFINDER - MODERN JAVASCRIPT
   Complete rewrite for new interface
   ========================================= */

// App State
let currentTab = 'map';
let currentResults = [];
let userLocation = null;
let map = null;
let dataTimestamp = null;
let activePanel = null;
let lastGpsAddress = null; // Traccia l'ultimo indirizzo impostato dal GPS

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeNewApp();
});

function initializeNewApp() {
    console.log('🚀 Initializing FuelFinder Modern Interface');
    
    // Debug: Check if key elements exist
    const keyElements = [
        'locationBtn-new', 'filtersBtn-new', 'calcBtn-new', 'infoBtn-new',
        'searchBtn-new', 'tabMap-new', 'tabList-new'
    ];
    
    const keyPanels = [
        'locationPanel-new', 'filtersPanel-new', 'calcPanel-new', 'infoPanel-new'
    ];
    
    console.log('🔍 Checking control elements...');
    keyElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            console.log('✅ Found element:', id);
        } else {
            console.error('❌ Missing element:', id);
        }
    });
    
    console.log('🔍 Checking panel elements...');
    keyPanels.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            console.log('✅ Found panel:', id);
        } else {
            console.error('❌ Missing panel:', id);
        }
    });
    
    // Bind all event listeners
    bindNewEventListeners();
    
    // Initialize map
    initializeNewMap();
    
    // Load timestamp
    updateNewDataTimestamp().catch(console.error);
    
    // Initialize slider
    initializeSlider();
    
    // Initialize calculator preview
    updateCalcPreviewNew();
    
    console.log('✅ FuelFinder Modern Interface Ready');
}

function bindNewEventListeners() {
    console.log('🔗 Binding event listeners...');
    
    // Search button
    const searchBtn = document.getElementById('searchBtn-new');
    if (searchBtn) {
        searchBtn.addEventListener('click', handleNewSearch);
        console.log('✅ Search button bound');
    } else {
        console.error('❌ Search button not found');
    }
    
    // GPS button
    const gpsBtn = document.getElementById('gpsBtn-new');
    if (gpsBtn) {
        gpsBtn.addEventListener('click', getCurrentLocationNew);
        console.log('✅ GPS button bound');
    }
    
    // View tabs
    const tabMap = document.getElementById('tabMap-new');
    const tabList = document.getElementById('tabList-new');
    if (tabMap && tabList) {
        tabMap.addEventListener('click', () => switchTabNew('map'));
        tabList.addEventListener('click', () => switchTabNew('list'));
        console.log('✅ View tabs bound');
    } else {
        console.error('❌ View tabs not found');
    }
    
    // Panel controls
    const locationBtn = document.getElementById('locationBtn-new');
    const filtersBtn = document.getElementById('filtersBtn-new');
    const calcBtn = document.getElementById('calcBtn-new');
    const infoBtn = document.getElementById('infoBtn-new');
    
    if (locationBtn) {
        locationBtn.addEventListener('click', () => {
            console.log('📍 Location button clicked');
            togglePanelNew('location');
        });
        console.log('✅ Location button bound');
    } else {
        console.error('❌ Location button not found');
    }
    
    if (filtersBtn) {
        filtersBtn.addEventListener('click', () => {
            console.log('🔍 Filters button clicked');
            togglePanelNew('filters');
        });
        console.log('✅ Filters button bound');
    } else {
        console.error('❌ Filters button not found');
    }
    
    if (calcBtn) {
        calcBtn.addEventListener('click', () => {
            console.log('🧮 Calc button clicked');
            togglePanelNew('calc');
        });
        console.log('✅ Calc button bound');
    } else {
        console.error('❌ Calc button not found');
    }
    
    if (infoBtn) {
        infoBtn.addEventListener('click', () => {
            console.log('ℹ️ Info button clicked');
            togglePanelNew('info');
        });
        console.log('✅ Info button bound');
    } else {
        console.error('❌ Info button not found');
    }
    
    // Panel close buttons - Using event delegation for better reliability
    document.addEventListener('click', (e) => {
        // Check if clicked element is a close button or inside one
        const closeBtn = e.target.closest('.panel-close-new');
        if (closeBtn) {
            e.preventDefault();
            e.stopPropagation();
            const panel = closeBtn.dataset.panel;
            console.log('❌ Close button clicked for panel:', panel);
            if (panel) {
                togglePanelNew(panel, false);
            }
        }
    });
    
    // Address input
    document.getElementById('address-new').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleNewSearch();
        }
    });
    
    // Calculator mode change
    document.querySelectorAll('input[name="calcMode-new"]').forEach(radio => {
        radio.addEventListener('change', () => {
            handleCalcModeChangeNew();
            markSearchOutdatedNew(); // Mark search as outdated when calc mode changes
        });
    });
    
    // Input changes to mark search as outdated
    const calcValueInput = document.getElementById('calcValue-new');
    const fuelTypeSelect = document.getElementById('fuelType-new');
    const radiusSelect = document.getElementById('radius-new');
    const addressInput = document.getElementById('address-new');
    const maxStationsSlider = document.getElementById('maxStations-new');
    
    if (calcValueInput) {
        calcValueInput.addEventListener('input', markSearchOutdatedNew);
        calcValueInput.addEventListener('input', updateCalcPreviewNew);
    }
    if (fuelTypeSelect) fuelTypeSelect.addEventListener('change', markSearchOutdatedNew);
    if (radiusSelect) radiusSelect.addEventListener('change', markSearchOutdatedNew);
    if (maxStationsSlider) maxStationsSlider.addEventListener('input', markSearchOutdatedNew);
    
    if (addressInput) {
        // Multiple events for address input to catch all changes
        addressInput.addEventListener('input', () => {
            markSearchOutdatedNew();
            handleAddressChange();
        });
        addressInput.addEventListener('change', () => {
            markSearchOutdatedNew();
            handleAddressChange();
        });
        addressInput.addEventListener('paste', () => {
            setTimeout(() => {
                markSearchOutdatedNew();
                handleAddressChange();
            }, 100); // Delay to let paste complete
        });
        addressInput.addEventListener('keyup', () => {
            markSearchOutdatedNew();
            handleAddressChange();
        });
    }
    
    // Close panels when clicking outside
    document.addEventListener('click', (e) => {
        if (activePanel && !e.target.closest('.slide-panel-new') && !e.target.closest('.control-item-new')) {
            togglePanelNew(activePanel, false);
        }
    });
}

function handleAddressChange() {
    const addressInput = document.getElementById('address-new');
    const currentAddress = addressInput.value.trim();
    
    // Se l'utente cancella completamente l'indirizzo, reset GPS tracking
    if (!currentAddress) {
        lastGpsAddress = null;
        console.log('🔄 Address cleared - GPS tracking reset');
    }
    // Se l'indirizzo è diverso da quello GPS, significa modifica manuale
    else if (lastGpsAddress && currentAddress !== lastGpsAddress) {
        console.log('✏️ Manual address modification detected:', currentAddress);
    }
}

function initializeNewMap() {
    try {
        map = L.map('map-new', {
            zoomControl: false
        }).setView([45.4642, 9.1900], 13); // Default to Milan
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
        
        // Add zoom control in bottom right
        L.control.zoom({
            position: 'bottomright'
        }).addTo(map);
        
        console.log('🗺️ Map initialized successfully');
    } catch (error) {
        console.error('❌ Error initializing map:', error);
    }
}

function switchTabNew(tab) {
    currentTab = tab;
    
    // Update tab buttons
    const mapTab = document.getElementById('tabMap-new');
    const listTab = document.getElementById('tabList-new');
    
    mapTab.classList.toggle('active', tab === 'map');
    listTab.classList.toggle('active', tab === 'list');
    
    // Update content visibility
    const mapContent = document.getElementById('mapContent-new');
    const listContent = document.getElementById('listContent-new');
    
    mapContent.classList.toggle('active', tab === 'map');
    listContent.classList.toggle('active', tab === 'list');
    
    // Refresh map if switching to map tab
    if (tab === 'map' && map) {
        setTimeout(() => {
            map.invalidateSize();
            if (currentResults.length > 0) {
                updateMapMarkersNew(currentResults);
            }
        }, 300);
    }
    
    console.log('🔄 Switched to', tab, 'view');
}

function togglePanelNew(panelName, show = null) {
    console.log('🔄 Toggling panel:', panelName);
    
    const panelId = panelName + 'Panel-new';
    const panel = document.getElementById(panelId);
    
    if (!panel) {
        console.error('❌ Panel not found:', panelId);
        return;
    }
    
    const isCurrentlyActive = panel.classList.contains('active');
    console.log('📋 Panel current state:', isCurrentlyActive ? 'active' : 'inactive');
    
    // Close all panels first
    document.querySelectorAll('.slide-panel-new').forEach(p => {
        p.classList.remove('active');
    });
    
    // Update control buttons
    document.querySelectorAll('.control-item-new').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (show === false || isCurrentlyActive) {
        activePanel = null;
        console.log('🔄 Panel closed');
        return;
    }
    
    // Open the requested panel
    panel.classList.add('active');
    console.log('✅ Panel opened:', panelName);
    
    // Highlight the control button
    const controlBtnId = panelName + 'Btn-new';
    const controlBtn = document.getElementById(controlBtnId);
    if (controlBtn) {
        controlBtn.classList.add('active');
        console.log('✅ Control button highlighted:', controlBtnId);
    } else {
        console.error('❌ Control button not found:', controlBtnId);
    }
    
    activePanel = panelName;
}

function handleNewSearch() {
    console.log('🔍 Starting new search...');
    
    // Reset search state immediately
    hideSearchOutdatedNew();
    
    // Ottieni l'indirizzo prima di usarlo
    const address = document.getElementById('address-new').value.trim();
    
    // Determina il tipo di ricerca per il messaggio di loading
    const isUsingGPS = !address || address === lastGpsAddress;
    if (isUsingGPS && userLocation) {
        showLoadingNew(true, 'Ricerca distributori...', 'Sto cercando i distributori vicino alla tua posizione GPS');
    } else if (address) {
        showLoadingNew(true, 'Ricerca distributori...', `Sto cercando i distributori vicino a ${address}`);
    } else {
        showLoadingNew(true, 'Ricerca distributori...', 'Sto cercando i distributori migliori per te');
    }
    const fuelType = document.getElementById('fuelType-new').value;
    const radius = parseInt(document.getElementById('radius-new').value);
    const maxStations = parseInt(document.getElementById('maxStations-new').value);
    
    // Debug info
    console.log('🔍 Search parameters:', {
        address: address,
        lastGpsAddress: lastGpsAddress,
        userLocation: userLocation,
        isManuallyModified: address !== lastGpsAddress
    });
    
    // Close any open panels
    if (activePanel) {
        togglePanelNew(activePanel, false);
    }
    
    // Use actual search logic
    performActualSearch(address, fuelType, radius, maxStations)
        .then(() => {
            showLoadingNew(false);
            console.log('✅ Search completed successfully');
        })
        .catch((error) => {
            console.error('❌ Search failed:', error);
            showLoadingNew(false);
        });
}

async function performActualSearch(address, fuelType, radius, maxStations) {
    try {
        let coordinates = null;
        
        // Controlla se l'indirizzo è stato modificato manualmente
        const isManualAddress = address && address.trim() && address !== lastGpsAddress;
        
        if (isManualAddress) {
            // PRIORITÀ 1: Indirizzo modificato manualmente - geocodifica sempre
            console.log('🔍 Geocoding manually entered address:', address);
            coordinates = await geocodeAddressNew(address);
            // Aggiorna userLocation con le nuove coordinate
            userLocation = coordinates;
            // Reset GPS address tracking since user overrode it
            lastGpsAddress = null;
        } 
        else if (address && address.trim()) {
            // L'indirizzo è uguale a quello del GPS, usa le coordinate GPS salvate
            console.log('📍 Using GPS coordinates for GPS address:', address);
            console.log('📍 Current userLocation:', userLocation);
            
            if (userLocation && userLocation.lat && userLocation.lng) {
                coordinates = userLocation;
            } else {
                // Se non abbiamo coordinate GPS valide, geocodifica l'indirizzo
                console.log('⚠️ No valid GPS coordinates, geocoding address:', address);
                coordinates = await geocodeAddressNew(address);
                userLocation = coordinates;
            }
        }
        else if (userLocation) {
            // Nessun indirizzo ma abbiamo coordinate GPS
            console.log('📍 Using saved GPS location (no address):', userLocation);
            coordinates = userLocation;
        }
        
        // Debug finale delle coordinate
        console.log('🧪 Final coordinates check:', {
            coordinates: coordinates,
            userLocation: userLocation,
            address: address,
            lastGpsAddress: lastGpsAddress,
            isManualAddress: isManualAddress
        });

        if (!coordinates || !coordinates.lat || !coordinates.lng) {
            console.error('❌ Invalid coordinates for search');
            showEmptyStateNew('map', 'Impossibile determinare la posizione. Verifica l\'indirizzo o prova con il GPS.');
            showEmptyStateNew('list', 'Impossibile determinare la posizione. Verifica l\'indirizzo o prova con il GPS.');
            return;
        }
        
        // Aggiorna la mappa alla nuova posizione (GPS o geocodificata)
        if (map) {
            map.setView([coordinates.lat, coordinates.lng], 13);
            console.log('🗺️ Map updated to new position:', coordinates);
        }
        
        console.log('🔍 Searching fuel stations near:', coordinates);
        
        // Cerca le stazioni di servizio usando i dati reali
        const results = await searchFuelStationsNew(coordinates, radius, fuelType);
        
        if (results.length === 0) {
            showEmptyStateNew('map', `Nessun distributore con ${fuelType} trovato entro ${radius}km`);
            showEmptyStateNew('list', `Nessun distributore con ${fuelType} trovato entro ${radius}km`);
            currentResults = [];
        } else {
            // Applica il limite massimo stazioni
            const limitedResults = maxStations === 100 ? results : results.slice(0, maxStations);
            currentResults = limitedResults;
            
            showResultsNew(limitedResults);
            hideEmptyStateNew('map');
            hideEmptyStateNew('list');
            
            console.log('✅ Search completed with', limitedResults.length, 'results');
        }
        
    } catch (error) {
        console.error('❌ Search error:', error);
        showEmptyStateNew('map', 'Errore durante la ricerca: ' + error.message);
        showEmptyStateNew('list', 'Errore durante la ricerca: ' + error.message);
    }
}

function calculateCostsNew(stations) {
    const calcMode = document.querySelector('input[name="calcMode-new"]:checked').value;
    const calcValue = parseFloat(document.getElementById('calcValue-new').value) || 0;
    
    if (calcValue <= 0 || stations.length === 0) {
        return stations.map(station => ({...station, costInfo: null}));
    }
    
    // Trova il prezzo migliore per il confronto
    const prices = stations.map(s => s.price).filter(p => p > 0);
    if (prices.length === 0) {
        return stations.map(station => ({...station, costInfo: null}));
    }
    
    const bestPrice = Math.min(...prices);
    
    return stations.map(station => {
        const price = station.price;
        const isBest = Math.abs(price - bestPrice) < 0.001;
        let costInfo = null;
        
        if (price > 0) {
            if (calcMode === 'liters') {
                // Calcola il costo per i litri specificati
                const totalCost = parseFloat((price * calcValue).toFixed(2));
                const extraCost = parseFloat(((price - bestPrice) * calcValue).toFixed(2));
                
                costInfo = {
                    mode: 'liters',
                    liters: calcValue,
                    totalCost: totalCost,
                    extraCost: extraCost,
                    isBest: isBest,
                    display: isBest ? `€${totalCost.toFixed(2)}` : `+€${extraCost.toFixed(2)}`,
                    label: isBest ? `Miglior prezzo (${calcValue}L)` : `Extra costo (${calcValue}L)`
                };
            } else {
                // Calcola i litri per il budget specificato
                const litersObtained = parseFloat((calcValue / price).toFixed(2));
                const bestLiters = parseFloat((calcValue / bestPrice).toFixed(2));
                const lessLiters = parseFloat((bestLiters - litersObtained).toFixed(2));
                
                costInfo = {
                    mode: 'budget',
                    budget: calcValue,
                    litersObtained: litersObtained,
                    lessLiters: lessLiters,
                    isBest: isBest,
                    display: isBest ? `${litersObtained.toFixed(1)}L` : `-${lessLiters.toFixed(1)}L`,
                    label: isBest ? `Più litri (€${calcValue})` : `Meno litri (€${calcValue})`
                };
            }
        }
        
        return {
            ...station,
            costInfo: costInfo
        };
    });
}

function updateCalcPreviewNew() {
    const calcMode = document.querySelector('input[name="calcMode-new"]:checked').value;
    const calcValue = parseFloat(document.getElementById('calcValue-new').value);
    const previewLabel = document.getElementById('previewLabel-new');
    const previewValue = document.getElementById('previewValue-new');
    const avgPrice = document.getElementById('avgPrice-new');
    
    if (!previewLabel || !previewValue || !avgPrice) return;
    
    const estimatedPrice = 1.65; // Prezzo medio stimato
    avgPrice.textContent = `€${estimatedPrice.toFixed(3)}/L`;
    
    if (!calcValue || calcValue <= 0) {
        previewLabel.textContent = 'Inserisci un valore';
        previewValue.textContent = '...';
        return;
    }
    
    if (calcMode === 'liters') {
        const estimatedCost = calcValue * estimatedPrice;
        previewLabel.textContent = `Costo stimato (${calcValue}L):`;
        previewValue.textContent = `€${estimatedCost.toFixed(2)}`;
    } else {
        const estimatedLiters = calcValue / estimatedPrice;
        previewLabel.textContent = `Litri stimati (€${calcValue}):`;
        previewValue.textContent = `${estimatedLiters.toFixed(1)}L`;
    }
}

function showResultsNew(stations) {
    // Applica i calcoli dei costi
    const stationsWithCosts = calculateCostsNew(stations);
    
    // Update map
    if (currentTab === 'map' && map) {
        updateMapMarkersNew(stationsWithCosts);
    }
    
    // Update list
    updateStationsListNew(stationsWithCosts);
}

function updateMapMarkersNew(stations) {
    // Clear existing markers
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
            map.removeLayer(layer);
        }
    });
    
    if (stations.length === 0) return;
    
    const cheapestPrice = Math.min(...stations.map(s => s.price));
    
    // Add user location marker if available
    if (userLocation) {
        const userIcon = L.divIcon({
            html: '<i class="fas fa-user-circle" style="color: #007AFF; font-size: 26px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));"></i>',
            iconSize: [32, 32],
            className: 'user-location-marker-new'
        });
        
        L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
            .addTo(map)
            .bindPopup(`
                <div style="font-family: Inter, sans-serif; text-align: center; min-width: 120px;">
                    <div style="font-weight: 700; color: #007AFF; margin-bottom: 4px;">
                        <i class="fas fa-map-marker-alt"></i> La tua posizione
                    </div>
                    <div style="font-size: 12px; color: #666;">
                        Stai cercando distributori da qui
                    </div>
                </div>
            `);
    }
    
    // Add station markers with improved styling
    stations.forEach(station => {
        const isCheapest = Math.abs(station.price - cheapestPrice) < 0.001;
        const color = isCheapest ? '#00C853' : '#007AFF'; // Verde per il più economico, blu per gli altri
        const icon = isCheapest ? '🏆' : '⛽';
        
        const stationIcon = L.divIcon({
            html: `
                <div style="
                    background: ${color}; 
                    color: white; 
                    border-radius: 50%; 
                    width: 36px; 
                    height: 36px; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    font-size: 18px; 
                    border: 3px solid white; 
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                    font-weight: bold;
                    ${isCheapest ? 'animation: pulse-green 2s ease-in-out infinite;' : ''}
                ">
                    ${icon}
                </div>
            `,
            iconSize: [36, 36],
            className: 'station-marker-new'
        });
        
        // Build detailed popup content
        let costInfoHtml = '';
        if (station.costInfo && station.costInfo.display) {
            const costColor = station.costInfo.isBest ? '#00C853' : '#FF9500';
            const costBg = station.costInfo.isBest ? 'rgba(0,200,83,0.1)' : 'rgba(255,149,0,0.1)';
            const costBorder = station.costInfo.isBest ? 'rgba(0,200,83,0.3)' : 'rgba(255,149,0,0.3)';
            
            costInfoHtml = `
                <div style="
                    margin: 12px 0; 
                    padding: 10px; 
                    background: ${costBg}; 
                    border: 1px solid ${costBorder}; 
                    border-radius: 8px;
                ">
                    <div style="font-size: 12px; color: #666; margin-bottom: 4px; font-weight: 500;">
                        ${station.costInfo.label}
                    </div>
                    <div style="font-weight: bold; color: ${costColor}; font-size: 16px;">
                        ${station.costInfo.display}
                    </div>
                </div>
            `;
        }
        
        const popupContent = `
            <div style="font-family: Inter, sans-serif; min-width: 240px;">
                <div style="margin-bottom: 8px;">
                    <div style="font-weight: 700; font-size: 16px; color: #1D1D1F; margin-bottom: 2px;">
                        ${station.name}
                    </div>
                    <div style="font-size: 12px; color: #007AFF; font-weight: 600;">
                        ${station.brand || 'Indipendente'}
                    </div>
                </div>
                
                <div style="display: flex; align-items: center; gap: 12px; margin: 12px 0;">
                    <span style="
                        background: ${color}; 
                        color: white; 
                        padding: 6px 12px; 
                        border-radius: 12px; 
                        font-weight: bold; 
                        font-size: 14px;
                    ">
                        €${station.price.toFixed(3)}/L
                    </span>
                    <span style="
                        color: #666; 
                        font-size: 13px; 
                        display: flex; 
                        align-items: center; 
                        gap: 4px;
                    ">
                        <i class="fas fa-route"></i> ${station.distance.toFixed(1)} km
                    </span>
                </div>
                
                ${costInfoHtml}
                
                <div style="
                    color: #666; 
                    font-size: 13px; 
                    line-height: 1.4; 
                    padding: 8px 0; 
                    border-top: 1px solid #f0f0f0;
                ">
                    <i class="fas fa-map-marker-alt" style="color: #007AFF; margin-right: 4px;"></i>
                    ${station.address}
                </div>
                
                ${isCheapest ? `
                    <div style="
                        color: #00C853; 
                        font-weight: bold; 
                        margin-top: 8px; 
                        text-align: center;
                        padding: 6px;
                        background: rgba(0,200,83,0.1);
                        border-radius: 6px;
                    ">
                        🏆 Prezzo più conveniente!
                    </div>
                ` : ''}
            </div>
        `;
        
        L.marker([station.lat, station.lng], { icon: stationIcon })
            .addTo(map)
            .bindPopup(popupContent);
    });
    
    // Fit map bounds to show all markers
    const group = new L.featureGroup(
        stations.map(station => L.marker([station.lat, station.lng]))
    );
    
    if (userLocation) {
        group.addLayer(L.marker([userLocation.lat, userLocation.lng]));
    }
    
    map.fitBounds(group.getBounds().pad(0.1));
}

function updateStationsListNew(stations) {
    const container = document.getElementById('stationsList-new');
    container.innerHTML = '';
    
    stations.forEach(station => {
        const card = createStationCardNew(station);
        container.appendChild(card);
    });
}

function openDirections(stationLat, stationLng, stationAddress) {
    // Ottieni l'indirizzo di partenza dall'input utente
    const userAddress = document.getElementById('address-new').value.trim();
    
    let origin = '';
    let originDescription = '';
    
    if (userAddress) {
        // Usa l'indirizzo inserito dall'utente
        origin = encodeURIComponent(userAddress);
        originDescription = userAddress;
    } else if (userLocation) {
        // Se non c'è indirizzo ma abbiamo coordinate GPS, usale
        origin = `${userLocation.lat},${userLocation.lng}`;
        originDescription = 'la tua posizione GPS';
    } else {
        // Nessuna posizione disponibile - offri alternativa
        const useCurrentLocation = confirm(
            'Per ottenere le indicazioni stradali:\n\n' +
            '✓ Inserisci un indirizzo di partenza nel campo ricerca\n' +
            '✓ Oppure attiva il GPS\n\n' +
            'Vuoi comunque aprire Google Maps per inserire manualmente la partenza?'
        );
        
        if (useCurrentLocation) {
            // Apri Google Maps solo con la destinazione
            const destination = `${stationLat},${stationLng}`;
            const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${destination}`;
            window.open(googleMapsUrl, '_blank');
        }
        return;
    }
    
    // Coordinate di destinazione del distributore
    const destination = `${stationLat},${stationLng}`;
    
    // Crea l'URL per Google Maps con indicazioni
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
    
    console.log(`🗺️ Opening directions from "${originDescription}" to station at ${stationLat},${stationLng}`);
    
    // Feedback visivo all'utente
    const button = event.target.closest('.directions-btn-new');
    if (button) {
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-external-link-alt"></i> <span>Apertura...</span>';
        button.style.background = '#34C759';
        
        setTimeout(() => {
            button.innerHTML = originalText;
            button.style.background = '';
        }, 2000);
    }
    
    // Apri Google Maps in una nuova finestra/tab
    // Su mobile, prova prima l'app nativa di Google Maps
    if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        // URL per l'app nativa di Google Maps
        const nativeUrl = `googlemaps://maps.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
        
        // Prova prima l'app nativa, poi fallback al web
        window.location.href = nativeUrl;
        
        // Fallback al web dopo un breve delay
        setTimeout(() => {
            window.open(googleMapsUrl, '_blank');
        }, 1000);
    } else {
        // Desktop: apri direttamente nel browser
        window.open(googleMapsUrl, '_blank');
    }
}

function createStationCardNew(station) {
    const card = document.createElement('div');
    
    // Determina se questa è la stazione più economica
    const isLowestPrice = currentResults.length > 0 && 
                         Math.abs(station.price - Math.min(...currentResults.map(s => s.price))) < 0.001;
    
    // Determina se è più costoso della media (per "extra costo")
    const averagePrice = currentResults.length > 0 ? 
        currentResults.reduce((sum, s) => sum + s.price, 0) / currentResults.length : 0;
    const isExpensive = station.price > averagePrice * 1.05; // 5% sopra la media
    
    card.className = isLowestPrice ? 'station-card-new best-price-new' : 'station-card-new';
    
    // Icona per la stazione (benzina)
    const stationIcon = isLowestPrice ? 'fas fa-crown' : 'fas fa-gas-pump';
    
    // Extra costo solo se è significativamente più costoso
    const extraCostHtml = isExpensive && !isLowestPrice ? 
        `<div class="extra-cost-new">
            <i class="fas fa-exclamation-triangle"></i>
            Extra costo
        </div>` : '';
    
    // Struttura basata sul tuo schizzo: ICONA | INFO CENTRALE | DESTRA (prezzo, distanza, indicazioni)
    card.innerHTML = `
        <!-- Icona sinistra -->
        <div class="station-icon-new">
            <i class="${stationIcon}"></i>
        </div>
        
        <!-- Sezione centrale - Info distributore -->
        <div class="station-info-new">
            <div class="station-name-new">${station.name}</div>
            <div class="station-brand-new">${station.brand || 'Indipendente'}</div>
            ${extraCostHtml}
            <div class="station-address-new">
                <i class="fas fa-map-marker-alt"></i> ${station.address}
            </div>
        </div>
        
        <!-- Sezione destra - Layout 2x2 regolare -->
        <div class="station-right-new">
            <!-- Prima riga -->
            <div class="distance-badge-new">
                <i class="fas fa-route"></i> ${station.distance.toFixed(1)} km
            </div>
            <div class="price-badge-new">€${station.price}/L</div>
            
            <!-- Seconda riga -->
            <button class="directions-btn-new" 
                    title="Apri Google Maps per le indicazioni stradali"
                    onclick="openDirections('${station.lat}', '${station.lng}', '${station.address.replace(/'/g, "\\'")}'); event.stopPropagation();">
                <i class="fas fa-directions"></i>
                <span>Indicazioni</span>
            </button>
            ${(() => {
                // Se ci sono informazioni sui costi calcolati, mostra quelle
                if (station.costInfo) {
                    return `<div class="cost-info-badge-new ${station.costInfo.isBest ? 'cost-best' : 'cost-extra'}" 
                                onclick="showCostTooltip(this, '${station.costInfo.isBest ? 'Costo totale migliore per il tuo viaggio' : 'Costo aggiuntivo rispetto al migliore'}'); event.stopPropagation();"
                                data-cost-type="${station.costInfo.isBest ? 'best' : 'extra'}">
                        ${station.costInfo.display}
                    </div>`;
                }
                // Altrimenti se è costoso, mostra extra costo
                else if (isExpensive && !isLowestPrice) {
                    return `<div class="extra-cost-info-new"
                                onclick="showCostTooltip(this, 'Stazione con prezzo superiore alla media'); event.stopPropagation();"
                                data-cost-type="expensive">
                        Extra costo
                    </div>`;
                }
                // Altrimenti se è il miglior prezzo, mostra info positiva
                else if (isLowestPrice) {
                    return `<div class="best-price-info-badge-new"
                                onclick="showCostTooltip(this, 'Stazione con il prezzo più basso trovato'); event.stopPropagation();"
                                data-cost-type="lowest">
                        Miglior prezzo
                    </div>`;
                }
                // Fallback: box neutro
                else {
                    return `<div class="neutral-cost-badge-new"
                                onclick="showCostTooltip(this, 'Prezzo nella media delle stazioni trovate'); event.stopPropagation();"
                                data-cost-type="normal">
                        Prezzo OK
                    </div>`;
                }
            })()}
        </div>
    `;
    
    card.addEventListener('click', () => {
        if (map) {
            switchTabNew('map');
            map.setView([station.lat, station.lng], 16);
            
            // Find and open the marker popup
            map.eachLayer((layer) => {
                if (layer instanceof L.Marker && 
                    Math.abs(layer.getLatLng().lat - station.lat) < 0.0001 && 
                    Math.abs(layer.getLatLng().lng - station.lng) < 0.0001) {
                    layer.openPopup();
                }
            });
        }
    });
    
    return card;
}

async function getCurrentLocationNew() {
    if (!navigator.geolocation) {
        alert('La geolocalizzazione non è supportata dal tuo browser');
        return;
    }
    
    showLoadingNew(true, 'Rilevo la tua posizione...', 'Sto utilizzando il GPS per trovare la tua posizione attuale');
    
    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000
            });
        });
        
        userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
        };
        
        if (map) {
            map.setView([userLocation.lat, userLocation.lng], 13);
        }
        
        // Ottieni l'indirizzo dalle coordinate
        console.log('🔍 Getting address from coordinates...');
        showLoadingNew(true, 'Cerco l\'indirizzo...', 'Sto convertendo le coordinate GPS in un indirizzo leggibile');
        const address = await reverseGeocodeNew(userLocation.lat, userLocation.lng);
        
        // Aggiorna il campo indirizzo
        const addressInput = document.getElementById('address-new');
        addressInput.value = address;
        lastGpsAddress = address; // Salva l'indirizzo GPS
        
        markSearchOutdatedNew();
        showLoadingNew(false);
        
        console.log('📍 GPS location obtained:', userLocation);
        
    } catch (error) {
        console.error('❌ GPS error:', error);
        let errorMessage = 'Impossibile ottenere la posizione GPS';
        
        if (error.code === 1) {
            errorMessage = 'Accesso alla posizione negato';
        } else if (error.code === 2) {
            errorMessage = 'Posizione non disponibile';
        } else if (error.code === 3) {
            errorMessage = 'Timeout nella richiesta della posizione';
        }
        
        alert(errorMessage);
        showLoadingNew(false);
    }
}

function showEmptyStateNew(view, message = null) {
    const emptyState = document.getElementById(`emptyState${view === 'map' ? 'Map' : 'List'}-new`);
    if (emptyState) {
        if (message) {
            const p = emptyState.querySelector('p');
            if (p) p.textContent = message;
        }
        emptyState.style.display = 'flex';
    }
}

function hideEmptyStateNew(view) {
    const emptyState = document.getElementById(`emptyState${view === 'map' ? 'Map' : 'List'}-new`);
    if (emptyState) {
        emptyState.style.display = 'none';
    }
}

function showLoadingNew(show = true, title = null, message = null) {
    const overlay = document.getElementById('loadingOverlay-new');
    const titleElement = document.getElementById('loadingTitle-new');
    const messageElement = document.getElementById('loadingMessage-new');
    
    if (show) {
        // Imposta messaggi personalizzati se forniti
        if (title && titleElement) {
            titleElement.textContent = title;
        }
        if (message && messageElement) {
            messageElement.textContent = message;
        }
        overlay.style.display = 'flex';
    } else {
        overlay.style.display = 'none';
        // Reset ai messaggi di default
        if (titleElement) {
            titleElement.textContent = 'Ricerca in corso...';
        }
        if (messageElement) {
            messageElement.textContent = 'Sto cercando i distributori migliori per te';
        }
    }
}

function markSearchOutdatedNew() {
    const searchBtn = document.getElementById('searchBtn-new');
    const searchText = document.querySelector('.search-text-new');
    
    if (searchBtn && searchText) {
        // Always mark as outdated when inputs change, even without previous results
        searchBtn.classList.add('outdated');
        
        if (currentResults.length > 0) {
            searchText.textContent = 'Aggiorna Ricerca';
        } else {
            searchText.textContent = 'Cerca Ora';
        }
        
        console.log('🔄 Search marked as outdated');
    }
}

function hideSearchOutdatedNew() {
    const searchBtn = document.getElementById('searchBtn-new');
    const searchText = document.querySelector('.search-text-new');
    
    if (searchBtn && searchText) {
        searchBtn.classList.remove('outdated');
        searchText.textContent = 'Cerca Ora';
        console.log('✅ Search state reset');
    }
}

function handleCalcModeChangeNew() {
    const mode = document.querySelector('input[name="calcMode-new"]:checked').value;
    const input = document.getElementById('calcValue-new');
    const unit = document.getElementById('calcUnit-new');
    const label = document.getElementById('calcLabel-new');
    const help = document.getElementById('calcHelp-new');
    
    if (mode === 'liters') {
        input.value = 55;
        input.placeholder = 'Es: 55';
        input.min = 1;
        input.max = 200;
        input.step = 0.1;
        unit.textContent = 'L';
        label.textContent = 'Quanti litri vuoi acquistare?';
        help.innerHTML = '💡 Ti mostrerò il <strong>costo per ogni distributore</strong> e quanto risparmierai scegliendo il migliore';
    } else {
        input.value = 50;
        input.placeholder = 'Es: 50';
        input.min = 5;
        input.max = 500;
        input.step = 1;
        unit.textContent = '€';
        label.textContent = 'Qual è il tuo budget?';
        help.innerHTML = '💡 Ti mostrerò <strong>quanti litri puoi comprare</strong> con il tuo budget in ogni distributore';
    }
    
    // Update preview
    updateCalcPreviewNew();
    
    // Update results if they exist
    if (currentResults.length > 0) {
        updateStationsListNew(currentResults);
        markSearchOutdatedNew();
    }
}

function initializeSlider() {
    const slider = document.getElementById('maxStations-new');
    const valueDisplay = document.getElementById('maxStationsValue-new');
    
    slider.addEventListener('input', function() {
        const value = this.value;
        valueDisplay.textContent = value === '100' ? 'Tutti' : value;
        
        // Update results if they exist
        if (currentResults.length > 0) {
            markSearchOutdatedNew();
        }
    });
    
    // Initialize display
    valueDisplay.textContent = slider.value;
}

async function updateNewDataTimestamp() {
    try {
        const timestampElement = document.getElementById('dataTimestamp-new');
        const stationsCountElement = document.getElementById('stationsCount-new');
        
        if (timestampElement && typeof DATA_TIMESTAMP !== 'undefined') {
            timestampElement.textContent = 'Dati aggiornati: ' + DATA_TIMESTAMP;
        } else if (timestampElement) {
            timestampElement.textContent = 'Dati aggiornati: ' + new Date().toLocaleString('it-IT');
        }
        
        // Aggiorna il conteggio delle stazioni nel pannello info
        if (stationsCountElement && typeof realFuelStations !== 'undefined') {
            stationsCountElement.textContent = realFuelStations.length.toLocaleString('it-IT');
        }
    } catch (error) {
        console.error('❌ Error updating timestamp:', error);
    }
}

// Funzioni di geocoding e ricerca integrate
async function geocodeAddressNew(address) {
    const encodedAddress = encodeURIComponent(address + ', Italy');
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`);
    const data = await response.json();
    
    if (data.length === 0) {
        throw new Error('Indirizzo non trovato');
    }
    
    return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
    };
}

async function reverseGeocodeNew(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
        const data = await response.json();
        
        if (data.display_name) {
            const address = data.address || {};
            const parts = [];
            
            if (address.road) parts.push(address.road);
            if (address.house_number) parts[parts.length - 1] += ` ${address.house_number}`;
            if (address.city || address.town || address.village) parts.push(address.city || address.town || address.village);
            if (address.province) parts.push(address.province);
            
            return parts.join(', ') || data.display_name.split(',').slice(0, 3).join(',');
        }
        
        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch (error) {
        console.error('Reverse geocoding error:', error);
        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
}

async function searchFuelStationsNew(coordinates, radius, fuelType) {
    // Usa i dati reali da data.js
    const nearbyStations = realFuelStations.filter(station => {
        const distance = calculateDistanceNew(
            coordinates.lat, coordinates.lng,
            station.latitude, station.longitude
        );
        
        return distance <= radius && station.prices[fuelType];
    });
    
    // Aggiungi distanza a ogni stazione e ordina per prezzo
    return nearbyStations.map(station => ({
        id: station.id,
        name: station.name,
        brand: station.brand,
        address: station.address,
        lat: station.latitude,
        lng: station.longitude,
        price: parseFloat(station.prices[fuelType].toFixed(3)),
        fuel: fuelType,
        distance: calculateDistanceNew(
            coordinates.lat, coordinates.lng,
            station.latitude, station.longitude
        )
    })).sort((a, b) => a.price - b.price);
}

function calculateDistanceNew(lat1, lng1, lat2, lng2) {
    const R = 6371; // Raggio della Terra in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Utility function to integrate with existing data loading
function getDataTimestampNew() {
    // Usa il timestamp dal data.js
    return Promise.resolve(DATA_TIMESTAMP);
}

function updateCalcPreviewNew() {
    const calcValue = parseFloat(document.getElementById('calcValue-new').value) || 0;
    const mode = document.querySelector('input[name="calcMode-new"]:checked').value;
    const preview = document.getElementById('calcPreview-new');
    const previewLabel = document.getElementById('previewLabel-new');
    const previewValue = document.getElementById('previewValue-new');
    
    if (calcValue <= 0) {
        preview.style.display = 'none';
        return;
    }
    
    // Prezzo medio stimato (approssimativo)
    const avgPrice = 1.65; // Prezzo medio benzina in Italia
    
    if (mode === 'liters') {
        const estimatedCost = (calcValue * avgPrice).toFixed(2);
        previewLabel.textContent = 'Costo stimato:';
        previewValue.textContent = `€${estimatedCost}`;
    } else {
        const estimatedLiters = (calcValue / avgPrice).toFixed(1);
        previewLabel.textContent = 'Litri stimati:';
        previewValue.textContent = `${estimatedLiters}L`;
    }
    
    preview.style.display = 'block';
}

// Initialize calculator mode change handler
document.addEventListener('DOMContentLoaded', function() {
    // Set initial calc mode
    setTimeout(() => {
        handleCalcModeChangeNew();
        
        // Add input listener for preview
        const calcInput = document.getElementById('calcValue-new');
        if (calcInput) {
            calcInput.addEventListener('input', updateCalcPreviewNew);
        }
    }, 100);
});

// Funzione per mostrare tooltip sui badge dei costi
function showCostTooltip(element, message) {
    // Rimuovi tooltip esistenti
    const existingTooltips = document.querySelectorAll('.cost-tooltip-new');
    existingTooltips.forEach(tooltip => tooltip.remove());
    
    // Crea nuovo tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'cost-tooltip-new';
    tooltip.innerHTML = `
        <div class="tooltip-content-new">
            <div class="tooltip-icon-new">${getTooltipIcon(element.dataset.costType)}</div>
            <div class="tooltip-text-new">${message}</div>
            <button class="tooltip-close-new" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    // Posiziona il tooltip
    document.body.appendChild(tooltip);
    
    const rect = element.getBoundingClientRect();
    tooltip.style.position = 'fixed';
    tooltip.style.left = Math.max(10, rect.left - 100) + 'px';
    tooltip.style.top = (rect.top - 60) + 'px';
    tooltip.style.zIndex = '10000';
    
    // Rimuovi automaticamente dopo 5 secondi
    setTimeout(() => {
        if (tooltip.parentElement) {
            tooltip.remove();
        }
    }, 5000);
}

function getTooltipIcon(costType) {
    switch(costType) {
        case 'best': return '<i class="fas fa-trophy" style="color: #28a745;"></i>';
        case 'extra': return '<i class="fas fa-coins" style="color: #ffc107;"></i>';
        case 'expensive': return '<i class="fas fa-exclamation-triangle" style="color: #dc3545;"></i>';
        case 'lowest': return '<i class="fas fa-star" style="color: #28a745;"></i>';
        case 'normal': return '<i class="fas fa-check-circle" style="color: #6c757d;"></i>';
        default: return '<i class="fas fa-info-circle"></i>';
    }
}

console.log('📱 FuelFinder Modern JavaScript Loaded');