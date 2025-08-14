// App State
let currentTab = 'list';
let currentResults = [];
let userLocation = null;
let map = null;

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Set initial timestamp
    updateHeaderTimestamp();
    
    // Bind event listeners
    bindEventListeners();
    
    // Initialize map
    initializeMap();
    
    // Update timestamp every minute
    setInterval(updateHeaderTimestamp, 60000);
}

function bindEventListeners() {
    // Search button
    document.getElementById('searchBtn').addEventListener('click', handleSearch);
    
    // Location button
    document.getElementById('locationBtn').addEventListener('click', getCurrentLocation);
    
    // Update data button
    document.getElementById('updateDataBtn').addEventListener('click', handleDataUpdate);
    
    // Tab navigation
    document.getElementById('tabList').addEventListener('click', () => switchTab('list'));
    document.getElementById('tabMap').addEventListener('click', () => switchTab('map'));
    
    // Enter key in address field
    document.getElementById('address').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });
}

function updateHeaderTimestamp() {
    const timestamp = updateDataTimestamp();
    document.getElementById('headerTimestamp').textContent = timestamp;
}

function updateStatusMessage(message) {
    const statusElement = document.getElementById('statusMessage');
    statusElement.textContent = message;
    
    // Reset classes
    statusElement.className = 'status-message';
    
    // Add appropriate class based on message content
    if (message.includes('✅')) {
        statusElement.classList.add('success');
    } else if (message.includes('❌')) {
        statusElement.classList.add('error');
    } else if (message.includes('⚠️')) {
        statusElement.classList.add('warning');
    } else if (message.includes('🔍') || message.includes('📍') || message.includes('📱')) {
        statusElement.classList.add('info');
    }
    
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
    
    // Update tab content
    const listContent = document.getElementById('resultsList');
    const mapContent = document.getElementById('resultsMap');
    
    listContent.classList.toggle('active', tab === 'list');
    mapContent.classList.toggle('active', tab === 'map');
    
    // Refresh map if switching to map tab
    if (tab === 'map' && map) {
        setTimeout(() => {
            map.invalidateSize();
            if (currentResults.length > 0) {
                updateMapMarkers();
            }
        }, 100);
    }
}

async function handleSearch() {
    const address = document.getElementById('address').value.trim();
    const fuelType = document.getElementById('fuelType').value;
    const radius = parseFloat(document.getElementById('radius').value);
    
    if (!address) {
        // If no address provided, try to get current location
        updateStatusMessage('📱 Nessun indirizzo inserito, provo a usare la posizione attuale...');
        await getCurrentLocation();
        return;
    }
    
    showLoading(true);
    updateStatusMessage('🔍 Ricerca in corso...');
    
    try {
        console.log(`Starting search for: ${address}, fuel: ${fuelType}, radius: ${radius}km`);
        
        // Geocode address first
        const coordinates = await geocodeAddress(address);
        if (!coordinates) {
            updateStatusMessage('❌ Indirizzo non trovato. Prova a essere più specifico.');
            showLoading(false);
            return;
        }
        
        console.log(`Address geocoded to:`, coordinates);
        userLocation = coordinates;
        
        // Search for fuel stations
        const results = await searchFuelStations(coordinates, radius, fuelType);
        
        if (results.length === 0) {
            updateStatusMessage(`❌ Nessun distributore con ${fuelType} trovato entro ${radius}km da ${address}`);
            showResults([]);
        } else {
            updateStatusMessage(`✅ Trovati ${results.length} distributori con ${fuelType} entro ${radius}km`);
            showResults(results);
            
            // Log some debug info
            console.log(`Nearest station: ${results[0].name} at ${results[0].distance.toFixed(2)}km`);
            console.log(`Cheapest price: €${results[0].price.toFixed(2)}/L`);
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
    updateStatusMessage('📍 Rilevamento posizione in corso...');
    
    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                resolve, 
                reject, 
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000
                }
            );
        });
        
        const { latitude, longitude } = position.coords;
        userLocation = { lat: latitude, lng: longitude };
        
        console.log(`Current location detected:`, userLocation);
        
        // Reverse geocode to get address
        const address = await reverseGeocode(latitude, longitude);
        document.getElementById('address').value = address;
        
        updateStatusMessage('✅ Posizione rilevata! Ora puoi cercare i distributori.');
        
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
        let errorMessage = '❌ Impossibile rilevare la posizione';
        
        switch(error.code) {
            case error.PERMISSION_DENIED:
                errorMessage = '❌ Permesso di geolocalizzazione negato';
                break;
            case error.POSITION_UNAVAILABLE:
                errorMessage = '❌ Posizione non disponibile';
                break;
            case error.TIMEOUT:
                errorMessage = '❌ Timeout nella rilevazione posizione';
                break;
        }
        
        updateStatusMessage(errorMessage);
    } finally {
        showLoading(false);
    }
}

async function handleDataUpdate() {
    showLoading(true);
    updateStatusMessage('⏳ Aggiornamento dati in corso...');
    
    // Simulate data update delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    updateHeaderTimestamp();
    updateStatusMessage('✅ Dati aggiornati con successo!');
    showLoading(false);
}

// Real geocoding using OpenStreetMap Nominatim API
async function geocodeAddress(address) {
    updateStatusMessage('🔍 Cercando posizione...');
    
    try {
        // Clean and encode the address
        const encodedAddress = encodeURIComponent(address.trim());
        
        // Use Nominatim API for geocoding (free and no API key required)
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&countrycodes=it&limit=1&addressdetails=1`,
            {
                headers: {
                    'User-Agent': 'FuelFinder Mobile App'
                }
            }
        );
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data && data.length > 0) {
            const result = data[0];
            const coordinates = {
                lat: parseFloat(result.lat),
                lng: parseFloat(result.lon)
            };
            
            console.log(`Geocoding successful: ${address} -> ${coordinates.lat}, ${coordinates.lng}`);
            updateStatusMessage('📍 Posizione trovata');
            
            return coordinates;
        } else {
            console.log(`No results found for address: ${address}`);
            updateStatusMessage('❌ Indirizzo non trovato');
            return null;
        }
        
    } catch (error) {
        console.error('Geocoding error:', error);
        updateStatusMessage('❌ Errore durante la ricerca della posizione');
        return null;
    }
}

async function reverseGeocode(lat, lng) {
    // Real reverse geocoding using Nominatim
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
            {
                headers: {
                    'User-Agent': 'FuelFinder Mobile App'
                }
            }
        );
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data && data.display_name) {
            return data.display_name;
        } else {
            return `Coordinate: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        }
        
    } catch (error) {
        console.error('Reverse geocoding error:', error);
        return `Coordinate: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
}

async function searchFuelStations(coordinates, radius, fuelType) {
    updateStatusMessage('🔍 Ricerca distributori...');
    
    // Use real data if available, fallback to sample data
    const stationsToSearch = typeof fuelStationsData !== 'undefined' ? fuelStationsData : sampleFuelStations;
    
    console.log(`Searching for ${fuelType} stations within ${radius}km of coordinates:`, coordinates);
    console.log(`Total stations to search:`, stationsToSearch.length);
    
    // Filter stations within radius and calculate distances
    const results = stationsToSearch
        .map(station => {
            const distance = calculateDistance(
                coordinates.lat, coordinates.lng,
                station.latitude, station.longitude
            );
            
            const price = station.prices[fuelType] || 0;
            
            return {
                ...station,
                distance: distance,
                price: price
            };
        })
        .filter(station => {
            // Filter by radius and valid price
            const withinRadius = station.distance <= radius;
            const hasValidPrice = station.price > 0;
            
            if (!withinRadius) {
                console.log(`Station ${station.name} excluded: distance ${station.distance.toFixed(2)}km > ${radius}km`);
            }
            if (!hasValidPrice) {
                console.log(`Station ${station.name} excluded: no price for ${fuelType}`);
            }
            
            return withinRadius && hasValidPrice;
        })
        .sort((a, b) => a.price - b.price); // Sort by price
    
    console.log(`Found ${results.length} stations within ${radius}km with ${fuelType} prices`);
    
    return results;
}

function calculateDistance(lat1, lng1, lat2, lng2) {
    // Haversine formula
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
    
    const resultsHeader = document.getElementById('resultsHeader');
    const resultsCount = document.getElementById('resultsCount');
    const resultsSubtitle = document.getElementById('resultsSubtitle');
    const emptyState = document.getElementById('emptyState');
    
    if (results.length === 0) {
        resultsHeader.style.display = 'none';
        emptyState.style.display = 'block';
        document.getElementById('stationsList').innerHTML = '';
        return;
    }
    
    // Update header
    resultsHeader.style.display = 'block';
    emptyState.style.display = 'none';
    resultsCount.textContent = `🏪 ${results.length} distributori trovati`;
    
    const fuelType = document.getElementById('fuelType').value;
    const radius = document.getElementById('radius').value;
    resultsSubtitle.textContent = `Carburante: ${fuelType} • Raggio: ${radius} km`;
    
    // Render stations list
    renderStationsList(results);
    
    // Update map if on map tab
    if (currentTab === 'map') {
        updateMapMarkers();
    }
}

function renderStationsList(results) {
    const container = document.getElementById('stationsList');
    const fuelType = document.getElementById('fuelType').value;
    
    if (results.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    const cheapestPrice = Math.min(...results.map(s => s.price));
    
    container.innerHTML = results.map((station, index) => {
        const isCheapest = station.price === cheapestPrice;
        const cardClass = isCheapest ? 'station-card best-price' : 'station-card';
        
        return `
            <div class="${cardClass}">
                <div class="station-header">
                    <div class="station-name">${station.name}</div>
                    <div class="station-brand">${station.brand}</div>
                    <div class="price-distance">
                        <div class="price-badge">€${station.price.toFixed(2)}/L</div>
                        <div class="distance-badge">
                            <i class="fas fa-route"></i> ${station.distance.toFixed(1)} km
                        </div>
                    </div>
                </div>
                <div class="station-address">
                    <i class="fas fa-map-marker-alt"></i> ${station.address}
                </div>
                ${isCheapest ? '<div style="padding: 0 var(--spacing-lg) var(--spacing-sm); color: var(--success-color); font-weight: bold;"><i class="fas fa-trophy"></i> Prezzo più basso!</div>' : ''}
            </div>
        `;
    }).join('');
    
    console.log(`Rendered ${results.length} stations in list view`);
}

function initializeMap() {
    // Initialize Leaflet map
    map = L.map('map').setView([45.4642, 9.1900], 12);
    
    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
}

function updateMapMarkers() {
    if (!map || currentResults.length === 0) return;
    
    // Clear existing markers
    map.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            map.removeLayer(layer);
        }
    });
    
    const fuelType = document.getElementById('fuelType').value;
    const cheapestPrice = Math.min(...currentResults.map(s => s.price));
    
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
    currentResults.forEach(station => {
        const isCheapest = station.price === cheapestPrice;
        const color = isCheapest ? '#00c853' : '#f50057';
        const icon = isCheapest ? '🏆' : '⛽';
        
        const stationIcon = L.divIcon({
            html: `<div style="background: ${color}; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">${icon}</div>`,
            iconSize: [30, 30],
            className: 'station-marker'
        });
        
        const popupContent = `
            <div style="min-width: 200px;">
                <strong>${station.name}</strong><br>
                <small>${station.brand}</small><br>
                <div style="margin: 8px 0;">
                    <span style="background: ${color}; color: white; padding: 4px 8px; border-radius: 12px; font-weight: bold;">
                        €${station.price.toFixed(2)}/L
                    </span>
                    <span style="margin-left: 8px; color: #666;">
                        ${station.distance.toFixed(1)} km
                    </span>
                </div>
                <div style="color: #666; font-size: 0.9em;">${station.address}</div>
                ${isCheapest ? '<div style="color: #00c853; font-weight: bold; margin-top: 4px;">🏆 Miglior prezzo!</div>' : ''}
            </div>
        `;
        
        L.marker([station.latitude, station.longitude], { icon: stationIcon })
            .addTo(map)
            .bindPopup(popupContent);
    });
    
    // Fit map bounds to show all markers
    if (currentResults.length > 0) {
        const group = new L.featureGroup(
            currentResults.map(station => L.marker([station.latitude, station.longitude]))
        );
        
        if (userLocation) {
            group.addLayer(L.marker([userLocation.lat, userLocation.lng]));
        }
        
        map.fitBounds(group.getBounds().pad(0.1));
    }
}
