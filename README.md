# FuelFinder Mobile - Versione Statica

Questa è la versione statica dell'app FuelFinder Mobile, convertita per essere ospitata su GitHub Pages o qualsiasi altro hosting statico.

## 🚀 Caratteristiche

- **Mobile-First Design**: Ottimizzato per dispositivi mobili
- **Geolocalizzazione**: Utilizza il GPS del dispositivo per trovare la posizione attuale
- **Mappe Interattive**: Powered by Leaflet.js e OpenStreetMap
- **Calcolo Distanze**: Calcolo automatico delle distanze utilizzando la formula Haversine
- **Design Responsivo**: Si adatta a tutti i dispositivi
- **Offline-Ready**: Funziona dopo il primo caricamento (tranne per le mappe)

## 📁 Struttura Files

```
app-statica/
├── index.html             # Pagina principale
├── styles.css             # Stili CSS mobile-first
├── app.js                # Logica JavaScript principale
├── data.js               # Dati MIMIT aggiornati automaticamente
├── update_mimit_data.py  # Script per aggiornamento dati
├── requirements.txt      # Dipendenze Python
├── .github/workflows/    # GitHub Actions automazione
│   └── update-data.yml   # Workflow aggiornamento automatico
└── README.md             # Questo file
```

## 🛠️ Tecnologie Utilizzate

- **HTML5**: Struttura semantica
- **CSS3**: Design moderno con variabili CSS e responsive design
- **JavaScript ES6+**: Logica dell'app con async/await
- **Leaflet.js**: Libreria per mappe interattive
- **OpenStreetMap**: Provider di mappe gratuito
- **Font Awesome**: Icone moderne
- **Geolocation API**: Rilevamento posizione utente

## 🌐 Deploy su GitHub Pages

1. **Crea un nuovo repository** su GitHub
2. **Carica tutti i file** della cartella `app-statica`
3. **Abilita GitHub Pages**:
   - Vai su Settings > Pages
   - Seleziona "Deploy from a branch"
   - Scegli "main" branch e "/ (root)"
4. **Accedi all'app** all'URL: `https://username.github.io/repository-name`

## 📱 Funzionalità Mobile

- **Touch-Friendly**: Interfaccia ottimizzata per touch screen
- **Responsive**: Si adatta a tutte le dimensioni dello schermo
- **PWA-Ready**: Meta tags per Progressive Web App
- **Geolocation**: Accesso alla posizione del dispositivo
- **Offline**: Funziona offline dopo il primo caricamento

## 🔧 Personalizzazione

### Aggiungere Dati Reali

Per utilizzare dati reali invece dei dati simulati, modifica il file `data.js`:

```javascript
// Sostituisci sampleFuelStations con chiamate API reali
async function searchFuelStations(coordinates, radius, fuelType) {
    const response = await fetch(`/api/fuel-stations?lat=${coordinates.lat}&lng=${coordinates.lng}&radius=${radius}&fuel=${fuelType}`);
    return await response.json();
}
```

### Personalizzare Stili

Modifica le variabili CSS in `styles.css`:

```css
:root {
    --primary-color: #1a237e;      /* Colore principale */
    --secondary-color: #304ffe;    /* Colore secondario */
    --accent-color: #f50057;       /* Colore accento */
    /* ... altre variabili */
}
```

## � Aggiornamento Automatico dei Dati

### GitHub Actions Automation
L'app include un sistema di aggiornamento automatico dei dati MIMIT tramite GitHub Actions:

- **🕘 Orario**: Ogni giorno alle 9:00 (ora di Roma)
- **📥 Fonte**: Dati ufficiali MIMIT in tempo reale
- **🔧 Script**: `update_mimit_data.py` scarica e processa i dati
- **🚀 Deploy**: Auto-commit e deploy su GitHub Pages

### Come Funziona
1. **GitHub Actions** esegue automaticamente `update_mimit_data.py`
2. **Script Python** scarica i dati MIMIT più recenti
3. **Genera** nuovo file `data.js` con dati aggiornati
4. **Commit automatico** delle modifiche
5. **GitHub Pages** deploy automatico dell'app aggiornata

### Configurazione del Timing
Per modificare l'orario di aggiornamento, edita il file `.github/workflows/update-data.yml`:

```yaml
# Per aggiungere un secondo aggiornamento alle 15:00:
- cron: '0 7,13 * * *'  # 9:00 e 15:00 ora di Roma
```

### Test Manuale
Puoi testare l'aggiornamento manualmente:
- Vai su GitHub → Actions → "Update MIMIT Data" → "Run workflow"

## �🚀 Ottimizzazioni per Produzione

1. **Minificazione**: Usa tools come Terser per JavaScript e cssnano per CSS
2. **Service Worker**: Aggiungi per funzionalità offline avanzate
3. **Lazy Loading**: Carica le mappe solo quando necessario
4. **CDN**: Usa CDN per librerie esterne
5. **Caching**: Imposta headers di cache appropriati

## 📊 Caratteristiche del Sistema

- **Dati Reali**: Utilizza dati ufficiali MIMIT aggiornati automaticamente
- **Geocoding**: Simulato (in produzione usare servizi come MapBox o Google)  
- **Aggiornamenti**: Automatici tramite GitHub Actions (9:00 ogni giorno)

## 📋 Licenze e Attribuzione

### Dati MIMIT
- **Fonte**: [MIMIT - Ministero delle Imprese e del Made in Italy](https://www.mise.gov.it/index.php/it/open-data/elenco-dataset/2032336-carburanti-prezzi-praticati-e-anagrafica-degli-impianti)
- **Licenza**: [Italian Open Data License v2.0 (IODL 2.0)](https://www.dati.gov.it/content/italian-open-data-license-v20)
- **Diritti**: Uso commerciale e non commerciale permesso, distribuzione e modifica consentite
- **Attribuzione**: Come richiesto dalla licenza IODL 2.0, l'app include l'attribuzione della fonte

### Software
- **Licenza**: Codice sorgente dell'applicazione (esclusi i dati MIMIT)
- **Librerie**: Leaflet.js (BSD-2-Clause), FontAwesome (SIL OFL 1.1)

## 🔮 Possibili Miglioramenti

1. **Service Worker** per funzionalità offline complete
2. **IndexedDB** per cache dei dati locale
3. **Push Notifications** per aggiornamenti prezzi
4. **Dark Mode** automatico basato su preferenze sistema
5. **Installazione PWA** con manifest.json

## 📞 Supporto

Per supporto o domande, apri un issue nel repository GitHub.

---

**Nota**: Questa è una versione statica ottimizzata per GitHub Pages. Per funzionalità complete con dati in tempo reale, considera l'uso di un backend API.
