#!/usr/bin/env python3
"""
MIMIT Data Updater for Static App
Downloads MIMIT fuel data and updates data.js for the static web app
"""

import json
import os
import sys
import requests
import pandas as pd
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import tempfile
import math

class MIMITDataUpdater:
    """Downloads MIMIT data and converts it for the static web app"""
    
    def __init__(self, output_dir: str = "."):
        self.output_dir = Path(output_dir)
        
        # MIMIT data URLs
        self.stations_url = "https://www.mise.gov.it/images/exportCSV/anagrafica_impianti_attivi.csv"
        self.prices_url = "https://www.mise.gov.it/images/exportCSV/prezzo_alle_8.csv"
        
        # Output file
        self.data_js_file = self.output_dir / "data.js"

    def calculate_distance(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """Calculate distance between two points using Haversine formula"""
        R = 6371  # Earth's radius in kilometers
        
        dlat = math.radians(lat2 - lat1)
        dlng = math.radians(lng2 - lng1)
        
        a = (math.sin(dlat/2) * math.sin(dlat/2) +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
             math.sin(dlng/2) * math.sin(dlng/2))
        
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        distance = R * c
        
        return distance

    def download_csv(self, url: str, description: str) -> Optional[pd.DataFrame]:
        """Download and parse CSV from MIMIT"""
        print(f"📥 Downloading {description}...")
        
        try:
            response = requests.get(url, timeout=60)
            response.raise_for_status()
            
            print(f"Response size: {len(response.text)} characters")
            
            # Save to temporary file
            with tempfile.NamedTemporaryFile(mode='w+', delete=False, suffix='.csv', encoding='utf-8') as tmp:
                tmp.write(response.text)
                tmp_path = tmp.name
            
            # Check first few lines to understand format
            with open(tmp_path, 'r', encoding='utf-8') as f:
                first_lines = [f.readline().strip() for _ in range(3)]
                print(f"First 3 lines of {description}:")
                for i, line in enumerate(first_lines):
                    print(f"  {i+1}: {line[:100]}...")  # Truncate long lines
            
            # Read with pandas
            df = pd.read_csv(
                tmp_path,
                sep=';',
                skiprows=1,  # Skip metadata line
                encoding='utf-8',
                dtype=str,  # Read all as strings first
                on_bad_lines='skip'
            )
            
            # Cleanup temp file
            os.unlink(tmp_path)
            
            print(f"✅ Downloaded {len(df)} records for {description}")
            print(f"Columns: {df.columns.tolist()}")
            
            return df
            
        except Exception as e:
            print(f"❌ Error downloading {description}: {e}")
            return None

    def process_stations(self, df_stations: pd.DataFrame) -> List[Dict]:
        """Process stations DataFrame into standardized format"""
        print("🏪 Processing stations data...")
        
        stations = []
        errors = 0
        
        for _, row in df_stations.iterrows():
            try:
                # Clean and validate coordinates
                lat_str = str(row.get('Latitudine', '')).strip().replace(',', '.')
                lon_str = str(row.get('Longitudine', '')).strip().replace(',', '.')
                
                if lat_str and lon_str and lat_str != 'nan' and lon_str != 'nan':
                    try:
                        latitude = float(lat_str)
                        longitude = float(lon_str)
                    except (ValueError, TypeError):
                        errors += 1
                        continue
                        
                    # Validate coordinate ranges for Italy
                    if not (35.0 <= latitude <= 47.0 and 6.0 <= longitude <= 19.0):
                        errors += 1
                        continue
                        
                    station = {
                        'id': str(row.get('idImpianto', '')).strip(),
                        'name': str(row.get('Gestore', '')).strip(),
                        'brand': str(row.get('Bandiera', '')).strip(),
                        'address': str(row.get('Indirizzo', '')).strip(),
                        'municipality': str(row.get('Comune', '')).strip(),
                        'province': str(row.get('Provincia', '')).strip(),
                        'latitude': latitude,
                        'longitude': longitude
                    }
                    stations.append(station)
                else:
                    errors += 1
                    
            except Exception as e:
                errors += 1
                continue
        
        print(f"✅ Processed {len(stations)} valid stations ({errors} errors)")
        return stations

    def process_prices(self, df_prices: pd.DataFrame) -> Dict[str, Dict]:
        """Process prices DataFrame into station_id -> fuel_prices mapping"""
        print("💰 Processing prices data...")
        print(f"Columns in prices DataFrame: {df_prices.columns.tolist()}")
        
        prices = {}
        errors = 0
        processed_records = 0
        
        # Try to identify correct column names (case-insensitive)
        columns = [col.lower() for col in df_prices.columns]
        
        # Find ID column
        id_col = None
        for col in df_prices.columns:
            if 'idimpianto' in col.lower() or 'id' in col.lower():
                id_col = col
                break
        
        # Find fuel description column
        fuel_col = None
        for col in df_prices.columns:
            if 'carburante' in col.lower() or 'desc' in col.lower():
                fuel_col = col
                break
        
        # Find price column
        price_col = None
        for col in df_prices.columns:
            if 'prezzo' in col.lower() or 'price' in col.lower():
                price_col = col
                break
        
        print(f"Using columns - ID: {id_col}, Fuel: {fuel_col}, Price: {price_col}")
        
        if not id_col or not fuel_col or not price_col:
            print("❌ Could not identify required columns")
            return {}
        
        for _, row in df_prices.iterrows():
            try:
                station_id = str(row.get(id_col, '')).strip()
                if not station_id:
                    errors += 1
                    continue
                
                # Get fuel type and price
                fuel_desc = str(row.get(fuel_col, '')).strip()
                price_str = str(row.get(price_col, '')).strip().replace(',', '.')
                
                if not fuel_desc or not price_str or price_str == 'nan':
                    errors += 1
                    continue
                
                try:
                    price = float(price_str)
                    if price <= 0:  # Invalid price
                        errors += 1
                        continue
                except (ValueError, TypeError):
                    errors += 1
                    continue
                
                # Map fuel descriptions to standard fuel types
                fuel_type = None
                fuel_desc_lower = fuel_desc.lower()
                
                if 'benzina' in fuel_desc_lower:
                    fuel_type = 'Benzina'
                elif 'gasolio' in fuel_desc_lower or 'diesel' in fuel_desc_lower:
                    fuel_type = 'Gasolio'
                elif 'gpl' in fuel_desc_lower:
                    fuel_type = 'GPL'
                elif 'metano' in fuel_desc_lower:
                    fuel_type = 'Metano'
                
                if fuel_type:
                    # Initialize station if not exists
                    if station_id not in prices:
                        prices[station_id] = {}
                    
                    # Keep the best (lowest) price for each fuel type
                    if fuel_type not in prices[station_id] or price < prices[station_id][fuel_type]:
                        prices[station_id][fuel_type] = price
                        processed_records += 1
                
            except Exception as e:
                errors += 1
                continue
        
        print(f"✅ Processed {processed_records} price records for {len(prices)} stations ({errors} errors)")
        if prices:
            sample_fuels = set([fuel for station_prices in list(prices.values())[:5] for fuel in station_prices.keys()])
            print(f"Sample fuel types found: {sample_fuels}")
        
        return prices

    def merge_data(self, stations: List[Dict], prices: Dict[str, Dict]) -> List[Dict]:
        """Merge stations with prices and prepare for JavaScript"""
        print("🔄 Merging stations with prices...")
        
        merged_stations = []
        
        for station in stations:
            station_id = station['id']
            station_prices = prices.get(station_id, {})
            
            if station_prices:  # Only include stations with prices
                station_data = {
                    'id': int(station_id) if station_id.isdigit() else hash(station_id) % 1000000,
                    'name': station['name'] or 'Stazione Sconosciuta',
                    'brand': station['brand'] or 'N/A',
                    'address': f"{station['address']}, {station['municipality']}".strip(', '),
                    'latitude': station['latitude'],
                    'longitude': station['longitude'],
                    'prices': station_prices
                }
                merged_stations.append(station_data)
        
        print(f"✅ Merged {len(merged_stations)} stations with prices")
        return merged_stations

    def filter_italy_region(self, stations: List[Dict], center_lat: float = 41.9028, 
                           center_lng: float = 12.4964, max_distance: float = 1000) -> List[Dict]:
        """Filter stations to reasonable distance from Italy center (Rome)"""
        print(f"🇮🇹 Filtering stations within {max_distance}km of Italy...")
        
        filtered_stations = []
        for station in stations:
            distance = self.calculate_distance(
                center_lat, center_lng,
                station['latitude'], station['longitude']
            )
            
            if distance <= max_distance:
                filtered_stations.append(station)
        
        print(f"✅ Kept {len(filtered_stations)} stations within Italy")
        return filtered_stations

    def generate_data_js(self, stations: List[Dict]) -> str:
        """Generate JavaScript code for data.js"""
        print("📝 Generating JavaScript code...")
        
        # Get current timestamp
        now = datetime.now()
        timestamp = now.strftime("%d/%m/%Y %H:%M")
        
        # Generate JavaScript
        js_code = f'''// Real fuel station data from MIMIT
// Last updated: {timestamp}
// Total stations: {len(stations)}

const DATA_TIMESTAMP = "{timestamp}";

const realFuelStations = {json.dumps(stations, indent=2, ensure_ascii=False)};

// Sample data for demo (kept for fallback)
const sampleFuelStations = [
    {{
        id: 1,
        name: "Stazione Eni",
        brand: "Eni",
        address: "Via Roma 123, Milano",
        latitude: 45.4642,
        longitude: 9.1900,
        prices: {{
            "Benzina": 1.65,
            "Gasolio": 1.55,
            "GPL": 0.75,
            "Metano": 1.25
        }}
    }},
    // ... other sample stations remain the same
];

// Use real data if available, fallback to sample
const fuelStationsData = realFuelStations.length > 0 ? realFuelStations : sampleFuelStations;

// Get current timestamp for data freshness
function getCurrentTimestamp() {{
    const now = new Date();
    return now.toLocaleDateString('it-IT') + ' ' + now.toLocaleTimeString('it-IT', {{ 
        hour: '2-digit', 
        minute: '2-digit' 
    }});
}}

// Return data update timestamp
function updateDataTimestamp() {{
    return "Dati aggiornati: {timestamp}";
}}

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {{
    module.exports = {{ fuelStationsData, getCurrentTimestamp, updateDataTimestamp }};
}}'''

        return js_code

    async def update_data(self) -> bool:
        """Main function to update data"""
        print("🚀 Starting MIMIT data update...")
        
        try:
            # Download data
            df_stations = self.download_csv(self.stations_url, "stations data")
            if df_stations is None:
                return False
            
            df_prices = self.download_csv(self.prices_url, "prices data")
            if df_prices is None:
                return False
            
            # Process data
            stations = self.process_stations(df_stations)
            if not stations:
                print("❌ No valid stations processed")
                return False
            
            prices = self.process_prices(df_prices)
            if not prices:
                print("❌ No valid prices processed")
                print("Debug info:")
                print(f"  - Prices DataFrame shape: {df_prices.shape}")
                print(f"  - Prices DataFrame columns: {df_prices.columns.tolist()}")
                if len(df_prices) > 0:
                    print(f"  - First price row: {df_prices.iloc[0].to_dict()}")
                return False
            
            # Merge and filter data
            merged_stations = self.merge_data(stations, prices)
            filtered_stations = self.filter_italy_region(merged_stations)
            
            if not filtered_stations:
                print("❌ No stations remain after filtering")
                return False
            
            # Generate JavaScript code
            js_code = self.generate_data_js(filtered_stations)
            
            # Write to file
            print(f"💾 Writing data to {self.data_js_file}...")
            with open(self.data_js_file, 'w', encoding='utf-8') as f:
                f.write(js_code)
            
            print(f"✅ Successfully updated data.js with {len(filtered_stations)} stations!")
            print(f"📁 File saved: {self.data_js_file}")
            return True
            
        except Exception as e:
            print(f"❌ Error during update: {e}")
            import traceback
            traceback.print_exc()
            return False

def main():
    """Main entry point"""
    # Check if we're in the right directory
    if not Path("index.html").exists():
        print("❌ Error: index.html not found. Please run this script in the app-statica directory.")
        sys.exit(1)
    
    print("🔄 MIMIT Data Updater for Static App")
    print("=" * 50)
    
    updater = MIMITDataUpdater()
    
    # Use asyncio.run for Python 3.7+, or create event loop for older versions
    import asyncio
    
    try:
        success = asyncio.run(updater.update_data())
    except AttributeError:
        # Fallback for Python < 3.7
        loop = asyncio.get_event_loop()
        success = loop.run_until_complete(updater.update_data())
    
    if success:
        print("🎉 Data update completed successfully!")
        print("🌐 You can now commit and push the updated data.js to GitHub Pages")
    else:
        print("💥 Data update failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()
