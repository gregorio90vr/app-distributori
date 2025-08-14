// App State
let currentTab = 'list';
let currentResults = [];
let userLocation = null;
let map = null;

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('App initializing...');
    initializeApp();
});

function initializeApp() {
    // Set initial timestamp
    updateHeaderTimestamp();
    
    // Initialize calculation input as hidden
    updateCalculationInput('');
    
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
    
    // Calculation mode change
    document.getElementById('calculationMode').addEventListener('change', function(e) {
        updateCalculationInput(e.target.value);
        // Re-render results with new calculation mode
        if (currentResults.length > 0) {
            renderResults(currentResults);
        }
    });
    
    // Calculation value input
    document.getElementById('calculationValue').addEventListener('input', function() {
        // Re-render results with new calculations if we have results
        if (currentResults.length > 0) {
            renderResults(currentResults);
        }
    });
}

function updateCalculationInput(mode) {
    const inputGroup = document.getElementById('calculationInputGroup');
    const label = document.getElementById('calculationLabel');
    const input = document.getElementById('calculationValue');
    const help = document.getElementById('calculationHelp');
    
    if (mode === '') {
        inputGroup.classList.remove('show');
        input.value = '';
        help.textContent = '💡 Scegli una modalità per calcolare i costi';
        return;
    }
    
    inputGroup.classList.add('show');
    
    if (mode === 'liters') {
        label.innerHTML = '⛽ <i class="fas fa-gas-pump"></i> Quanti litri ti servono?';
        input.placeholder = 'es. 40';
        input.min = '5';
        input.max = '200';
        input.step = '5';
        help.textContent = '💡 Inserisci i litri necessari per il rifornimento';
    } else if (mode === 'budget') {
        label.innerHTML = '💰 <i class="fas fa-euro-sign"></i> Qual è il tuo budget?';
        input.placeholder = 'es. 60';
        input.min = '10';
        input.max = '500';
        input.step = '5';
        help.textContent = '💡 Inserisci quanto vuoi spendere in euro';
    }
}

function updateHeaderTimestamp() {
    const timestampElement = document.getElementById('lastUpdate');
    if (timestampElement) {
        const now = new Date();
        timestampElement.textContent = `Ultimo aggiornamento: ${now.toLocaleDateString('it-IT')} ${now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
    }
}

function switchTab(tab) {
    currentTab = tab;
    
    // Update tab buttons
    document.getElementById('tabList').classList.toggle('active', tab === 'list');
    document.getElementById('tabMap').classList.toggle('active', tab === 'map');
    
    // Update content visibility
    document.getElementById('results-list').classList.toggle('active', tab === 'list');
    document.getElementById('results-map').classList.toggle('active', tab === 'map');
    
    if (tab === 'map' && map) {
        // Trigger map resize after tab switch
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }
}

function showLoading() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

function showError(message) {
    hideLoading();
    alert(`Errore: ${message}`);
}

async function handleSearch() {
    const address = document.getElementById('address').value.trim();
    if (!address) {
        alert('Inserire un indirizzo di ricerca');
        return;
    }
    
    showLoading();
    
    try {
        console.log(`Searching for stations near: ${address}`);
        
        // Geocode the address
        const location = await geocodeAddress(address);
        if (!location) {
            throw new Error('Indirizzo non trovato');
        }
        
        userLocation = location;
        console.log('User location:', userLocation);
        
        // Search nearby fuel stations
        const radius = parseFloat(document.getElementById('radius').value);
        const fuelType = document.getElementById('fuelType').value;
        const sortBy = document.getElementById('sortBy').value;
        
        const stations = searchNearbyStations(location, radius, fuelType);
        const sortedStations = sortStations(stations, sortBy, location);
        
        currentResults = sortedStations;
        renderResults(sortedStations);
        
        console.log(`Found ${sortedStations.length} stations within ${radius}km`);
        hideLoading();
        
    } catch (error) {
        console.error('Search error:', error);
        showError(error.message || 'Errore durante la ricerca');
    }
}

async function getCurrentLocation() {
    if (!navigator.geolocation) {
        alert('Geolocalizzazione non supportata');
        return;
    }
    
    showLoading();
    
    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000
            });
        });
        
        const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
        };
        
        console.log('Got user location:', location);
        
        // Reverse geocode to get address
        const address = await reverseGeocode(location);
        if (address) {
            document.getElementById('address').value = address;
        }
        
        userLocation = location;
        
        // Auto-search with current location
        const radius = parseFloat(document.getElementById('radius').value);
        const fuelType = document.getElementById('fuelType').value;
        const sortBy = document.getElementById('sortBy').value;
        
        const stations = searchNearbyStations(location, radius, fuelType);
        const sortedStations = sortStations(stations, sortBy, location);
        
        currentResults = sortedStations;
        renderResults(sortedStations);
        
        console.log(`Found ${sortedStations.length} stations within ${radius}km of current location`);
        hideLoading();
        
    } catch (error) {
        console.error('Geolocation error:', error);
        showError('Errore nel rilevare la posizione');
    }
}

async function geocodeAddress(address) {
    try {
        console.log(`Geocoding address: ${address}`);
        
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=IT&limit=1&addressdetails=1`,
            {
                headers: {
                    'User-Agent': 'FuelStationFinder/1.0'
                }
            }
        );
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Geocoding response:', data);
        
        if (data && data.length > 0) {
            const result = data[0];
            return {
                lat: parseFloat(result.lat),
                lng: parseFloat(result.lon),
                address: result.display_name
            };
        }
        
        return null;
    } catch (error) {
        console.error('Geocoding error:', error);
        throw new Error('Errore nella geolocalizzazione dell\'indirizzo');
    }
}

async function reverseGeocode(location) {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.lat}&lon=${location.lng}&addressdetails=1`,
            {
                headers: {
                    'User-Agent': 'FuelStationFinder/1.0'
                }
            }
        );
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data && data.display_name) {
            return data.display_name;
        }
        
        return null;
    } catch (error) {
        console.error('Reverse geocoding error:', error);
        return null;
    }
}

function searchNearbyStations(userLocation, radiusKm, fuelType) {
    const nearbyStations = [];
    
    for (const station of fuelStations) {
        const distance = calculateDistance(
            userLocation.lat, userLocation.lng,
            station.latitude, station.longitude
        );
        
        if (distance <= radiusKm) {
            // Find the price for the selected fuel type
            const fuelPrice = station.fuels.find(f => f.type === fuelType);
            if (fuelPrice && fuelPrice.price > 0) {
                nearbyStations.push({
                    ...station,
                    distance: distance,
                    price: fuelPrice.price
                });
            }
        }
    }
    
    return nearbyStations;
}

function sortStations(stations, sortBy, userLocation) {
    return [...stations].sort((a, b) => {
        switch (sortBy) {
            case 'price':
                return a.price - b.price;
            case 'distance':
                return a.distance - b.distance;
            case 'name':
                return a.name.localeCompare(b.name);
            default:
                return a.price - b.price;
        }
    });
}

function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function getCalculationData() {
    const mode = document.getElementById('calculationMode').value;
    const value = parseFloat(document.getElementById('calculationValue').value) || 0;
    
    return { mode, value };
}

function calculateFuelData(station, cheapestPrice) {
    const { mode, value } = getCalculationData();
    
    if (!mode || value <= 0) {
        return null;
    }
    
    let liters, totalCost, cheapestCost, savings;
    
    if (mode === 'liters') {
        // Capacity mode: calculate cost for given liters
        liters = value;
        totalCost = station.price * liters;
        cheapestCost = cheapestPrice * liters;
        savings = totalCost - cheapestCost;
        
        return {
            liters,
            totalCost,
            cheapestCost,
            savings,
            displayText: `${liters}L`
        };
    } else if (mode === 'budget') {
        // Budget mode: calculate liters for given budget
        liters = value / station.price;
        const cheapestLiters = value / cheapestPrice;
        const litersDifference = cheapestLiters - liters;
        totalCost = value;
        cheapestCost = value;
        
        return {
            liters,
            totalCost,
            cheapestCost,
            savings: 0, // In budget mode, cost is fixed
            litersDifference,
            displayText: `€${value}`,
            budgetMode: true
        };
    }
    
    return null;
}

function renderResults(results) {
    renderStationsList(results);
    updateMapMarkers(results);
    
    // Update results count
    const countElement = document.getElementById('resultsCount');
    if (countElement) {
        const { mode, value } = getCalculationData();
        let calculationInfo = '';
        if (mode && value > 0) {
            calculationInfo = mode === 'liters' 
                ? ` con calcolo per ${value}L` 
                : ` con budget €${value}`;
        }
        countElement.textContent = `${results.length} distributori trovati${calculationInfo}`;
    }
}

function renderStationsList(results) {
    const resultsContainer = document.getElementById('stationsList');
    
    if (!results || results.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">Nessun distributore trovato</div>';
        return;
    }
    
    const { mode, value } = getCalculationData();
    const cheapestPrice = Math.min(...results.map(s => s.price));
    
    let stationsHTML = '';
    
    results.forEach((station, index) => {
        const fuelData = calculateFuelData(station, cheapestPrice);
        let costCalculationHTML = '';
        
        if (fuelData) {
            let costClass = '';
            let costText = '';
            
            if (fuelData.budgetMode) {
                // Budget mode: show how many liters you can buy
                if (station.price === cheapestPrice) {
                    costClass = 'best-cost';
                    costText = `💰 ${fuelData.displayText} = ${fuelData.liters.toFixed(1)}L (MASSIMO!)`;
                } else {
                    const litersDiff = fuelData.litersDifference;
                    costClass = 'expensive-cost';
                    costText = `💰 ${fuelData.displayText} = ${fuelData.liters.toFixed(1)}L (-${litersDiff.toFixed(1)}L)`;
                }
            } else {
                // Capacity mode: show total cost
                if (station.price === cheapestPrice) {
                    costClass = 'best-cost';
                    costText = `💰 ${fuelData.displayText} = €${fuelData.totalCost.toFixed(2)} (MIGLIORE!)`;
                } else if (fuelData.savings > 0) {
                    costClass = 'expensive-cost';
                    costText = `💰 ${fuelData.displayText} = €${fuelData.totalCost.toFixed(2)} (+€${fuelData.savings.toFixed(2)})`;
                } else {
                    costText = `💰 ${fuelData.displayText} = €${fuelData.totalCost.toFixed(2)}`;
                }
            }
            
            costCalculationHTML = `<div class="cost-calculation ${costClass}">
                <span class="cost-amount">${costText}</span>
            </div>`;
        }
        
        stationsHTML += `
            <div class="station-card" onclick="highlightStation(${index})">
                <div class="station-header">
                    <h3>${station.name}</h3>
                    <div class="station-price">€${station.price.toFixed(3)}/L</div>
                </div>
                <div class="station-info">
                    <div class="station-address">
                        <i class="fas fa-map-marker-alt"></i>
                        ${station.address}
                    </div>
                    <div class="station-distance">
                        <i class="fas fa-route"></i>
                        ${station.distance.toFixed(1)} km
                    </div>
                </div>
                ${costCalculationHTML}
            </div>
        `;
    });
    
    resultsContainer.innerHTML = stationsHTML;
    
    const calculationInfo = mode && value > 0 
        ? ` with ${mode === 'liters' ? value + 'L' : '€' + value} calculation` 
        : '';
    console.log(`Rendered ${results.length} stations in list view${calculationInfo}`);
}

function initializeMap() {
    // Initialize Leaflet map
    map = L.map('map').setView([45.4642, 9.1900], 10); // Default to Milan
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    console.log('Map initialized');
}

function updateMapMarkers(results) {
    if (!map) return;
    
    // Clear existing markers
    map.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            map.removeLayer(layer);
        }
    });
    
    if (!results || results.length === 0) return;
    
    const { mode, value } = getCalculationData();
    const cheapestPrice = Math.min(...results.map(s => s.price));
    
    // Add user location marker if available
    if (userLocation) {
        L.marker([userLocation.lat, userLocation.lng])
            .addTo(map)
            .bindPopup('📍 La tua posizione')
            .openPopup();
    }
    
    // Add station markers
    const markers = [];
    results.forEach((station, index) => {
        const fuelData = calculateFuelData(station, cheapestPrice);
        let costInfo = '';
        
        if (fuelData) {
            if (fuelData.budgetMode) {
                if (station.price === cheapestPrice) {
                    costInfo = `<div style="color: #00c853; font-weight: bold; margin-top: 8px;">💰 ${fuelData.displayText} = ${fuelData.liters.toFixed(1)}L (MASSIMO!)</div>`;
                } else {
                    const litersDiff = fuelData.litersDifference;
                    costInfo = `<div style="color: #ff1744; margin-top: 8px;">💰 ${fuelData.displayText} = ${fuelData.liters.toFixed(1)}L <small>(-${litersDiff.toFixed(1)}L)</small></div>`;
                }
            } else {
                if (station.price === cheapestPrice) {
                    costInfo = `<div style="color: #00c853; font-weight: bold; margin-top: 8px;">💰 ${fuelData.displayText} = €${fuelData.totalCost.toFixed(2)} (MIGLIORE!)</div>`;
                } else if (fuelData.savings > 0) {
                    costInfo = `<div style="color: #ff1744; margin-top: 8px;">💰 ${fuelData.displayText} = €${fuelData.totalCost.toFixed(2)} <small>(+€${fuelData.savings.toFixed(2)})</small></div>`;
                } else {
                    costInfo = `<div style="color: #666; margin-top: 8px;">💰 ${fuelData.displayText} = €${fuelData.totalCost.toFixed(2)}</div>`;
                }
            }
        }
        
        const popupContent = `
            <div class="map-popup">
                <strong>${station.name}</strong><br>
                <small>${station.address}</small><br>
                <span style="color: #007bff; font-weight: bold;">€${station.price.toFixed(3)}/L</span><br>
                <small>📍 ${station.distance.toFixed(1)} km</small>
                ${costInfo}
            </div>
        `;
        
        const marker = L.marker([station.latitude, station.longitude])
            .addTo(map)
            .bindPopup(popupContent);
        
        markers.push(marker);
    });
    
    // Fit map to show all markers
    if (markers.length > 0) {
        const group = new L.featureGroup(markers);
        if (userLocation) {
            group.addLayer(L.marker([userLocation.lat, userLocation.lng]));
        }
        map.fitBounds(group.getBounds().pad(0.1));
    }
    
    console.log(`Updated map with ${results.length} station markers`);
}

function highlightStation(index) {
    // Switch to map tab and highlight the selected station
    switchTab('map');
    
    // Trigger popup on the corresponding marker
    setTimeout(() => {
        const markers = [];
        map.eachLayer(layer => {
            if (layer instanceof L.Marker) {
                markers.push(layer);
            }
        });
        
        // Skip user location marker (first one)
        if (markers.length > index + 1) {
            markers[index + 1].openPopup();
        }
    }, 200);
}

async function handleDataUpdate() {
    showLoading();
    
    try {
        // In a real implementation, this would trigger the Python script
        // For now, we'll just show a message
        alert('Funzionalità di aggiornamento dati non ancora implementata.\n\nEsegui manualmente:\npython update_mimit_data.py');
        hideLoading();
        
    } catch (error) {
        console.error('Update error:', error);
        showError('Errore durante l\'aggiornamento dei dati');
    }
}
