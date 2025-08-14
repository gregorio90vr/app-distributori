// App State
let currentTab = 'list';
let currentResults = [];
let userLocation = null;
let map = null;

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    
    // Add debugging function to window for testing
    window.testCostCalculation = function() {
        console.log('=== TESTING COST CALCULATION ===');
        
        // Force open the cost calculator
        const costCalculatorForm = document.getElementById('costCalculatorForm');
        costCalculatorForm.classList.remove('collapsed');
        
        // Set test values
        const modeInput = document.querySelector('input[name="calcMode"][value="liters"]');
        if (modeInput) modeInput.checked = true;
        
        const valueInput = document.getElementById('calcValue');
        if (valueInput) valueInput.value = '50';
        
        // If we have current results, force recalculation
        if (currentResults.length > 0) {
            console.log('Found', currentResults.length, 'existing results, recalculating costs');
            showResults(currentResults);
        } else {
            console.log('No current results to test with');
        }
        
        console.log('=== END TEST ===');
    };
    
    console.log('Test function added to window.testCostCalculation()');
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
    
    // Cost calculator toggle
    document.getElementById('costToggle').addEventListener('click', toggleCostCalculator);
    
    // Cost calculation mode change
    document.querySelectorAll('input[name="calcMode"]').forEach(radio => {
        radio.addEventListener('change', handleCalcModeChange);
    });
    
    // Cost value input change - update results if they exist
    document.getElementById('calcValue').addEventListener('input', function() {
        if (currentResults.length > 0) {
            showResults(currentResults);
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
                // Apply cost calculations and update map
                const resultsWithCosts = calculateCosts(currentResults);
                updateMapMarkers(resultsWithCosts);
            }
        }, 100);
    }
}

// === COST CALCULATOR FUNCTIONS ===
function toggleCostCalculator() {
    const button = document.getElementById('costToggle');
    const form = document.getElementById('costCalculatorForm');
    
    button.classList.toggle('expanded');
    form.classList.toggle('collapsed');
    
    // Update button icon animation
    const icon = button.querySelector('.toggle-icon');
    if (button.classList.contains('expanded')) {
        icon.style.transform = 'rotate(180deg)';
        
        // When opening, refresh results with cost calculations if they exist
        if (currentResults.length > 0) {
            console.log('Cost calculator opened - refreshing results with costs');
            showResults(currentResults);
        }
    } else {
        icon.style.transform = 'rotate(0deg)';
        
        // When closing, refresh results without cost calculations
        if (currentResults.length > 0) {
            console.log('Cost calculator closed - refreshing results without costs');
            showResults(currentResults);
        }
    }
}

function handleCalcModeChange() {
    const selectedMode = document.querySelector('input[name="calcMode"]:checked').value;
    const label = document.getElementById('calcLabel');
    const input = document.getElementById('calcValue');
    
    if (selectedMode === 'liters') {
        label.innerHTML = '<i class="fas fa-gas-pump"></i> Litri serbatoio';
        input.value = 55;
        input.min = 10;
        input.max = 200;
        input.step = 5;
    } else {
        label.innerHTML = '<i class="fas fa-euro-sign"></i> Budget (€)';
        input.value = 50;
        input.min = 10;
        input.max = 500;
        input.step = 10;
    }
    
    // Refresh results if they exist
    if (currentResults.length > 0) {
        showResults(currentResults);
    }
}

function calculateCosts(stations) {
    const costCalculatorForm = document.getElementById('costCalculatorForm');
    const isCostCalculatorOpen = !costCalculatorForm.classList.contains('collapsed');
    
    console.log('calculateCosts called - Calculator open:', isCostCalculatorOpen);
    
    // If cost calculator is closed, return stations without cost info
    if (!isCostCalculatorOpen) {
        console.log('Cost calculator is closed - skipping cost calculations');
        return stations.map(station => ({...station, costInfo: null}));
    }
    
    const modeInput = document.querySelector('input[name="calcMode"]:checked');
    const valueInput = document.getElementById('calcValue');
    
    if (!modeInput || !valueInput) {
        console.log('Cost calculator inputs not found');
        return stations.map(station => ({...station, costInfo: null}));
    }
    
    const mode = modeInput.value;
    const inputValue = parseFloat(valueInput.value) || 0;
    
    console.log(`Calculating costs: mode=${mode}, inputValue=${inputValue}, stations=${stations.length}`);
    
    if (inputValue <= 0 || stations.length === 0) {
        console.log('Skipping cost calculation - invalid input or no stations');
        return stations.map(station => ({...station, costInfo: null}));
    }
    
    // Find best price for comparison
    const prices = stations.map(s => s.price).filter(p => p > 0);
    if (prices.length === 0) {
        console.log('No valid prices found');
        return stations.map(station => ({...station, costInfo: null}));
    }
    
    const bestPrice = Math.min(...prices);
    
    console.log(`Best price: €${bestPrice}, total prices: ${prices.length}`);
    
    return stations.map(station => {
        const price = station.price;
        const isBest = Math.abs(price - bestPrice) < 0.0001; // Use small epsilon for float comparison
        let costInfo = null;
        
        console.log(`Processing station ${station.name}: price=${price}, isBest=${isBest}`);
        
        if (price > 0) {
            if (mode === 'liters') {
                // Calculate cost for specified liters
                const totalCost = parseFloat((price * inputValue).toFixed(2));
                const extraCost = parseFloat(((price - bestPrice) * inputValue).toFixed(2));
                
                costInfo = {
                    mode: 'liters',
                    liters: inputValue,
                    totalCost: totalCost,
                    extraCost: extraCost,
                    isBest: isBest,
                    display: isBest ? `€${totalCost.toFixed(2)}` : `+€${extraCost.toFixed(2)}`,
                    label: isBest ? `Miglior prezzo (${inputValue}L)` : `Extra costo (${inputValue}L)`,
                    icon: isBest ? '🏆' : '💸'
                };
            } else {
                // Calculate liters for specified budget
                const litersObtained = parseFloat((inputValue / price).toFixed(2));
                const bestLiters = parseFloat((inputValue / bestPrice).toFixed(2));
                const lessLiters = parseFloat((bestLiters - litersObtained).toFixed(2));
                
                costInfo = {
                    mode: 'budget',
                    budget: inputValue,
                    litersObtained: litersObtained,
                    lessLiters: lessLiters,
                    isBest: isBest,
                    display: isBest ? `${litersObtained.toFixed(3)}L` : `-${lessLiters.toFixed(3)}L`,
                    label: isBest ? `Più litri (€${inputValue})` : `Meno litri (€${inputValue})`,
                    icon: isBest ? '🏆' : '💸'
                };
            }
        }
        
        const result = {
            ...station,
            costInfo: costInfo
        };
        
        if (costInfo) {
            console.log(`Station ${station.name}: ${costInfo.display} - ${costInfo.label}`);
        } else {
            console.log(`Station ${station.name}: no cost info generated`);
        }
        
        return result;
    });
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
            
            // Show success feedback on search button
            showSearchSuccess();
            
            // Auto-scroll to results with smooth animation
            setTimeout(() => {
                scrollToResults();
            }, 300);
            
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
                
                // Show success feedback on search button
                showSearchSuccess();
                
                // Auto-scroll to results with smooth animation
                setTimeout(() => {
                    scrollToResults();
                }, 300);
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
    const stationsToSearch = typeof realFuelStations !== 'undefined' ? realFuelStations : [];
    
    console.log(`Searching for ${fuelType} stations within ${radius}km of coordinates:`, coordinates);
    console.log(`Total stations to search:`, stationsToSearch.length);
    
    if (stationsToSearch.length === 0) {
        console.log('No fuel stations data available');
        return [];
    }
    
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
            
            if (!withinRadius && station.distance <= radius + 1) {
                console.log(`Station ${station.name} excluded: distance ${station.distance.toFixed(2)}km > ${radius}km`);
            }
            if (!hasValidPrice && station.distance <= radius) {
                console.log(`Station ${station.name} excluded: no price for ${fuelType}`);
            }
            
            return withinRadius && hasValidPrice;
        })
        .sort((a, b) => a.price - b.price) // Sort by price
        .slice(0, 20); // Limit to 20 results for performance
    
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
    
    console.log('showResults called with', results.length, 'stations');
    
    const tabNavigation = document.getElementById('tabNavigation');
    const resultsCountCompact = document.getElementById('resultsCountCompact');
    const emptyState = document.getElementById('emptyState');
    
    if (results.length === 0) {
        // Hide tab navigation when no results
        tabNavigation.style.display = 'none';
        emptyState.style.display = 'block';
        document.getElementById('stationsList').innerHTML = '';
        updateHeaderWithResults(0);
        return;
    }
    
    // Apply cost calculations to results
    console.log('About to calculate costs for stations:', results.map(s => s.name));
    const resultsWithCosts = calculateCosts(results);
    console.log('Cost calculations completed. Results with costs:', resultsWithCosts.map(s => ({
        name: s.name,
        price: s.price,
        hasCostInfo: !!s.costInfo,
        costDisplay: s.costInfo?.display
    })));
    
    // Show and update tab navigation
    tabNavigation.style.display = 'block';
    resultsCountCompact.textContent = `${results.length} distributori trovati`;
    emptyState.style.display = 'none';
    
    // Update header indicator
    updateHeaderWithResults(results.length);
    
    // Render stations list with cost calculations
    renderStationsList(resultsWithCosts);
    
    // Update map if on map tab
    if (currentTab === 'map') {
        updateMapMarkers(resultsWithCosts);
    }
}

function renderStationsList(results) {
    const container = document.getElementById('stationsList');
    const fuelType = document.getElementById('fuelType').value;
    
    console.log('renderStationsList called with', results.length, 'stations');
    console.log('First station cost info:', results[0]?.costInfo);
    
    if (results.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    const cheapestPrice = Math.min(...results.map(s => parseFloat(s.price.toFixed(3))));
    
    container.innerHTML = results.map((station, index) => {
        const isCheapest = station.price === cheapestPrice;
        const cardClass = isCheapest ? 'station-card best-price' : 'station-card';
        
        // Generate cost info HTML if available
        let costInfoHtml = '';
        if (station.costInfo && station.costInfo.display) {
            console.log(`Rendering cost info for ${station.name}: ${station.costInfo.display}`);
            const costClass = station.costInfo.isBest ? 'cost-info best-deal' : 'cost-info extra-cost';
            const valueClass = station.costInfo.isBest ? 'cost-value best' : 'cost-value extra';
            
            costInfoHtml = `
                <div class="${costClass}">
                    <span class="cost-icon">${station.costInfo.icon}</span>
                    <span class="cost-label">${station.costInfo.label.replace(/\([^)]*\)/, '')}</span>
                    <span class="${valueClass}">${station.costInfo.display}</span>
                </div>
            `;
        } else {
            console.log(`No cost info for ${station.name}:`, station.costInfo);
        }
        
        return `
            <div class="${cardClass}">
                <div class="station-header">
                    <div class="station-name">${station.name}</div>
                    <div class="station-brand">${station.brand}</div>
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
                    </div>
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
        const isCheapest = station.price === cheapestPrice;
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
                        €${station.price.toFixed(2)}/L
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

// Utility function to smooth scroll to results tabs - stops exactly at green bar
function scrollToResults() {
    const tabNavigation = document.getElementById('tabNavigation');
    const resultsSummary = document.querySelector('.results-summary');
    const mobileHeader = document.querySelector('.mobile-header');
    
    if (tabNavigation && tabNavigation.style.display !== 'none') {
        // Calculate header height to offset scroll position
        const headerHeight = mobileHeader ? mobileHeader.offsetHeight : 0;
        
        // Get the exact position of the tab navigation
        const elementPosition = tabNavigation.getBoundingClientRect().top + window.pageYOffset;
        const offsetPosition = elementPosition - headerHeight;
        
        // Smooth scroll with precise positioning to show green bar below fixed header
        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });
        
        // Add attention-grabbing animation to the green summary bar
        if (resultsSummary) {
            setTimeout(() => {
                resultsSummary.style.animation = 'summaryPulse 2s ease-out';
            }, 300); // Small delay for scroll completion
        }
        
        // Subtle highlight for the entire tab navigation
        setTimeout(() => {
            tabNavigation.style.animation = 'tabHighlight 2s ease-out';
        }, 300);
        
        // Clear animations after completion
        setTimeout(() => {
            if (resultsSummary) {
                resultsSummary.style.animation = '';
            }
            tabNavigation.style.animation = '';
        }, 2300);
    }
}

// Utility function to show search success feedback
function showSearchSuccess() {
    const searchBtn = document.getElementById('searchBtn');
    const originalText = searchBtn.innerHTML;
    
    // Temporarily change button to show success
    searchBtn.innerHTML = '<i class="fas fa-check"></i> Risultati Trovati!';
    searchBtn.style.background = 'linear-gradient(45deg, var(--success-color), #00a047)';
    
    // Reset after 2 seconds
    setTimeout(() => {
        searchBtn.innerHTML = originalText;
        searchBtn.style.background = '';
    }, 2000);
}

// Utility function to update header with results indicator
function updateHeaderWithResults(count) {
    const headerSubtitle = document.querySelector('.subtitle');
    const originalSubtitle = 'Trova i distributori più economici';
    
    if (count > 0) {
        // Show results count in header
        headerSubtitle.innerHTML = `
            <div>${originalSubtitle}</div>
            <div style="background: rgba(0, 200, 83, 0.2); 
                        color: var(--success-color); 
                        padding: 4px 12px; 
                        border-radius: 20px; 
                        font-size: 0.85em; 
                        margin-top: 8px; 
                        display: inline-block;">
                ✅ ${count} distributori trovati - <span style="text-decoration: underline; cursor: pointer;" onclick="scrollToResults()">Visualizza</span>
            </div>
        `;
    } else {
        // Reset to original subtitle
        headerSubtitle.textContent = originalSubtitle;
    }
}
