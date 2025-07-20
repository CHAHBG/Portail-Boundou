/**
 * Portail Boundou – Application principale avec couche SIG réelle
 * Version complète avec filtres avancés et synchronisation bidirectionnelle
 */

/***************** CONFIGURATION *****************/
const DATA_URL = "https://raw.githubusercontent.com/CHAHBG/Portail-Boundou/main/data/parcelles.json";
const BUILD_HOOK = "https://api.netlify.com/build_hooks/67392b51c5c2b40008fa6dd3";

// Configuration SIG
const GIS_CONFIG = {
    COMMUNES_GEOJSON_URL: "https://raw.githubusercontent.com/CHAHBG/Portail-Boundou/main/data/communes_boundou.geojson",
    WMS_URL: "https://votre-geoserver.com/geoserver/wms",
    WORKSPACE: "boundou",
    LAYER_NAME: "communes"
};

/***************** UTILITAIRES *****************/
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const formatNumber = d3.format(",.0f");
const formatDecimal = d3.format(",.1f");

/***************** VARIABLES GLOBALES *****************/
let rawData = [];
let ndx, regionDim, communeDim, villageDim, statutDim, superficieDim, parcellesDim;
let statusChart, pieChart;
let leafletMap, choroLayer, mapInitialized = false;
let superficieSlider, superficieRange = [0, 1000];
const currentKPIValues = { parcelles: 0, superficie: 0, nicad: 0, deliberees: 0 };

/***************** INITIALISATION *****************/
document.addEventListener("DOMContentLoaded", async () => {
    try {
        showLoadingOverlay();
        createParticles();
        await loadData();
        setupCrossfilter();
        await initializeBoundouGIS();
        attachEventHandlers();
        hideLoadingOverlay();
        showToast("Portail Boundou initialisé avec succès", "success");
    } catch (err) {
        console.error("Erreur d'initialisation:", err);
        hideLoadingOverlay();
        showToast("Erreur d'initialisation", "error");
    }
});

/***************** CHARGEMENT DES DONNÉES *****************/
async function loadData() {
    try {
        const res = await fetch(DATA_URL);
        if (!res.ok) throw new Error("Network response not ok");
        const data = await res.json();
        rawData = data.map(d => ({
            region: d.region || "",
            commune: d.commune || "",
            village: d.village || "",
            parcelles: +d.parcelles || 0,
            superficie: +d.superficie || 0,
            nicad: +d.nicad || 0,
            deliberees: +d.deliberees || 0,
            lat: +d.lat || 0,
            lng: +d.lng || 0,
            statut: d.statut || "En attente"
        }));
        const superficies = rawData.map(d => d.superficie / 10000).filter(s => s > 0);
        superficieRange = [
            Math.floor(Math.min(...superficies)),
            Math.ceil(Math.max(...superficies))
        ];
        console.log(`Données chargées: ${rawData.length} enregistrements`);
    } catch (err) {
        console.error("Erreur loadData():", err);
        // Fallback: données de démonstration
        rawData = [
            { region: "Kédougou", commune: "MISSIRAH", village: "Missirah Centre", parcelles: 1250, superficie: 4507500, nicad: 625, deliberees: 312, lat: 12.5597, lng: -12.2053, statut: "En attente" },
            { region: "Kédougou", commune: "BANDAFASSI", village: "Bandafassi Sud", parcelles: 890, superficie: 3205000, nicad: 445, deliberees: 267, lat: 12.533, lng: -12.3167, statut: "Délibérée" },
            { region: "Tambacounda", commune: "NETTEBOULOU", village: "Netteboulou Ouest", parcelles: 675, superficie: 1802500, nicad: 324, deliberees: 145, lat: 13.7667, lng: -13.6667, statut: "En attente" },
            { region: "Tambacounda", commune: "FONGOLIMBI", village: "Fongolimbi Est", parcelles: 540, superficie: 2758000, nicad: 432, deliberees: 401, lat: 13.8234, lng: -13.789, statut: "Délibérée" },
            { region: "Kédougou", commune: "DIMBOLI", village: "Dimboli Nord", parcelles: 425, superficie: 954000, nicad: 201, deliberees: 0, lat: 12.4789, lng: -12.2456, statut: "Litige" },
            { region: "Tambacounda", commune: "BALA", village: "Bala Centre", parcelles: 780, superficie: 1956000, nicad: 390, deliberees: 234, lat: 13.9567, lng: -13.4523, statut: "Délibérée" },
            { region: "Kédougou", commune: "SALEMATA", village: "Salemata Est", parcelles: 650, superficie: 2145000, nicad: 325, deliberees: 0, lat: 12.8934, lng: -12.1678, statut: "Litige" }
        ];
        superficieRange = [95, 451];
        showToast("Données de démonstration chargées", "warning");
    }
}

/***************** CROSSFILTER *****************/
function setupCrossfilter() {
    ndx = crossfilter(rawData);
    regionDim    = ndx.dimension(d => d.region);
    communeDim   = ndx.dimension(d => d.commune);
    villageDim   = ndx.dimension(d => d.village);
    typeUsagDim  = ndx.dimension(d => d.type_usag);
    superficieDim= ndx.dimension(d => d.superficie / 10000);
    parcellesDim = ndx.dimension(d => d.parcelles);
}

/***************** INITIALISATION GIS *****************/
async function initializeBoundouGIS() {
    createAdvancedFilters();
    createKPICards();
    createCharts();
    if ($('#mapContainer')) {
        initializeMap();
        await loadRealGISLayer();
        enhanceSynchronization();
    }
    updateAllVisualizations();
    setupIntersectionObserver();
}

/***************** FILTRES AVANCÉS *****************/
function createAdvancedFilters() {
    const container = $("#filters");
    container.innerHTML = `
        <div class="filters-grid">
            <!-- Filtre Région -->
            <div class="filter-group">
                <label for="regionSelect">
                    <span class="filter-icon">🗺️</span>
                    Région
                </label>
                <select id="regionSelect" class="form-control">
                    <option value="">Toutes les régions</option>
                </select>
            </div>
            
            <!-- Filtre Communes (multiple) -->
            <div class="filter-group">
                <label for="communeSelect">
                    <span class="filter-icon">🏛️</span>
                    Communes
                    <span class="filter-count" id="communeCount"></span>
                </label>
                <select id="communeSelect" class="form-control" multiple>
                </select>
            </div>
            
            <!-- Filtre Villages (multiple) -->
            <div class="filter-group">
                <label for="villageSelect">
                    <span class="filter-icon">🏘️</span>
                    Villages
                    <span class="filter-count" id="villageCount"></span>
                </label>
                <select id="villageSelect" class="form-control" multiple>
                </select>
            </div>
            
            <!-- Filtre Statut (checkboxes) -->
            <div class="filter-group">
                <label>
                    <span class="filter-icon">📊</span>
                    Statut des parcelles
                </label>
                <div class="checkbox-group">
                    <label class="checkbox-item">
                        <input type="checkbox" id="statutDeliberee" value="Délibérée" checked>
                        <span class="checkmark"></span>
                        Délibérées
                    </label>
                    <label class="checkbox-item">
                        <input type="checkbox" id="statutAttente" value="En attente" checked>
                        <span class="checkmark"></span>
                        En attente
                    </label>
                    <label class="checkbox-item">
                        <input type="checkbox" id="statutLitige" value="Litige" checked>
                        <span class="checkmark"></span>
                        Litiges
                    </label>
                </div>
            </div>
            
            <!-- Range Slider Superficie -->
            <div class="filter-group">
                <label>
                    <span class="filter-icon">📏</span>
                    Superficie (hectares)
                </label>
                <div class="range-container">
                    <div id="superficieSlider" class="range-slider"></div>
                    <div class="range-values">
                        <span id="superficieMin">0</span> - 
                        <span id="superficieMax">1000</span> ha
                    </div>
                </div>
            </div>
            
            <!-- Filtre Parcelles (range) -->
            <div class="filter-group">
                <label>
                    <span class="filter-icon">📦</span>
                    Nombre de parcelles
                </label>
                <div class="range-container">
                    <input type="range" id="parcellesRange" class="form-range" 
                           min="0" max="2000" step="50" value="2000">
                    <div class="range-values">
                        Min: <span id="parcellesValue">2000</span> parcelles
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Actions -->
        <div class="filter-actions">
            <button id="resetFilters" class="btn btn-outline">
                <span>🔄</span> Réinitialiser
            </button>
            <button id="saveFilters" class="btn btn-primary">
                <span>💾</span> Sauvegarder
            </button>
            <button id="loadFilters" class="btn btn-outline">
                <span>📂</span> Charger
            </button>
        </div>
    `;
    
    setupAdvancedFilterHandlers();
    populateFilterOptions();
    createSuperficieSlider();
}

function populateFilterOptions() {
    const regions = [...new Set(rawData.map(d => d.region))].sort();
    const communes = [...new Set(rawData.map(d => d.commune))].sort();
    const villages = [...new Set(rawData.map(d => d.village))].sort();
    
    // Populate région select
    const regionSelect = $('#regionSelect');
    regions.forEach(region => {
        const option = document.createElement('option');
        option.value = region;
        option.textContent = region;
        regionSelect.appendChild(option);
    });
    
    // Populate communes select
    const communeSelect = $('#communeSelect');
    communes.forEach(commune => {
        const option = document.createElement('option');
        option.value = commune;
        option.textContent = commune;
        communeSelect.appendChild(option);
    });
    
    // Populate villages select
    const villageSelect = $('#villageSelect');
    villages.forEach(village => {
        const option = document.createElement('option');
        option.value = village;
        option.textContent = village;
        villageSelect.appendChild(option);
    });
}

function setupAdvancedFilterHandlers() {
    // Region filter
    $('#regionSelect')?.addEventListener('change', handleRegionChange);
    
    // Commune filter
    $('#communeSelect')?.addEventListener('change', handleCommuneChange);
    
    // Village filter
    $('#villageSelect')?.addEventListener('change', handleVillageChange);
    
    // Statut checkboxes
    $$('input[type="checkbox"][id^="statut"]').forEach(checkbox => {
        checkbox.addEventListener('change', handleStatutFilter);
    });
    
    // Range slider parcelles
    $('#parcellesRange')?.addEventListener('input', handleParcellesRangeChange);
    
    // Boutons actions
    $('#resetFilters')?.addEventListener('click', resetAllFilters);
    $('#saveFilters')?.addEventListener('click', saveCurrentFilters);
    $('#loadFilters')?.addEventListener('click', loadSavedFilters);
}

function handleRegionChange(event) {
    const selectedRegion = event.target.value;
    
    regionDim.filterAll();
    if (selectedRegion) {
        regionDim.filterExact(selectedRegion);
        // Update communes and villages based on region
        updateDependentSelects();
    }
    
    updateAllVisualizations();
    updateFilterCounts();
}

function handleCommuneChange(event) {
    const selectedCommunes = Array.from(event.target.selectedOptions).map(o => o.value);
    
    communeDim.filterAll();
    if (selectedCommunes.length > 0) {
        communeDim.filterFunction(d => selectedCommunes.includes(d));
    }
    
    updateAllVisualizations();
    updateFilterCounts();
}

function handleVillageChange(event) {
    const selectedVillages = Array.from(event.target.selectedOptions).map(o => o.value);
    
    villageDim.filterAll();
    if (selectedVillages.length > 0) {
        villageDim.filterFunction(d => selectedVillages.includes(d));
    }
    
    updateAllVisualizations();
    updateFilterCounts();
}

function handleStatutFilter() {
    const checkedStatuts = Array.from($$('input[type="checkbox"][id^="statut"]:checked'))
        .map(cb => cb.value);
    
    statutDim.filterAll();
    if (checkedStatuts.length > 0 && checkedStatuts.length < 3) {
        statutDim.filterFunction(d => checkedStatuts.includes(d));
    }
    
    updateAllVisualizations();
    updateFilterCounts();
}

function handleParcellesRangeChange(event) {
    const maxParcelles = parseInt(event.target.value);
    const valueSpan = $('#parcellesValue');
    if (valueSpan) valueSpan.textContent = maxParcelles;
    
    parcellesDim.filterRange([0, maxParcelles]);
    updateAllVisualizations();
    showToast(`Parcelles max: ${maxParcelles}`, 'info');
}

// --- 2. Adapter le gestionnaire de filtres pour type_usag ---
function handleTypeUsagFilter() {
  const checked = Array.from($$('input[type="checkbox"][name="typeUsag"]:checked'))
                       .map(cb => cb.value);
  typeUsagDim.filterAll();
  if (checked.length) {
    typeUsagDim.filterFunction(v => checked.includes(v));
  }
  updateAllVisualizations();
}

function updateDependentSelects() {
    const filteredData = ndx.allFiltered();
    
    // Update communes based on current filters
    const availableCommunes = [...new Set(filteredData.map(d => d.commune))].sort();
    const communeSelect = $('#communeSelect');
    communeSelect.innerHTML = '';
    availableCommunes.forEach(commune => {
        const option = document.createElement('option');
        option.value = commune;
        option.textContent = commune;
        communeSelect.appendChild(option);
    });
    
    // Update villages based on current filters
    const availableVillages = [...new Set(filteredData.map(d => d.village))].sort();
    const villageSelect = $('#villageSelect');
    villageSelect.innerHTML = '';
    availableVillages.forEach(village => {
        const option = document.createElement('option');
        option.value = village;
        option.textContent = village;
        villageSelect.appendChild(option);
    });
}

function updateFilterCounts() {
    const communeCount = $('#communeCount');
    const villageCount = $('#villageCount');
    
    if (communeCount) {
        const selectedCommunes = Array.from($('#communeSelect').selectedOptions).length;
        communeCount.textContent = selectedCommunes > 0 ? `(${selectedCommunes})` : '';
    }
    
    if (villageCount) {
        const selectedVillages = Array.from($('#villageSelect').selectedOptions).length;
        villageCount.textContent = selectedVillages > 0 ? `(${selectedVillages})` : '';
    }
}

function resetAllFilters() {
    // Reset crossfilter dimensions
    regionDim.filterAll();
    communeDim.filterAll();
    villageDim.filterAll();
    statutDim.filterAll();
    superficieDim.filterAll();
    parcellesDim.filterAll();
    
    // Reset UI elements
    $('#regionSelect').value = '';
    $('#communeSelect').selectedIndex = -1;
    $('#villageSelect').selectedIndex = -1;
    $$('input[type="checkbox"][id^="statut"]').forEach(cb => cb.checked = true);
    
    if ($('#parcellesRange')) $('#parcellesRange').value = 2000;
    if ($('#parcellesValue')) $('#parcellesValue').textContent = '2000';
    
    if (superficieSlider) {
        superficieSlider.set([superficieRange[0], superficieRange[1]]);
    }
    
    populateFilterOptions();
    updateAllVisualizations();
    updateFilterCounts();
    showToast('Filtres réinitialisés', 'success');
}

/***************** COUCHE SIG RÉELLE *****************/
async function loadRealGISLayer() {
    try {
        const resp = await fetch(GIS_CONFIG.COMMUNES_GEOJSON_URL);
        if (!resp.ok) throw new Error("Impossible de charger le GeoJSON");
        const geojson = await resp.json();
        if (choroLayer) leafletMap.removeLayer(choroLayer);
        choroLayer = L.geoJSON(geojson, {
            style: getPolygonStyle,
            onEachFeature: onCommuneFeature
        }).addTo(leafletMap);
        leafletMap.fitBounds(choroLayer.getBounds());
        showToast("Couche SIG réelle chargée", "success");
    } catch (error) {
        console.error("Erreur chargement SIG:", error);
        showToast("Erreur couche SIG - utilisation synthétique", "warning");
        createSyntheticPolygons();
    }
}

/***************** STYLE & INTERACTION DES POLYGONES *****************/
function getPolygonStyle(feature) {
  // Remplacez feature.properties.NOM par le bon champ, ici CCRCA
  const communeName = feature.properties.CCRCA;
  const dataCommune = ndx.allFiltered().filter(d => d.commune === communeName);
  const total = d3.sum(dataCommune, d => d.parcelles);
  const maxAll = d3.max(rawData, d => d.parcelles) || 1;
  const intensity = Math.min(total / maxAll, 1);
  return {
    fillColor: chroma.mix('#E3F2FD','#1565C0', intensity).hex(),
    weight: 2, color: 'white', fillOpacity: 0.7
  };
}

function onCommuneFeature(feature, layer) {
    const name = feature.properties.NOM || feature.properties.COMMUNE || feature.properties.name;
    const data = rawData.filter(d => d.commune === name);
    if (!data.length) return;
    const stats = {
        parcelles: d3.sum(data, d => d.parcelles),
        superficie: d3.sum(data, d => d.superficie) / 10000,
        nicad: d3.sum(data, d => d.nicad),
        deliberees: d3.sum(data, d => d.deliberees),
        villages: new Set(data.map(d => d.village)).size
    };
    layer.bindPopup(createUpdatedPopup(name, stats));
    layer.on({ mouseover: highlightFeature, mouseout: resetHighlight, click: () => filterByCommune(name) });
}


function createUpdatedPopup(commune, stats) {
    return `
        <div class="commune-popup updated">
            <h4>${commune}</h4>
            <div class="popup-stats">
                <div>📦 ${formatNumber(stats.parcelles)} parcelles</div>
                <div>📏 ${formatDecimal(stats.superficie)} ha</div>
                <div>📋 ${formatNumber(stats.nicad)} NICAD</div>
                <div>✅ ${formatNumber(stats.deliberees)} délibérées</div>
                <div>🏘️ ${stats.villages} villages</div>
                <div class="taux">📈 ${(stats.deliberees / stats.parcelles * 100).toFixed(1)}% délibérées</div>
            </div>
            <button onclick="filterByCommune('${commune}')" class="popup-filter-btn">
                Filtrer sur cette commune
            </button>
        </div>
    `;
}

function highlightFeature(e) {
    e.target.setStyle({ weight: 4, color: '#1FB8CD', fillOpacity: 0.9 });
    e.target.bringToFront();
}
function resetHighlight(e) {
    if (choroLayer) choroLayer.resetStyle(e.target);
}

function filterByCommune(commune) {
    // Reset autres filtres
    regionDim.filterAll();
    villageDim.filterAll();
    
    // Applique filtre commune
    communeDim.filterExact(commune);
    
    // Met à jour UI
    const communeSelect = $('#communeSelect');
    if (communeSelect) {
        Array.from(communeSelect.options).forEach(option => {
            option.selected = option.value === commune;
        });
    }
    
    updateAllVisualizations();
    updateFilterCounts();
    showToast(`Filtré sur ${commune}`, 'info');
}

/***************** SYNCHRONISATION AVANCÉE *****************/
function enhanceSynchronization() {
    const original = updateMapColors;
    updateMapColors = function() {
        if (!mapInitialized || !choroLayer) return;
        const fd = ndx.allFiltered();
        const statsByCommune = d3.rollup(fd, v => ({
            parcelles: d3.sum(v, d => d.parcelles),
            superficie: d3.sum(v, d => d.superficie),
            nicad: d3.sum(v, d => d.nicad),
            delib: d3.sum(v, d => d.deliberees)
        }), d => d.commune);
        choroLayer.eachLayer(layer => {
            const name = layer.feature.properties.NOM || layer.feature.properties.COMMUNE || layer.feature.properties.name;
            const stats = statsByCommune.get(name);
            if (stats) {
                layer.setStyle(getPolygonStyle(layer.feature));
                layer.setPopupContent(createUpdatedPopup(name, {
                    parcelles: stats.parcelles,
                    superficie: stats.superficie / 10000,
                    nicad: stats.nicad,
                    deliberees: stats.delib,
                    villages: 0
                }));
            } else {
                layer.setStyle({ fillColor: '#f5f5f5', fillOpacity: 0.3, weight: 1, color: '#ccc' });
            }
        });
    };
}

/***************** SAUVEGARDE/CHARGEMENT FILTRES *****************/
function saveCurrentFilters() {
    const filterState = {
        region: $('#regionSelect').value,
        communes: Array.from($('#communeSelect').selectedOptions).map(o => o.value),
        villages: Array.from($('#villageSelect').selectedOptions).map(o => o.value),
        statuts: Array.from($$('input[type="checkbox"][id^="statut"]:checked')).map(cb => cb.value),
        superficie: superficieSlider ? superficieSlider.get() : superficieRange,
        parcelles: $('#parcellesRange') ? $('#parcellesRange').value : null,
        timestamp: new Date().toISOString()
    };
    
    localStorage.setItem('boundou_filters', JSON.stringify(filterState));
    showToast('Filtres sauvegardés', 'success');
}

function loadSavedFilters() {
    try {
        const saved = localStorage.getItem('boundou_filters');
        if (!saved) {
            showToast('Aucun filtre sauvegardé', 'warning');
            return;
        }
        
        const filterState = JSON.parse(saved);
        
        // Restaure les valeurs
        if ($('#regionSelect')) $('#regionSelect').value = filterState.region || '';
        if ($('#parcellesRange')) $('#parcellesRange').value = filterState.parcelles || 2000;
        
        // Restaure les checkboxes statut
        $$('input[type="checkbox"][id^="statut"]').forEach(cb => {
          cb.name = 'typeUsag';
          cb.addEventListener('change', handleTypeUsagFilter);
        });
        
        // Applique les filtres
        handleRegionChange();
        handleStatutFilter();
        if (filterState.parcelles) {
            handleParcellesRangeChange({target: {value: filterState.parcelles}});
        }
        
        showToast(`Filtres du ${new Date(filterState.timestamp).toLocaleDateString()} chargés`, 'success');
        
    } catch (error) {
        console.error('Erreur chargement filtres:', error);
        showToast('Erreur chargement filtres', 'error');
    }
}

/***************** INTERFACE UTILISATEUR *****************/
function createKPICards() {
    const container = $("#kpiContainer");
    const kpis = [
        { key: 'parcelles', title: 'Parcelles Totales', icon: '📦', unit: '', color: 'teal' },
        { key: 'superficie', title: 'Superficie (ha)', icon: '📏', unit: ' ha', color: 'blue' },
        { key: 'nicad', title: 'Parcelles NICAD', icon: '📋', unit: '', color: 'green' },
        { key: 'deliberees', title: 'Parcelles Délibérées', icon: '✅', unit: '', color: 'orange' }
    ];

    container.innerHTML = kpis.map(kpi => `
        <div class="kpi-card">
            <h4>${kpi.icon} ${kpi.title}</h4>
            <div class="kpi-value" id="kpi-${kpi.key}">0</div>
            <div class="kpi-progress">
                <div class="kpi-progress-bar" id="progress-${kpi.key}"></div>
            </div>
        </div>
    `).join('');
}

function createSuperficieSlider() {
    const container = $('#superficieSlider');
    if (!container) return;

    superficieSlider = noUiSlider.create(container, {
        start: [superficieRange[0], superficieRange[1]],
        connect: true,
        range: {
            min: superficieRange[0],
            max: superficieRange[1]
        },
        format: {
            to: value => Math.round(value),
            from: value => Number(value)
        }
    });

    superficieSlider.on('update', (values, handle) => {
        $('#superficieMin').textContent = values[0];
        $('#superficieMax').textContent = values[1];
        
        superficieDim.filterRange([+values[0], +values[1]]);
        updateAllVisualizations();
    });
}

function createCharts() {
    createStatusChart();
    createPieChart();
}

function createStatusChart() {
    const ctx = $('#statusChart');
    if (!ctx) return;

    statusChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Délibérées',
                data: [],
                backgroundColor: 'rgba(34, 197, 94, 0.8)',
                borderColor: 'rgba(34, 197, 94, 1)',
                borderWidth: 1
            }, {
                label: 'En attente',
                data: [],
                backgroundColor: 'rgba(251, 191, 36, 0.8)',
                borderColor: 'rgba(251, 191, 36, 1)',
                borderWidth: 1
            }, {
                label: 'Litiges',
                data: [],
                backgroundColor: 'rgba(239, 68, 68, 0.8)',
                borderColor: 'rgba(239, 68, 68, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                x: {
                    stacked: true,
                },
                y: {
                    stacked: true,
                    beginAtZero: true
                }
            }
        }
    });
}

function createPieChart() {
    const ctx = $('#pieChart');
    if (!ctx) return;

    pieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Délibérées', 'En attente', 'Litiges'],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: [
                    'rgba(34, 197, 94, 0.8)',
                    'rgba(251, 191, 36, 0.8)',
                    'rgba(239, 68, 68, 0.8)'
                ],
                borderColor: [
                    'rgba(34, 197, 94, 1)',
                    'rgba(251, 191, 36, 1)',
                    'rgba(239, 68, 68, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                }
            }
        }
    });
}

/***************** CARTE *****************/
function initializeMap() {
    if (mapInitialized) return;
    leafletMap = L.map('mapContainer').setView([12.8, -12.3], 8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(leafletMap);
    mapInitialized = true;
}

function createSyntheticPolygons() {
    if (!mapInitialized) return;

    const communes = [...new Set(rawData.map(d => d.commune))];
    const features = communes.map(commune => {
        const communeData = rawData.filter(d => d.commune === commune);
        const centerLat = d3.mean(communeData, d => d.lat);
        const centerLng = d3.mean(communeData, d => d.lng);
        
        // Création d'un polygone synthétique autour du centre
        const radius = 0.05;
        const points = [];
        for (let i = 0; i < 6; i++) {
            const angle = (i * 60) * Math.PI / 180;
            points.push([
                centerLng + radius * Math.cos(angle),
                centerLat + radius * Math.sin(angle)
            ]);
        }
        points.push(points[0]); // Ferme le polygone

        return {
            type: "Feature",
            properties: { NOM: commune },
            geometry: {
                type: "Polygon",
                coordinates: [points]
            }
        };
    });

    const geojsonData = {
        type: "FeatureCollection",
        features: features
    };

    choroLayer = L.geoJSON(geojsonData, {
        style: getPolygonStyle,
        onEachFeature: onCommuneFeature
    }).addTo(leafletMap);

    leafletMap.fitBounds(choroLayer.getBounds());
}

/***************** MISE À JOUR DES VISUALISATIONS *****************/
function updateAllVisualizations() {
    updateKPIs();
    updateCharts();
    updateMapColors();
}

function updateKPIs() {
    const filteredData = ndx.allFiltered();
    
    const newValues = {
        parcelles: d3.sum(filteredData, d => d.parcelles),
        superficie: Math.round(d3.sum(filteredData, d => d.superficie) / 10000),
        nicad: d3.sum(filteredData, d => d.nicad),
        deliberees: d3.sum(filteredData, d => d.deliberees)
    };

    // Animation des valeurs
    Object.keys(newValues).forEach(key => {
        const element = $(`#kpi-${key}`);
        const progressElement = $(`#progress-${key}`);
        
        if (element) {
            d3.select(element)
                .transition()
                .duration(1000)
                .tween("text", function() {
                    const i = d3.interpolateNumber(currentKPIValues[key], newValues[key]);
                    return function(t) {
                        this.textContent = key === 'superficie' ? 
                            formatDecimal(i(t)) + ' ha' : 
                            formatNumber(i(t));
                    };
                });
        }

        if (progressElement) {
            const maxValue = d3.max(rawData, d => d[key]);
            const percentage = (newValues[key] / maxValue) * 100;
            progressElement.style.width = `${Math.min(percentage, 100)}%`;
        }
    });

    Object.assign(currentKPIValues, newValues);
}

function updateCharts() {
    const filteredData = ndx.allFiltered();
    
    // Mise à jour du graphique en barres empilées
    if (statusChart) {
        const communeStats = d3.rollup(
            filteredData,
            v => ({
                'Délibérées': d3.sum(v.filter(d => d.statut === 'Délibérée'), d => d.parcelles),
                'En attente': d3.sum(v.filter(d => d.statut === 'En attente'), d => d.parcelles),
                'Litiges': d3.sum(v.filter(d => d.statut === 'Litige'), d => d.parcelles)
            }),
            d => d.commune
        );

        const communes = Array.from(communeStats.keys()).sort();
        const isPercent = $('#percentToggle').checked;

        statusChart.data.labels = communes;
        statusChart.data.datasets[0].data = communes.map(commune => {
            const stats = communeStats.get(commune);
            const total = stats['Délibérées'] + stats['En attente'] + stats['Litiges'];
            return isPercent ? (stats['Délibérées'] / total * 100) || 0 : stats['Délibérées'];
        });
        statusChart.data.datasets[1].data = communes.map(commune => {
            const stats = communeStats.get(commune);
            const total = stats['Délibérées'] + stats['En attente'] + stats['Litiges'];
            return isPercent ? (stats['En attente'] / total * 100) || 0 : stats['En attente'];
        });
        statusChart.data.datasets[2].data = communes.map(commune => {
            const stats = communeStats.get(commune);
            const total = stats['Délibérées'] + stats['En attente'] + stats['Litiges'];
            return isPercent ? (stats['Litiges'] / total * 100) || 0 : stats['Litiges'];
        });

        statusChart.options.scales.y.max = isPercent ? 100 : undefined;
        statusChart.update();
    }

    // Mise à jour du graphique circulaire
    if (pieChart) {
        const statusStats = d3.rollup(
            filteredData,
            v => d3.sum(v, d => d.parcelles),
            d => d.statut
        );

        pieChart.data.datasets[0].data = [
            statusStats.get('Délibérée') || 0,
            statusStats.get('En attente') || 0,
            statusStats.get('Litige') || 0
        ];
        pieChart.update();
    }
}

function updateMapColors() {
    if (!mapInitialized || !choroLayer) return;
    
    // Cette fonction sera overridée par enhanceSynchronization()
    choroLayer.eachLayer(layer => {
        layer.setStyle(getPolygonStyle(layer.feature));
    });
}

/***************** EXPORT ET RAPPORTS *****************/
async function generatePDF() {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape', 'pt', 'a4');
        
        // En-tête
        doc.setFontSize(20);
        doc.text('Inventaire Foncier - Boundou', 40, 40);
        doc.setFontSize(12);
        doc.text(`Généré le ${new Date().toLocaleDateString()}`, 40, 60);
        
        let yPosition = 100;
        
        // KPI
        const filteredData = ndx.allFiltered();
        const stats = {
            parcelles: d3.sum(filteredData, d => d.parcelles),
            superficie: d3.sum(filteredData, d => d.superficie) / 10000,
            nicad: d3.sum(filteredData, d => d.nicad),
            deliberees: d3.sum(filteredData, d => d.deliberees)
        };
        
        doc.text(`Parcelles: ${formatNumber(stats.parcelles)}`, 40, yPosition);
        doc.text(`Superficie: ${formatDecimal(stats.superficie)} ha`, 200, yPosition);
        doc.text(`NICAD: ${formatNumber(stats.nicad)}`, 360, yPosition);
        doc.text(`Délibérées: ${formatNumber(stats.deliberees)}`, 520, yPosition);
        
        yPosition += 40;
        
        // Capture des graphiques si possible
        try {
            const chartCanvas = $('#statusChart');
            if (chartCanvas) {
                const chartImage = await html2canvas(chartCanvas.parentElement);
                const chartDataURL = chartImage.toDataURL('image/png');
                doc.addImage(chartDataURL, 'PNG', 40, yPosition, 300, 200);
                yPosition += 220;
            }
        } catch (err) {
            console.warn('Impossible de capturer les graphiques:', err);
        }
        
        // Tableau des données
        const tableData = filteredData.map(d => [
            d.region,
            d.commune,
            d.village,
            formatNumber(d.parcelles),
            formatDecimal(d.superficie / 10000),
            formatNumber(d.nicad),
            formatNumber(d.deliberees),
            d.statut
        ]);
        
        doc.autoTable({
            head: [['Région', 'Commune', 'Village', 'Parcelles', 'Superficie (ha)', 'NICAD', 'Délibérées', 'Statut']],
            body: tableData,
            startY: yPosition,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [33, 128, 141] }
        });
        
        doc.save('inventaire_boundou.pdf');
        showToast('PDF exporté avec succès', 'success');
        
    } catch (error) {
        console.error('Erreur export PDF:', error);
        showToast('Erreur lors de l\'export PDF', 'error');
    }
}

async function triggerRebuild() {
    try {
        const response = await fetch(BUILD_HOOK, { method: 'POST' });
        if (response.ok) {
            showToast('Rebuild déclenché avec succès', 'success');
        } else {
            throw new Error('Erreur rebuild');
        }
    } catch (error) {
        console.error('Erreur rebuild:', error);
        showToast('Erreur lors du rebuild', 'error');
    }
}

/***************** GESTION DES ÉVÉNEMENTS *****************/
function attachEventHandlers() {
    // Navigation
    $$('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            $$('.nav-item').forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            const section = item.dataset.section;
            $$('.content-section').forEach(sec => sec.classList.remove('active'));
            $(`#${section}`).classList.add('active');
        });
    });

    // Menu mobile
    $('#menuToggle')?.addEventListener('click', () => {
        $('#sidebar').classList.toggle('open');
    });

    // Thème
    $('#themeToggle')?.addEventListener('click', () => {
        const body = document.body;
        const currentTheme = body.dataset.colorScheme || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        body.dataset.colorScheme = newTheme;
        localStorage.setItem('theme', newTheme);
    });

    // Taille de police
    $$('.font-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.font-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const size = btn.dataset.size;
            document.body.className = document.body.className.replace(/font-\w+/g, '');
            document.body.classList.add(`font-${size}`);
        });
    });

    // Toggle pourcentage
    $('#percentToggle')?.addEventListener('change', updateCharts);

    // Export PDF
    $('#exportPDF')?.addEventListener('click', generatePDF);

    // Rebuild
    $('#triggerRebuild')?.addEventListener('click', triggerRebuild);

    // Contrôles carte
    $('#fitBounds')?.addEventListener('click', () => {
        if (choroLayer && leafletMap) {
            leafletMap.fitBounds(choroLayer.getBounds());
        }
    });

    $('#resetMap')?.addEventListener('click', () => {
        if (leafletMap) {
            leafletMap.setView([12.8, -12.3], 8);
        }
    });
}

/***************** UTILITAIRES INTERFACE *****************/
function showLoadingOverlay() { $('#loadingOverlay')?.classList.remove('hidden'); }
function hideLoadingOverlay() { $('#loadingOverlay')?.classList.add('hidden'); }

function showToast(message, type = 'info') {
    const container = $('#toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 5000);
}

function createParticles() {
    const container = $('#particles-container');
    if (!container) return;

    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.width = Math.random() * 4 + 2 + 'px';
        particle.style.height = particle.style.width;
        particle.style.animationDelay = Math.random() * 6 + 's';
        particle.style.animationDuration = (Math.random() * 4 + 4) + 's';
        container.appendChild(particle);
    }
}

function setupIntersectionObserver() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animationPlayState = 'running';
            }
        });
    });

    $$('.kpi-card, .glass-card').forEach(el => {
        observer.observe(el);
    });
}

// Fonction globale pour le filtrage par commune depuis la popup
window.filterByCommune = commune => {
    regionDim.filterAll(); villageDim.filterAll();
    communeDim.filterExact(commune);
    $('#communeSelect').value = commune;
    $('#communeSelect').dispatchEvent(new Event('change'));
    showToast(`Filtré sur ${commune}`, 'info');
};

// Chargement du thème sauvegardé
const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
    document.body.dataset.colorScheme = savedTheme;
}
