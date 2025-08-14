// App State
let currentTab = 'map'; // Start with map tab as shown in sketch
let currentResults = [];
let userLocation = null;
let map = null;

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Bind event listeners
    bindEventListeners();
    
    // Initialize map
    initializeMap();
    
    // Initialize timestamp
    updateDataTimestamp();
}

function bindEventListeners() {
    // Search button
    document.getElementById('searchBtn').addEventListener('click', handleSearch);
    
    // Location button
    document.getElementById('locationBtn').addEventListener('click', getCurrentLocation);
    
    // Update data button
    document.getElementById('updateDataBtn').addEventListener('click', handleDataUpdate);
    
    // Tab navigation - updated IDs to match new HTML
    document.getElementById('tabList').addEventListener('click', () => switchTab('list'));
    document.getElementById('tabMap').addEventListener('click', () => switchTab('map'));
    
    // Expandable panels
    document.getElementById('locationExpandBtn').addEventListener('click', () => togglePanel('location-panel'));
    document.getElementById('settingsExpandBtn').addEventListener('click', () => togglePanel('settings-panel'));
    
    // Close panel buttons
    document.querySelectorAll('.close-panel').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.target.closest('.close-panel').dataset.target;
            togglePanel(target, false);
        });
    });
    
    // Enter key in address field
    document.getElementById('address').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });
    
    // Calc mode change
    document.getElementById('calcMode').addEventListener('change', handleCalcModeChange);
    
    // Cost value input change - update results if they exist
    document.getElementById('calcValue').addEventListener('input', function() {
        if (currentResults.length > 0) {
            showResults(currentResults);
        }
    });
}

function updateStatusMessage(message) {
    // Status message element removed from UI
    // Function kept for compatibility but does nothing
    console.log('Status:', message);
}

function showLoading(show = true) {
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display = show ? 'flex' : 'none';
}

function switchTab(tab) {
    currentTab = tab;
    
    // Update tab buttons
    const listTab = document.getElementById('tabList');
    const mapTab = document.getElementById('tabMap');
    
    listTab.classList.toggle('active', tab === 'list');
    mapTab.classList.toggle('active', tab === 'map');
    
    // Update tab content - updated IDs to match new HTML
    const listContent = document.getElementById('listContent');
    const mapContent = document.getElementById('mapContent');
    
    listContent.classList.toggle('active', tab === 'list');
    mapContent.classList.toggle('active', tab === 'map');
    
    // Refresh map if switching to map tab
    if (tab === 'map' && map) {
        setTimeout(() => {
            map.invalidateSize();
            if (currentResults.length > 0) {
                updateMapMarkers(currentResults);
            }
        }, 100);
    }
}

function handleCalcModeChange() {
    const selectedMode = document.getElementById('calcMode').value;
    const input = document.getElementById('calcValue');
    
    if (selectedMode === 'liters') {
        input.value = 55;
        input.min = 10;
        input.max = 200;
        input.step = 5;
        input.placeholder = 'Litri';
    } else {
        input.value = 50;
        input.min = 10;
        input.max = 500;
        input.step = 10;
        input.placeholder = 'Budget €';
    }
    
    // Refresh results if they exist
    if (currentResults.length > 0) {
        showResults(currentResults);
    }
}

function calculateCosts(stations) {
    const calcMode = document.getElementById('calcMode').value;
    const calcValue = parseFloat(document.getElementById('calcValue').value) || 0;
    
    if (calcValue <= 0 || stations.length === 0) {
        return stations.map(station => ({...station, costInfo: null}));
    }
    
    // Find best price for comparison
    const prices = stations.map(s => s.price).filter(p => p > 0);
    if (prices.length === 0) {
        return stations.map(station => ({...station, costInfo: null}));
    }
    
    const bestPrice = Math.min(...prices);
    
    return stations.map(station => {
        const price = station.price;
        const isBest = Math.abs(price - bestPrice) < 0.0001;
        let costInfo = null;
        
        if (price > 0) {
            if (calcMode === 'liters') {
                // Calculate cost for specified liters
                const totalCost = parseFloat((price * calcValue).toFixed(2));
                const extraCost = parseFloat(((price - bestPrice) * calcValue).toFixed(2));
                
                costInfo = {
                    mode: 'liters',
                    liters: calcValue,
                    totalCost: totalCost,
                    extraCost: extraCost,
                    isBest: Math.abs(price - bestPrice) < 1e-4,
                    display: isBest ? `€${totalCost.toFixed(2)}` : `+€${extraCost.toFixed(2)}`,
                    label: isBest ? `Miglior prezzo (${calcValue}L)` : `Extra costo (${calcValue}L)`,
                    icon: isBest ? '🏆' : '💸'
                };
            } else {
                // Calculate liters for specified budget
                const litersObtained = parseFloat((calcValue / price).toFixed(3));
                const bestLiters = parseFloat((calcValue / bestPrice).toFixed(3));
                const lessLiters = parseFloat((bestLiters - litersObtained).toFixed(3));
                
                costInfo = {
                    mode: 'budget',
                    budget: calcValue,
                    litersObtained: litersObtained,
                    lessLiters: lessLiters,
                    isBest: isBest,
                    display: isBest ? `${litersObtained.toFixed(3)}L` : `-${lessLiters.toFixed(3)}L`,
                    label: isBest ? `Più litri (€${calcValue})` : `Meno litri (€${calcValue})`,
                    icon: isBest ? '🏆' : '💸'
                };
            }
        }
        
        return {
            ...station,
            costInfo: costInfo
        };
    });
}

async function handleSearch() {
    const address = document.getElementById('address').value.trim();
    const fuelType = document.getElementById('fuelType').value;
    const radius = parseFloat(document.getElementById('radius').value);
    
    // Close all panels when starting search
    closeAllPanels();
    
    if (!address) {
        updateStatusMessage('📱 Nessun indirizzo inserito, provo a usare la posizione attuale...');
        await getCurrentLocation();
        return;
    }
    
    showLoading(true);
    
    try {
        updateStatusMessage('🔍 Geocoding indirizzo...');
        
        // Geocode the address
        const coordinates = await geocodeAddress(address);
        userLocation = coordinates;
        
        updateStatusMessage('🔍 Ricerca distributori...');
        
        // Search for fuel stations
        const results = await searchFuelStations(coordinates, radius, fuelType);
        
        if (results.length === 0) {
            updateStatusMessage(`❌ Nessun distributore con ${fuelType} trovato entro ${radius}km da ${address}`);
            showResults([]);
        } else {
            updateStatusMessage(`✅ Trovati ${results.length} distributori con ${fuelType} entro ${radius}km`);
            showResults(results);
        }
        
    } catch (error) {
        console.error('Search error:', error);
        updateStatusMessage('❌ Errore durante la ricerca');
        showResults([]);
    } finally {
        showLoading(false);
    }
}

async function getCurrentLocation() {
    if (!navigator.geolocation) {
        updateStatusMessage('❌ Geolocalizzazione non supportata da questo browser');
        return;
    }
    
    showLoading(true);
    updateStatusMessage('📍 Ottenendo la tua posizione...');
    
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
        
        // Get address from coordinates
        updateStatusMessage('🔍 Ricerca indirizzo...');
        const address = await reverseGeocode(userLocation.lat, userLocation.lng);
        document.getElementById('address').value = address;
        
        // Automatically search if fuel type and radius are selected
        const fuelType = document.getElementById('fuelType').value;
        const radius = parseFloat(document.getElementById('radius').value);
        
        if (fuelType && radius) {
            updateStatusMessage('🔍 Ricerca distributori nelle vicinanze...');
            const results = await searchFuelStations(userLocation, radius, fuelType);
            
            if (results.length === 0) {
                updateStatusMessage(`❌ Nessun distributore con ${fuelType} trovato entro ${radius}km`);
                showResults([]);
            } else {
                updateStatusMessage(`✅ Trovati ${results.length} distributori nelle vicinanze`);
                showResults(results);
            }
        }
        
    } catch (error) {
        console.error('Geolocation error:', error);
        if (error.code === 1) {
            updateStatusMessage('❌ Accesso alla posizione negato');
        } else if (error.code === 2) {
            updateStatusMessage('❌ Posizione non disponibile');
        } else if (error.code === 3) {
            updateStatusMessage('❌ Timeout nella richiesta della posizione');
        } else {
            updateStatusMessage('❌ Errore sconosciuto nella geolocalizzazione');
        }
    } finally {
        showLoading(false);
    }
}

async function handleDataUpdate() {
    updateStatusMessage('🔄 Aggiornamento dati in corso...');
    showLoading(true);
    
    try {
        // Simulate data update delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        updateStatusMessage('✅ Dati aggiornati con successo');
        
        // Update timestamp
        updateDataTimestamp();
        
        // If we have current results, refresh them
        if (currentResults.length > 0) {
            setTimeout(() => {
                showResults(currentResults);
            }, 1000);
        }
    } catch (error) {
        updateStatusMessage('❌ Errore durante l\'aggiornamento dati');
    } finally {
        showLoading(false);
    }
}

// Real geocoding using OpenStreetMap Nominatim API
async function geocodeAddress(address) {
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

async function reverseGeocode(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
        const data = await response.json();
        
        if (data.display_name) {
            // Extract meaningful parts of the address
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

async function searchFuelStations(coordinates, radius, fuelType) {
    const nearbyStations = realFuelStations.filter(station => {
        const distance = calculateDistance(
            coordinates.lat, coordinates.lng,
            station.latitude, station.longitude
        );
        
        return distance <= radius && station.prices[fuelType];
    });
    
    // Add distance to each station and sort by price
    return nearbyStations.map(station => ({
        ...station,
        distance: calculateDistance(
            coordinates.lat, coordinates.lng,
            station.latitude, station.longitude
        ),
        price: station.prices[fuelType]
    })).sort((a, b) => a.price - b.price);
}

function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function showResults(results) {
    currentResults = results;
    
    if (results.length === 0) {
        document.getElementById('emptyStateMap').style.display = currentTab === 'map' ? 'flex' : 'none';
        document.getElementById('emptyStateList').style.display = currentTab === 'list' ? 'flex' : 'none';
        document.getElementById('stationsList').innerHTML = '';
        return;
    }
    
    // Apply cost calculations to results
    const resultsWithCosts = calculateCosts(results);
    
    // Hide empty states
    document.getElementById('emptyStateMap').style.display = 'none';
    document.getElementById('emptyStateList').style.display = 'none';
    
    // Render stations list
    renderStationsList(resultsWithCosts);
    
    // Update map
    updateMapMarkers(resultsWithCosts);
}

function initializeMap() {
    // Initialize Leaflet map
    map = L.map('map').setView([45.4642, 9.1900], 12);
    
    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
}

function renderStationsList(results) {
    const container = document.getElementById('stationsList');
    const fuelType = document.getElementById('fuelType').value;
    
    if (results.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    const cheapestPrice = Math.min(...results.map(s => parseFloat(s.price.toFixed(3))));
    
    container.innerHTML = results.map((station, index) => {
        const isCheapest = Math.abs(station.price - cheapestPrice) < 0.001;
        const cardClass = isCheapest ? 'station-card best-price' : 'station-card';
        
        // Generate cost info HTML if available
        let costInfoHtml = '';
        if (station.costInfo && station.costInfo.display) {
            const costClass = station.costInfo.isBest ? 'cost-info best-deal' : 'cost-info extra-cost';
            const valueClass = station.costInfo.isBest ? 'cost-value best' : 'cost-value extra';
            
            costInfoHtml = `
                <div class="${costClass}">
                    <span class="cost-icon">${station.costInfo.icon}</span>
                    <span class="cost-label">${station.costInfo.label.replace(/\([^)]*\)/, '')}</span>
                    <span class="${valueClass}">${station.costInfo.display}</span>
                </div>
            `;
        }
        
        return `
            <div class="${cardClass}">
                <div class="station-header">
                    <div class="station-info">
                        <div class="station-name">${station.name}</div>
                        <div class="station-brand">${station.brand}</div>
                    </div>
                    <div class="price-distance">
                        <div class="price-badge">€${station.price.toFixed(3)}/L</div>
                        <div class="distance-badge">
                            <i class="fas fa-route"></i> ${station.distance.toFixed(1)} km
                        </div>
                    </div>
                </div>
                <div class="station-address">
                    <i class="fas fa-map-marker-alt"></i> ${station.address}
                </div>
                <div class="station-footer">
                    ${costInfoHtml}
                    ${isCheapest ? '<div class="best-price-badge"><i class="fas fa-trophy"></i> Prezzo più basso!</div>' : ''}
                </div>
            </div>
        `;
    }).join('');
}

function updateMapMarkers(stationsData = null) {
    const stations = stationsData || currentResults;
    if (!map || stations.length === 0) return;
    
    // Clear existing markers
    map.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            map.removeLayer(layer);
        }
    });
    
    const fuelType = document.getElementById('fuelType').value;
    const cheapestPrice = Math.min(...stations.map(s => s.price));
    
    // Add user location marker if available
    if (userLocation) {
        const userIcon = L.divIcon({
            html: '<i class="fas fa-user-circle" style="color: #2196f3; font-size: 24px;"></i>',
            iconSize: [30, 30],
            className: 'user-location-marker'
        });
        
        L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
            .addTo(map)
            .bindPopup('<strong>La tua posizione</strong>');
    }
    
    // Add station markers
    stations.forEach(station => {
        const isCheapest = Math.abs(station.price - cheapestPrice) < 0.001;
        const color = isCheapest ? '#00c853' : '#f50057';
        const icon = isCheapest ? '🏆' : '⛽';
        
        const stationIcon = L.divIcon({
            html: `<div style="background: ${color}; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">${icon}</div>`,
            iconSize: [30, 30],
            className: 'station-marker'
        });
        
        // Build cost info HTML for popup if available
        let costInfoHtml = '';
        if (station.costInfo && station.costInfo.display) {
            const costColor = station.costInfo.isBest ? '#00c853' : '#ff9800';
            costInfoHtml = `
                <div style="margin: 8px 0; padding: 6px 10px; background: rgba(${station.costInfo.isBest ? '0,200,83' : '255,152,0'}, 0.1); border: 1px solid rgba(${station.costInfo.isBest ? '0,200,83' : '255,152,0'}, 0.3); border-radius: 8px;">
                    <div style="font-size: 0.9em; color: #666; margin-bottom: 2px;">${station.costInfo.label}</div>
                    <div style="font-weight: bold; color: ${costColor}; font-size: 1.1em;">
                        ${station.costInfo.icon} ${station.costInfo.display}
                    </div>
                </div>
            `;
        }
        
        const popupContent = `
            <div style="min-width: 220px;">
                <strong>${station.name}</strong><br>
                <small>${station.brand}</small><br>
                <div style="margin: 8px 0;">
                    <span style="background: ${color}; color: white; padding: 4px 8px; border-radius: 12px; font-weight: bold;">
                        €${station.price.toFixed(3)}/L
                    </span>
                    <span style="margin-left: 8px; color: #666;">
                        ${station.distance.toFixed(1)} km
                    </span>
                </div>
                ${costInfoHtml}
                <div style="color: #666; font-size: 0.9em;">${station.address}</div>
                ${isCheapest ? '<div style="color: #00c853; font-weight: bold; margin-top: 4px;">🏆 Miglior prezzo!</div>' : ''}
            </div>
        `;
        
        L.marker([station.latitude, station.longitude], { icon: stationIcon })
            .addTo(map)
            .bindPopup(popupContent);
    });
    
    // Fit map bounds to show all markers
    if (stations.length > 0) {
        const group = new L.featureGroup(
            stations.map(station => L.marker([station.latitude, station.longitude]))
        );
        
        if (userLocation) {
            group.addLayer(L.marker([userLocation.lat, userLocation.lng]));
        }
        
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

// Data timestamp helper
function updateDataTimestamp() {
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    
    const timestampText = `${day}/${month}/${year} alle ${hours}:${minutes}`;
    document.getElementById('dataTimestamp').textContent = timestampText;
}

// Panel management
function togglePanel(panelId, forceState = null) {
    const panel = document.getElementById(panelId);
    const expandBtn = document.querySelector(`[data-target="${panelId}"]`);
    
    // Close all other panels first
    document.querySelectorAll('.expandable-panel').forEach(p => {
        if (p.id !== panelId) {
            p.classList.remove('active');
        }
    });
    
    document.querySelectorAll('.expand-btn').forEach(btn => {
        if (btn.dataset.target !== panelId) {
            btn.classList.remove('active');
        }
    });
    
    // Toggle target panel
    if (forceState !== null) {
        panel.classList.toggle('active', forceState);
        expandBtn.classList.toggle('active', forceState);
    } else {
        panel.classList.toggle('active');
        expandBtn.classList.toggle('active');
    }
    
    // Adjust bottom spacing for results section
    updateBottomSpacing();
}

function closeAllPanels() {
    // Close all expandable panels
    document.querySelectorAll('.expandable-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    
    // Remove active state from all expand buttons
    document.querySelectorAll('.expand-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Reset bottom spacing to base height
    updateBottomSpacing();
}

function updateBottomSpacing() {
    const openPanels = document.querySelectorAll('.expandable-panel.active');
    const baseHeight = 70; // Base footer height
    let additionalHeight = 0;
    
    openPanels.forEach(panel => {
        additionalHeight += panel.scrollHeight;
    });
    
    document.documentElement.style.setProperty('--bottom-height', `${baseHeight + additionalHeight}px`);
}
