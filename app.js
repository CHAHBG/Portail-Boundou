// === Boundou Dashboard Application ===
// Initialize BoundouDashboard
window.BoundouDashboard = window.BoundouDashboard || {};

// Global variables
let map;
let communesLayer;
let parcellesData = [];
let communesData = null;
let currentCharts = {};
let fontScale = 1;
let collectiveParcelErrors = [];
let filteredParcellesData = [];
let lastSelectedCommune = null;
window.BoundouDashboard.processedIndividualData = [];
window.BoundouDashboard.processedCollectiveData = [];
window.BoundouDashboard.isProcessingFile = false;
window.BoundouDashboard.originalIndividualData = null;
window.BoundouDashboard.originalCollectiveData = null;

// Configuration des communes avec statut d'opération
const communesConfig = {
    'NDOGA BABACAR': { status: 'active', hasOperations: true },
    'MISSIRAH': { status: 'active', hasOperations: true },
    'BANDAFASSI': { status: 'completed', hasOperations: true },
    'NETTEBOULOU': { status: 'active', hasOperations: true },
    'FONGOLEMBI': { status: 'completed', hasOperations: true },
    'DIMBOLI': { status: 'completed', hasOperations: true },
    'GABOU': { status: 'active', hasOperations: true },
    'BEMBOU': { status: 'active', hasOperations: true },
    'DINDEFELLO': { status: 'active', hasOperations: true },
    'TOMBORONKOTO': { status: 'active', hasOperations: true },
    'BALLOU': { status: 'active', hasOperations: true },
    'MOUDERY': { status: 'active', hasOperations: true },
    'BALA': { status: 'active', hasOperations: true },
    'KOAR': { status: 'active', hasOperations: true },
    'SABODALA': { status: 'pending', hasOperations: false },
    'MEDINA BAFFE': { status: 'pending', hasOperations: false },
    'SINTHIOU MALEME': { status: 'pending', hasOperations: false }
};

// Colors palette
const colors = {
    primary: '#1B3B59',
    secondary: '#D2691E',
    accent: '#4A7C59',
    warning: '#F4A460',
    background: '#F5E6D3',
    operationsActive: '#2E8B57',
    operationsCompleted: '#4682B4',
    operationsPending: '#D3D3D3',
    operationsActiveHover: '#228B22',
    operationsCompletedHover: '#3A6B9C',
    operationsPendingHover: '#A9A9A9',
    chartColors: ['#1FB8CD', '#FFC185', '#B4413C', '#ECEBD5', '#5D878F', '#DB4545', '#D2BA4C', '#964325', '#944454', '#13343B']
};

// === Utility Functions ===
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => container.contains(toast) && container.removeChild(toast), 300);
    }, 3000);
}

function cleanValue(value) {
    if (value === null || value === undefined || value === '' || 
        (typeof value === 'number' && isNaN(value))) {
        return "-";
    }
    let strValue = String(value);
    if (strValue.endsWith('.0')) {
        strValue = strValue.slice(0, -2);
    }
    return strValue.trim();
}

function animateValue(element, start, end, duration = 1000) {
    if (!element) return;

    const startTime = performance.now();
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const current = start + (end - start) * progress;
        element.textContent = typeof end === 'number' ? 
            (end % 1 === 0 ? Math.floor(current) : current.toFixed(1)) : end;
        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

function blinkLayer(layer, duration = 2000, interval = 300) {
    if (!layer) return;
    let isVisible = true;
    const start = performance.now();

    function blink(currentTime) {
        if (currentTime - start > duration) {
            layer.setStyle({ fillOpacity: 0.7 });
            return;
        }
        layer.setStyle({ fillOpacity: isVisible ? 0.7 : 0.2 });
        isVisible = !isVisible;
        setTimeout(() => requestAnimationFrame(blink), interval);
    }
    requestAnimationFrame(blink);
}

function validateData(communesData, parcellesData) {
    const errors = [];
    if (!communesData || !communesData.features || !Array.isArray(communesData.features)) {
        errors.push('Structure GeoJSON invalide');
    }
    if (!Array.isArray(parcellesData)) {
        errors.push('Le fichier parcelles.json doit contenir un array');
    }
    return errors;
}

function debugData() {
    console.log('=== DEBUG BOUNDOU DASHBOARD ===');
    console.log('Communes dans GeoJSON:', communesData?.features?.map(f => getCommuneName(f.properties)));
    console.log('Communes dans parcelles:', [...new Set(parcellesData.map(p => p.commune).filter(Boolean))]);
    console.log('Configuration communes:', Object.keys(communesConfig));
}

// === Data Loading Functions ===
async function loadExternalData() {
    try {
        showToast('Chargement des données...', 'info');
        const [communesResponse, parcellesResponse] = await Promise.all([
            fetch('data/communes_boundou.geojson'),
            fetch('data/parcelles.json')
        ]);

        if (!communesResponse.ok) throw new Error(`Erreur GeoJSON: ${communesResponse.status}`);
        if (!parcellesResponse.ok) throw new Error(`Erreur parcelles: ${parcellesResponse.status}`);

        communesData = await communesResponse.json();
        parcellesData = await parcellesResponse.json();
        filteredParcellesData = [...parcellesData];

        const validationErrors = validateData(communesData, parcellesData);
        if (validationErrors.length > 0) throw new Error(`Erreurs de validation: ${validationErrors.join(', ')}`);

        debugData();
        showToast('Données chargées avec succès!', 'success');
        return true;
    } catch (error) {
        console.error('Erreur de chargement:', error);
        showToast(`Erreur: ${error.message}`, 'error');
        communesData = getSampleGeoJSON();
        parcellesData = getSampleParcelles();
        filteredParcellesData = [...parcellesData];
        debugData();
        initializeMap(); // Reinitialize map with sample data
        return false;
    }
}

function getSampleGeoJSON() {
    return {
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            properties: { REG: 'Tambacounda', DEPT: 'Goudiry', CCRCA_1: 'KOUSSAN', CODE: '23301' },
            geometry: { type: 'Polygon', coordinates: [[[-12.1, 14.2], [-12.0, 14.2], [-12.0, 14.3], [-12.1, 14.3], [-12.1, 14.2]]] }
        }]
    };
}

function getSampleParcelles() {
    return [{
        id_parcelle: '0522030300264',
        commune: 'KOUSSAN',
        village: 'koulare',
        nicad: 'Non',
        superficie: 2.5,
        type_usag: 'Agriculture_irriguée',
        deliberee: 'Non',
        autorite_delib: 'Non spécifié',
        numero_cadastrale: null
    }];
}

// === Data Processing Functions ===
function calculateCommuneStats(commune, dataSource = parcellesData) {
    const communeParcelles = dataSource.filter(p => p.commune === commune);
    return {
        totalParcelles: communeParcelles.length,
        superficieTotale: communeParcelles.reduce((sum, p) => sum + (parseFloat(p.superficie) || 0), 0),
        nicadCount: communeParcelles.filter(p => p.nicad === 'Oui').length,
        delibereesCount: communeParcelles.filter(p => p.deliberee === 'Oui').length,
        typesUsage: communeParcelles.reduce((acc, p) => {
            if (p.type_usag) acc[p.type_usag] = (acc[p.type_usag] || 0) + 1;
            return acc;
        }, {})
    };
}

function getColorByOperationStatus(communeName, parcelleCount) {
    if (!communeName || typeof communeName !== 'string') return '#F0F0F0';
    const config = communesConfig[communeName.toUpperCase()];
    if (!config) return '#F0F0F0';
    if (config.status === 'pending') return colors.operationsPending;
    if (config.status === 'completed') return colors.operationsCompleted;
    return colors.operationsActive;
}

function getCommuneName(properties) {
    return properties?.CCRCA_1 || properties?.CCRCA || properties?.NOM || 'Commune inconnue';
}

// === Map Functions ===
function initializeMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement) {
        console.warn('Element map non trouvé');
        showToast('Erreur : conteneur de la carte non trouvé', 'error');
        return;
    }

    map = L.map('map').setView([12.5, -12.0], 8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(map);

    loadCommunesLayer();
    updateMapLegend();
}

function loadCommunesLayer() {
    if (!map || !communesData) return;
    if (communesLayer) map.removeLayer(communesLayer);

    communesLayer = L.geoJSON(communesData, {
        style: function(feature) {
            const communeName = getCommuneName(feature.properties);
            const communeStats = calculateCommuneStats(communeName, filteredParcellesData);
            const config = communesConfig[communeName.toUpperCase()];
            return {
                fillColor: getColorByOperationStatus(communeName, communeStats.totalParcelles),
                weight: 2,
                opacity: 1,
                color: '#2C2C2C',
                dashArray: config ? '0' : '5,5',
                fillOpacity: config ? 0.7 : 0.3
            };
        },
        onEachFeature: function(feature, layer) {
            const communeName = getCommuneName(feature.properties);
            const communeStats = calculateCommuneStats(communeName, filteredParcellesData);
            const config = communesConfig[communeName.toUpperCase()];
            
            let statusText = config 
                ? (config.status === 'active' ? 'Opérations foncières en cours' : 
                   config.status === 'completed' ? 'Opérations foncières terminées' : 'Opérations foncières non démarrées')
                : 'Hors zone PROCASEF';
            
            const buttonHtml = config && config.hasOperations && communeStats.totalParcelles > 0 
                ? `<button onclick="showCommuneDetails('${communeName}')" class="btn btn--primary btn--sm">Voir les détails</button>`
                : '';

            const popupContent = `
                <div class="popup-content">
                    <h3>${communeName}</h3>
                    <p><strong>Région:</strong> ${feature.properties.REG || 'N/A'}</p>
                    <p><strong>Département:</strong> ${feature.properties.DEPT || 'N/A'}</p>
                    <p><strong>Statut:</strong> <span class="status-${config?.status || 'none'}">${statusText}</span></p>
                    <p><strong>Parcelles levées:</strong> ${communeStats.totalParcelles}</p>
                    <p><strong>Superficie totale:</strong> ${communeStats.superficieTotale.toFixed(1)} m²</p>
                    ${buttonHtml}
                </div>
            `;

            layer.bindPopup(popupContent);
            layer.on({
                mouseover: function(e) {
                    e.target.setStyle({
                        weight: 3,
                        fillOpacity: config ? 0.9 : 0.5
                    });
                },
                mouseout: function(e) {
                    communesLayer.resetStyle(e.target);
                },
                click: function(e) {
                    if (config && config.hasOperations && communeStats.totalParcelles > 0) {
                        zoomToCommune(communeName, e.target);
                        showCommuneDetails(communeName);
                    }
                }
            });
        }
    }).addTo(map);

    if (!lastSelectedCommune && communesData.features?.length > 0) {
        map.fitBounds(communesLayer.getBounds());
    }
}

function zoomToCommune(communeName, layer) {
    const feature = communesData.features.find(f => getCommuneName(f.properties) === communeName);
    if (!feature || !layer) return;

    const bounds = L.geoJSON(feature).getBounds();
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    blinkLayer(layer);
}

function updateMapLegend() {
    let legendElement = document.querySelector('.map-legend');
    
    if (!legendElement) {
        console.warn('Élément .map-legend non trouvé, création dynamique...');
        legendElement = document.createElement('div');
        legendElement.className = 'map-legend';
        const mapContainer = document.getElementById('map');
        if (mapContainer) {
            mapContainer.appendChild(legendElement);
        } else {
            console.error('Conteneur de la carte non trouvé pour ajouter la légende');
            showToast('Erreur : impossible d\'afficher la légende', 'error');
            return;
        }
    }

    legendElement.innerHTML = `
        <h4>Légende</h4>
        <div class="legend-item">
            <span class="legend-color" style="background: ${colors.operationsActive};"></span>
            <span>Opérations foncières en cours</span>
        </div>
        <div class="legend-item">
            <span class="legend-color" style="background: ${colors.operationsCompleted};"></span>
            <span>Opérations foncières terminées</span>
        </div>
        <div class="legend-item">
            <span class="legend-color" style="background: ${colors.operationsPending};"></span>
            <span>Opérations foncières non démarrées</span>
        </div>
        <div class="legend-item">
            <span class="legend-color" style="background: #F0F0F0; border: 1px dashed #999;"></span>
            <span>Hors zone PROCASEF</span>
        </div>
    `;

    legendElement.style.display = 'block';
    console.log('Légende mise à jour avec succès');
}

function showCommuneDetails(communeName) {
    const stats = calculateCommuneStats(communeName, filteredParcellesData);
    const panel = document.getElementById('stats-panel');
    if (!panel) return;

    lastSelectedCommune = communeName;
    document.getElementById('selected-commune').textContent = `Commune de ${communeName}`;
    animateValue(document.getElementById('total-parcelles'), 0, stats.totalParcelles);
    animateValue(document.getElementById('superficie-totale'), 0, stats.superficieTotale);

    const nicadPercentage = stats.totalParcelles > 0 ? Math.round((stats.nicadCount / stats.totalParcelles) * 100) : 0;
    const delibereesPercentage = stats.totalParcelles > 0 ? Math.round((stats.delibereesCount / stats.totalParcelles) * 100) : 0;

    setTimeout(() => {
        document.getElementById('pourcentage-nicad').textContent = `${nicadPercentage}%`;
        document.getElementById('pourcentage-deliberees').textContent = `${delibereesPercentage}%`;
    }, 500);

    panel.classList.remove('hidden');
    panel.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => {
        createUsageChart(stats.typesUsage);
        createStatusChart(stats.nicadCount, stats.delibereesCount, stats.totalParcelles);
    }, 600);

    const layer = communesLayer.getLayers().find(l => getCommuneName(l.feature.properties) === communeName);
    if (layer) zoomToCommune(communeName, layer);

    showToast(`Détails chargés pour ${communeName}`, 'success');
}

// === Chart Functions ===
function createUsageChart(typesUsage) {
    const ctx = document.getElementById('usage-chart');
    if (!ctx) return;

    if (currentCharts.usage) currentCharts.usage.destroy();

    const labels = Object.keys(typesUsage).length ? Object.keys(typesUsage) : ['Aucune donnée'];
    const data = Object.values(typesUsage).length ? Object.values(typesUsage) : [1];

    currentCharts.usage = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels.map(label => label.replace(/_/g, ' ')),
            datasets: [{
                data,
                backgroundColor: colors.chartColors.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { font: { size: 12 }, padding: 15, usePointStyle: true } },
                title: { display: true, text: 'Types d\'Usage', font: { size: 14, weight: 'bold' } }
            },
            animation: { animateRotate: true, duration: 1000 }
        }
    });
}

function createStatusChart(nicadCount, delibereesCount, total) {
    const ctx = document.getElementById('status-chart');
    if (!ctx) return;

    if (currentCharts.status) currentCharts.status.destroy();

    currentCharts.status = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['NICAD', 'Délibérées'],
            datasets: [
                { label: 'Oui', data: [nicadCount, delibereesCount], backgroundColor: [colors.accent, colors.secondary], borderRadius: 4 },
                { label: 'Non', data: [total - nicadCount, total - delibereesCount], backgroundColor: ['#E5E5E5', '#E5E5E5'], borderRadius: 4 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
            plugins: { legend: { position: 'top' }, title: { display: true, text: 'Statuts des Parcelles', font: { size: 14, weight: 'bold' } } },
            animation: { duration: 1000, easing: 'easeInOutQuart' }
        }
    });
}

function createCommunesChart() {
    const ctx = document.getElementById('communes-chart');
    if (!ctx || !communesData?.features) return;

    const communeNames = [...new Set(parcellesData.map(p => p.commune).filter(Boolean))].sort();
    const parcelleCounts = communeNames.map(name => calculateCommuneStats(name, filteredParcellesData).totalParcelles);
    const backgroundColors = communeNames.map(name => {
        const config = communesConfig[name.toUpperCase()];
        if (!config) return '#F0F0F0';
        return config.status === 'active' ? colors.operationsActive : 
               config.status === 'completed' ? colors.operationsCompleted : colors.operationsPending;
    });

    if (currentCharts.communes) currentCharts.communes.destroy();

    currentCharts.communes = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: communeNames,
            datasets: [{
                label: 'Nombre de parcelles levées',
                data: parcelleCounts,
                backgroundColor: backgroundColors,
                borderRadius: 4,
                borderWidth: 1,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } }, x: { ticks: { maxRotation: 45, minRotation: 0 } } },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const communeName = context.label;
                            const config = communesConfig[communeName.toUpperCase()];
                            let status = config ? 
                                (config.status === 'active' ? 'Opérations en cours' : 
                                 config.status === 'completed' ? 'Opérations terminées' : 'Opérations non démarrées') : 
                                'Hors zone PROCASEF';
                            return [
                                `${communeName}: ${context.parsed.y} parcelle${context.parsed.y > 1 ? 's' : ''} levée${context.parsed.y > 1 ? 's' : ''}`,
                                `Statut: ${status}`
                            ];
                        }
                    }
                }
            },
            animation: { duration: 1500, easing: 'easeInOutQuart' }
        }
    });
}

function createGlobalUsageChart() {
    const ctx = document.getElementById('global-usage-chart');
    if (!ctx) return;

    const usageStats = filteredParcellesData.reduce((acc, p) => {
        if (p.type_usag) acc[p.type_usag] = (acc[p.type_usag] || 0) + 1;
        return acc;
    }, {});

    const labels = Object.keys(usageStats).length ? Object.keys(usageStats) : ['Aucune donnée'];
    const data = Object.values(usageStats).length ? Object.values(usageStats) : [1];

    if (currentCharts.globalUsage) currentCharts.globalUsage.destroy();

    currentCharts.globalUsage = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels.map(label => label.replace(/_/g, ' ')),
            datasets: [{
                data,
                backgroundColor: colors.chartColors.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        font: { size: 11 },
                        padding: 10,
                        usePointStyle: true,
                        generateLabels: function(chart) {
                            const data = chart.data;
                            const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                            return data.labels.map((label, i) => {
                                const value = data.datasets[0].data[i];
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                                return { text: `${label} (${percentage}%)`, fillStyle: data.datasets[0].backgroundColor[i], hidden: false, index: i };
                            });
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : '0.0';
                            return `${context.label}: ${context.parsed} (${percentage}%)`;
                        }
                    }
                }
            },
            animation: { animateRotate: true, duration: 1500 }
        }
    });
}

// === Event Handlers ===
function initializeEventHandlers() {
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => switchSection(button.dataset.section));
    });

    document.querySelectorAll('.dashboard-tab').forEach(button => {
        button.addEventListener('click', () => switchDashboard(button.dataset.dashboard));
    });

    const closeStats = document.getElementById('close-stats');
    if (closeStats) closeStats.addEventListener('click', () => {
        document.getElementById('stats-panel')?.classList.add('hidden');
        lastSelectedCommune = null;
        if (communesData.features?.length > 0) map.fitBounds(communesLayer.getBounds());
    });

    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

    const fontIncrease = document.getElementById('font-increase');
    const fontDecrease = document.getElementById('font-decrease');
    if (fontIncrease) fontIncrease.addEventListener('click', () => adjustFontSize(0.1));
    if (fontDecrease) fontDecrease.addEventListener('click', () => adjustFontSize(-0.1));

    const communeFilter = document.getElementById('commune-filter');
    const usageFilter = document.getElementById('usage-filter');
    if (communeFilter) communeFilter.addEventListener('change', applyFilters);
    if (usageFilter) usageFilter.addEventListener('change', applyFilters);

    const exportData = document.getElementById('export-data');
    if (exportData) exportData.addEventListener('click', exportDataHandler);

    const generateIndividualBtn = document.getElementById('generate-individual');
    const generateCollectiveBtn = document.getElementById('generate-collective');
    if (generateIndividualBtn) generateIndividualBtn.addEventListener('click', () => processFile('individual'));
    if (generateCollectiveBtn) generateCollectiveBtn.addEventListener('click', () => processFile('collective'));

    const resetBtn = document.getElementById('reset-deliberation');
    if (resetBtn) resetBtn.addEventListener('click', resetDeliberationData);

    if (window.DeliberationListGenerator) {
        window.DeliberationListGenerator.initializeDeliberationHandlers();
    } else {
        console.warn('Module DeliberationListGenerator non chargé');
        showToast('Erreur : module de gestion des délibérations non disponible', 'error');
    }
}

function initializeSubTabs() {
    const subTabButtons = document.querySelectorAll('.sub-tab-button');
    const subContentSections = document.querySelectorAll('.sub-content-section');

    subTabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const subsection = this.dataset.subsection;
            
            // Remove active class from all sub-tabs and sub-sections
            subTabButtons.forEach(btn => btn.classList.remove('active'));
            subContentSections.forEach(section => section.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding section
            this.classList.add('active');
            document.getElementById(`${subsection}-subsection`).classList.add('active');

            // Update file info and preview based on active subsection
            if (subsection === 'individual') {
                window.DeliberationListGenerator.displayFileInfo(window.BoundouDashboard.originalIndividualData, 'individual');
                window.DeliberationListGenerator.displayPreview('individual');
            } else {
                window.DeliberationListGenerator.displayFileInfo(window.BoundouDashboard.originalCollectiveData, 'collective');
                window.DeliberationListGenerator.displayPreview('collective');
            }
        });
    });

    // Ajout des attributs ARIA pour l'accessibilité
    subTabButtons.forEach((tab, index, tabs) => {
        tab.setAttribute('tabindex', index === 0 ? '0' : '-1');
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
        tab.addEventListener('click', () => {
            tabs.forEach(t => {
                t.setAttribute('aria-selected', 'false');
                t.setAttribute('tabindex', '-1');
            });
            tab.setAttribute('aria-selected', 'true');
            tab.setAttribute('tabindex', '0');
        });
        tab.addEventListener('keydown', (e) => {
            let nextIndex;
            switch (e.key) {
                case 'ArrowRight': nextIndex = (index + 1) % tabs.length; break;
                case 'ArrowLeft': nextIndex = (index - 1 + tabs.length) % tabs.length; break;
                case 'Home': nextIndex = 0; break;
                case 'End': nextIndex = tabs.length - 1; break;
                default: return;
            }
            e.preventDefault();
            tabs[nextIndex].focus();
            tabs[nextIndex].click();
        });
    });
}

function switchSection(sectionName) {
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-section="${sectionName}"]`)?.classList.add('active');

    document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));
    document.getElementById(`${sectionName}-section`)?.classList.add('active');

    if (sectionName === 'stats') createGlobalCharts();
    else if (sectionName === 'map') {
        setTimeout(() => map?.invalidateSize(), 100);
        updateMapLegend();
        if (lastSelectedCommune && communesLayer) {
            const layer = communesLayer.getLayers().find(l => getCommuneName(l.feature.properties) === lastSelectedCommune);
            if (layer) zoomToCommune(lastSelectedCommune, layer);
            else {
                console.warn('No layer found for commune:', lastSelectedCommune);
                showToast(`Commune ${lastSelectedCommune} non trouvée`, 'warning');
            }
        } else if (lastSelectedCommune) {
            console.warn('Communes layer not initialized');
            showToast('La carte n\'est pas encore chargée', 'warning');
        }
    }
}

function switchDashboard(dashboardName) {
    document.querySelectorAll('.dashboard-tab').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-dashboard="${dashboardName}"]`)?.classList.add('active');

    const iframe = document.getElementById('dashboard-frame');
    const loading = document.querySelector('.dashboard-loading');
    if (!iframe) return;

    const urls = {
        'boundou': 'https://boundoudash.netlify.app/',
        'edl': 'https://edlinventairesboundou.netlify.app/'
    };

    if (loading) loading.style.display = 'block';
    iframe.src = urls[dashboardName] || '';

    iframe.onload = () => {
        if (loading) loading.style.display = 'none';
        showToast(`Dashboard ${dashboardName} chargé`, 'success');
    };
}

function toggleTheme() {
    const currentTheme = document.documentElement.dataset.colorScheme || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.colorScheme = newTheme;
    document.querySelector('.theme-icon').textContent = newTheme === 'light' ? '🌙' : '☀️';
    localStorage.setItem('theme', newTheme);
    showToast(`Mode ${newTheme === 'dark' ? 'sombre' : 'clair'} activé`, 'success');
}

function adjustFontSize(delta) {
    fontScale = Math.max(0.8, Math.min(1.4, fontScale + delta));
    document.documentElement.style.setProperty('--font-scale', fontScale);
    showToast(`Taille du texte: ${Math.round(fontScale * 100)}%`, 'info');
}

function applyFilters() {
    const communeFilter = document.getElementById('commune-filter');
    const usageFilter = document.getElementById('usage-filter');
    if (!communeFilter || !usageFilter) return;

    const communeValue = communeFilter.value;
    const usageValue = usageFilter.value;

    filteredParcellesData = parcellesData.filter(p => {
        const communeMatch = !communeValue || p.commune === communeValue;
        const usageMatch = !usageValue || p.type_usag === usageValue;
        return communeMatch && usageMatch;
    });

    updateGlobalStats();
    if (communesLayer) loadCommunesLayer();
    createGlobalCharts();

    if (communeValue) {
        lastSelectedCommune = communeValue;
        const layer = communesLayer.getLayers().find(l => getCommuneName(l.feature.properties) === communeValue);
        if (layer) {
            zoomToCommune(communeValue, layer);
            showCommuneDetails(communeValue);
        }
    } else {
        lastSelectedCommune = null;
        if (communesData.features?.length > 0) map.fitBounds(communesLayer.getBounds());
    }

    showToast(`${filteredParcellesData.length} parcelles trouvées`, 'info');
}

function exportDataHandler() {
    const ws = XLSX.utils.json_to_sheet(filteredParcellesData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Parcelles');
    XLSX.writeFile(wb, 'parcelles_boundou.xlsx');
    showToast('Données exportées avec succès en XLSX', 'success');
}

function initializeFilters() {
    const communeSelect = document.getElementById('commune-filter');
    const usageSelect = document.getElementById('usage-filter');
    if (!communeSelect || !usageSelect) return;

    communeSelect.innerHTML = '<option value="">Toutes les communes</option>';
    usageSelect.innerHTML = '<option value="">Tous les usages</option>';

    const communes = [...new Set(parcellesData.map(p => p.commune).filter(Boolean))].sort();
    communes.forEach(commune => {
        const option = document.createElement('option');
        option.value = commune;
        option.textContent = commune;
        communeSelect.appendChild(option);
    });

    const usages = [...new Set(parcellesData.map(p => p.type_usag).filter(Boolean))].sort();
    usages.forEach(usage => {
        const option = document.createElement('option');
        option.value = usage;
        option.textContent = usage.replace(/_/g, ' ');
        usageSelect.appendChild(option);
    });
}

function updateGlobalStats() {
    const dataToUse = filteredParcellesData.length > 0 ? filteredParcellesData : parcellesData;
    const communesAvecParcelles = new Set(dataToUse.map(p => p.commune).filter(Boolean)).size;
    const totalParcelles = dataToUse.length;
    const superficieGlobale = dataToUse.reduce((sum, p) => sum + (parseFloat(p.superficie) || 0), 0);
    const nicadCount = dataToUse.filter(p => p.nicad === 'Oui').length;
    const delibereesCount = dataToUse.filter(p => p.deliberee === 'Oui').length;

    const totalCommunesEl = document.getElementById('total-communes');
    const totalParcellesEl = document.getElementById('total-parcelles-global');
    const superficieEl = document.getElementById('superficie-globale');
    const nicadPercentageEl = document.getElementById('nicad-percentage-global');
    const delibereesPercentageEl = document.getElementById('deliberees-percentage-global');

    if (totalCommunesEl) totalCommunesEl.textContent = communesAvecParcelles;
    if (totalParcellesEl) totalParcellesEl.textContent = totalParcelles;
    if (superficieEl) superficieEl.textContent = superficieGlobale.toFixed(1);
    if (nicadPercentageEl && totalParcelles > 0) {
        nicadPercentageEl.textContent = `${Math.round((nicadCount / totalParcelles) * 100)}%`;
    }
    if (delibereesPercentageEl && totalParcelles > 0) {
        delibereesPercentageEl.textContent = `${Math.round((delibereesCount / totalParcelles) * 100)}%`;
    }
}

function createGlobalCharts() {
    setTimeout(() => {
        createCommunesChart();
        createGlobalUsageChart();
    }, 300);
}

function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.dataset.colorScheme = savedTheme;
    const themeIcon = document.querySelector('.theme-icon');
    if (themeIcon) themeIcon.textContent = savedTheme === 'light' ? '🌙' : '☀️';
}

function handleResize() {
    if (map) setTimeout(() => map.invalidateSize(), 100);
    Object.values(currentCharts).forEach(chart => chart?.resize?.());
}

function initializeAccessibility() {
    document.querySelectorAll('.tab-button').forEach((tab, index, tabs) => {
        tab.setAttribute('tabindex', index === 0 ? '0' : '-1');
        tab.setAttribute('role', 'tab');
        tab.addEventListener('keydown', (e) => {
            let nextIndex;
            switch (e.key) {
                case 'ArrowRight': nextIndex = (index + 1) % tabs.length; break;
                case 'ArrowLeft': nextIndex = (index - 1 + tabs.length) % tabs.length; break;
                case 'Home': nextIndex = 0; break;
                case 'End': nextIndex = tabs.length - 1; break;
                default: return;
            }
            e.preventDefault();
            tabs[nextIndex].focus();
            tabs[nextIndex].click();
        });
    });
}

async function retryDataLoad(maxRetries = 3) {
    let attempts = 0;
    async function attempt() {
        attempts++;
        try {
            return await loadExternalData();
        } catch (error) {
            if (attempts < maxRetries) {
                showToast(`Tentative ${attempts}/${maxRetries} échouée, nouvel essai...`, 'warning');
                await new Promise(resolve => setTimeout(resolve, 2000 * attempts));
                return await attempt();
            }
            throw error;
        }
    }
    return attempt();
}

function initializePerformanceMonitoring() {
    if (window.performance?.mark) {
        window.performance.mark('app-start');
        window.addEventListener('load', () => {
            window.performance.mark('app-loaded');
            window.performance.measure('app-load-time', 'app-start', 'app-loaded');
            console.log(`Application loaded in ${window.performance.getEntriesByName('app-load-time')[0].duration.toFixed(2)}ms`);
        });
    }
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('Service Worker registered:', reg))
            .catch(err => console.warn('Service Worker registration failed:', err));
    }
}

function initializeSearch() {
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    if (!searchInput) return;

    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        clearTimeout(searchTimeout);
        if (query.length < 2) {
            if (searchResults) searchResults.innerHTML = '';
            return;
        }
        searchTimeout = setTimeout(() => performSearch(query), 300);
    });
}

function performSearch(query) {
    const results = parcellesData.filter(parcelle => 
        Object.values(parcelle).some(value => value && value.toString().toLowerCase().includes(query))
    );
    displaySearchResults(results.slice(0, 10));
}

function displaySearchResults(results) {
    const searchResults = document.getElementById('search-results');
    if (!searchResults) return;

    if (results.length === 0) {
        searchResults.innerHTML = '<div class="search-no-results">Aucun résultat trouvé</div>';
        return;
    }

    searchResults.innerHTML = results.map(parcelle => `
        <div class="search-result-item" onclick="highlightParcelle('${parcelle.id_parcelle}')">
            <div class="search-result-title">${parcelle.id_parcelle}</div>
            <div class="search-result-details">
                ${parcelle.commune} - ${parcelle.village || 'Village non spécifié'}<br>
                Superficie: ${parcelle.superficie || 'N/A'} ha
            </div>
        </div>
    `).join('');
}

function highlightParcelle(parcelleId) {
    const parcelle = parcellesData.find(p => p.id_parcelle === parcelleId);
    if (!parcelle) return;

    lastSelectedCommune = parcelle.commune;
    switchSection('map');
    showCommuneDetails(parcelle.commune);
    document.getElementById('search-results').innerHTML = '';
    showToast(`Parcelle ${parcelleId} sélectionnée`, 'success');
}

function initializePrint() {
    const printButton = document.getElementById('print-button');
    if (printButton) printButton.addEventListener('click', handlePrint);
}

function handlePrint() {
    document.body.classList.add('printing');
    window.print();
    setTimeout(() => document.body.classList.remove('printing'), 1000);
}

function exportToGeoJSON() {
    const features = filteredParcellesData.map(parcelle => ({
        type: 'Feature',
        properties: { ...parcelle },
        geometry: { type: 'Point', coordinates: [0, 0] }
    }));
    const geoJSON = { type: 'FeatureCollection', features };
    const blob = new Blob([JSON.stringify(geoJSON, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'parcelles_boundou.geojson';
    link.click();
    window.URL.revokeObjectURL(url);
}

function fadeIn(element, duration = 300) {
    if (!element) return;
    element.style.opacity = '0';
    element.style.display = 'block';
    const start = performance.now();
    function animate(currentTime) {
        const elapsed = currentTime - start;
        element.style.opacity = Math.min(elapsed / duration, 1);
        if (elapsed < duration) requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
}

function validateFileType(data, expectedType) {
    if (!data || data.length === 0) return { valid: false, message: 'Aucune donnée dans le fichier' };
    
    const headers = data[0] || [];
    const collectiveColumns = ['Prenom_1', 'Nom_1', 'Prenom_M', 'Nom_M'];
    const individualColumns = ['Prenom', 'Nom'];

    if (expectedType === 'collective') {
        // Un fichier collectif doit avoir au moins une colonne spécifique aux affectataires multiples
        const hasCollectiveColumns = collectiveColumns.some(col => headers.includes(col));
        if (!hasCollectiveColumns) {
            return { valid: false, message: 'Ce fichier ne contient pas de données collectives (manque de colonnes comme Prenom_1, Nom_1, Prenom_M, etc.)' };
        }
        return { valid: true, message: 'Fichier collectif valide' };
    } else if (expectedType === 'individual') {
        // Un fichier individuel doit avoir les colonnes Prenom et Nom
        const hasIndividualColumns = individualColumns.every(col => headers.includes(col));
        const hasCollectiveColumns = collectiveColumns.some(col => headers.includes(col));
        if (!hasIndividualColumns) {
            return { valid: false, message: 'Ce fichier ne contient pas de données individuelles (manque de colonnes Prenom ou Nom)' };
        }
        if (hasCollectiveColumns) {
            return { valid: false, message: 'Ce fichier semble être un fichier collectif, non individuel' };
        }
        return { valid: true, message: 'Fichier individuel valide' };
    }
    return { valid: false, message: 'Type de fichier inconnu' };
}

function slideDown(element, duration = 300) {
    if (!element) return;
    element.style.height = '0';
    element.style.overflow = 'hidden';
    element.style.display = 'block';
    const targetHeight = element.scrollHeight;
    const start = performance.now();
    function animate(currentTime) {
        const elapsed = currentTime - start;
        element.style.height = (targetHeight * Math.min(elapsed / duration, 1)) + 'px';
        if (elapsed >= duration) {
            element.style.height = 'auto';
            element.style.overflow = 'visible';
        } else {
            requestAnimationFrame(animate);
        }
    }
    requestAnimationFrame(animate);
}

// === Deliberation Processing Functions ===
async function loadExcelFile(file, type) {
    try {
        if (!['individual', 'collective'].includes(type)) {
            throw new Error('Type de fichier invalide');
        }
        window.BoundouDashboard.isProcessingFile = true;
        window.BoundouDashboard.showToast('Chargement du fichier...', 'info');
        const data = await readExcelFile(file);
        
        // Valider le type de fichier
        const validation = validateFileType(data, type);
        if (!validation.valid) {
            throw new Error(`${validation.message}. Colonnes détectées : ${data[0] ? data[0].join(', ') : 'aucune'}`);
        }

        if (type === 'individual') {
            window.BoundouDashboard.originalIndividualData = data;
        } else {
            window.BoundouDashboard.originalCollectiveData = data;
        }
        window.DeliberationListGenerator.displayFileInfo(data, type);
        window.BoundouDashboard.showToast('Fichier chargé avec succès', 'success');
        document.getElementById(`generate-${type}`).disabled = false;
    } catch (error) {
        console.error('Erreur lors du chargement du fichier:', error);
        window.BoundouDashboard.showToast(`Erreur : ${error.message}`, 'error');
        document.getElementById(`fileName${type.charAt(0).toUpperCase() + type.slice(1)}`).textContent = '';
        document.getElementById(`generate-${type}`).disabled = true;
    } finally {
        window.BoundouDashboard.isProcessingFile = false;
    }
}

async function readExcelFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheet = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheet];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    return data;
}

function processIndividualData(data) {
    if (!data || data.length <= 1) return [];
    const headers = data[0];
    const rows = data.slice(1).filter(row => row.some(cell => cell !== ''));
    const validRows = rows.map(row => {
        const rowData = {};
        headers.forEach((header, i) => {
            if (window.DeliberationListGenerator.colonnesAConserver.includes(header)) {
                rowData[header] = cleanValue(row[i]);
            }
        });
        return rowData;
    }).filter(row => row['Num_parcel_2'] && row['Village']);
    return validRows;
}

function processCollectiveData(data) {
    if (!data || data.length <= 1) return [];
    collectiveParcelErrors = []; // Réinitialiser les erreurs
    const headers = data[0];
    const rows = data.slice(1).filter(row => row.some(cell => cell !== ''));

    const results = rows.map(row => formatParcelData(row, headers)).filter(row => row !== null);
    return results;
}


function formatParcelData(row, headers) {
    function getValue(columnName) {
        const index = headers.indexOf(columnName);
        return index !== -1 ? row[index] : undefined;
    }

    const prenoms = [];
    const noms = [];
    const sexes = [];
    const pieces = [];
    const telephones = [];
    const datesNaissance = [];
    const residences = [];

    const prenomM = getValue('Prenom_M');
    const nomM = getValue('Nom_M');
    
    if (prenomM && nomM && prenomM !== '' && nomM !== '') {
        prenoms.push(cleanValue(prenomM));
        noms.push(cleanValue(nomM));
        const sexeMndt = getValue('Sexe_Mndt') || getValue('Sexe_M') || getValue('Sexe');
        sexes.push(cleanValue(sexeMndt));
        pieces.push(cleanValue(getValue('Num_piec') || getValue('Num_piece')));
        const tel1 = getValue('Telephon1');
        const tel2 = getValue('Telephon2');
        const telephone = getValue('Telephone');
        if (tel1 && tel1 !== '') {
            telephones.push(cleanValue(tel1));
        } else if (tel2 && tel2 !== '') {
            telephones.push(cleanValue(tel2));
        } else if (telephone && telephone !== '') {
            telephones.push(cleanValue(telephone));
        } else {
            telephones.push('-');
        }
        datesNaissance.push(cleanValue(getValue('Date_nai') || getValue('Date_nais') || getValue('Date_naissance')));
        residences.push(cleanValue(getValue('Residence_M') || getValue('Residence')));
    }

    const affectataires = new Map();
    headers.forEach((col, index) => {
        if (!col) return;
        let affectataireId = null;
        let fieldType = null;

        if (col === 'Prenom' || (col.startsWith('Prenom_') && col !== 'Prenom_M')) {
            fieldType = 'prenom';
            affectataireId = col === 'Prenom' ? '1' : col.replace('Prenom_', '');
        } else if (col === 'Nom' || (col.startsWith('Nom_') && col !== 'Nom_M')) {
            fieldType = 'nom';
            affectataireId = col === 'Nom' ? '1' : col.replace('Nom_', '');
        } else if ((col === 'Sexe' || col.startsWith('Sexe_')) && !['Sexe_Mndt', 'Sexe_M'].includes(col)) {
            fieldType = 'sexe';
            affectataireId = col === 'Sexe' ? '1' : col.replace('Sexe_', '');
        } else if (col.startsWith('Num_piece') && !['Num_piec', 'Num_piece'].includes(col)) {
            fieldType = 'numero_piece';
            affectataireId = col.replace('Num_piece_', '').replace('Num_piece', '1');
        } else if (col.startsWith('Telephon') && !['Telephon1', 'Telephon2'].includes(col)) {
            fieldType = 'telephone';
            const telNum = col.replace('Telephon', '');
            if (telNum === '3') affectataireId = '1';
            else if (parseInt(telNum) > 3) affectataireId = String(parseInt(telNum) - 2);
        } else if (col.startsWith('Date_nais') || col.startsWith('Dat_nais')) {
            fieldType = 'date_naissance';
            affectataireId = col.replace('Date_nais', '').replace('Dat_nais', '') || '1';
        } else if (col.startsWith('Residence') && !['Residence_M'].includes(col)) {
            fieldType = 'residence';
            affectataireId = col.replace('Residence', '') || '1';
        }

        if (affectataireId && fieldType) {
            affectataireId = affectataireId.replace(/^0+/, '') || '1';
            if (!affectataires.has(affectataireId)) {
                affectataires.set(affectataireId, {});
            }
            const value = row[index];
            if (value !== undefined && value !== null && value !== '') {
                affectataires.get(affectataireId)[fieldType] = cleanValue(value);
            }
        }
    });

    const sortedIds = Array.from(affectataires.keys()).sort((a, b) => {
        const numA = parseInt(a) || 999;
        const numB = parseInt(b) || 999;
        return numA - numB;
    });

    sortedIds.forEach(affectataireId => {
        const info = affectataires.get(affectataireId);
        if (info.prenom && info.nom) {
            const isDuplicate = (info.prenom === cleanValue(prenomM) && info.nom === cleanValue(nomM));
            if (!isDuplicate) {
                prenoms.push(info.prenom);
                noms.push(info.nom);
                sexes.push(info.sexe || '-');
                pieces.push(info.numero_piece || '-');
                telephones.push(info.telephone || '-');
                datesNaissance.push(info.date_naissance || '-');
                residences.push(info.residence || '-');
            }
        }
    });

    if (prenoms.length < 2) {
        const nicad = getValue('nicad') || getValue('Num_parcel_2') || 'inconnue';
        collectiveParcelErrors.push(`Parcelle ${nicad}: Seulement ${prenoms.length} individu(s) trouvé(s)`);
        window.BoundouDashboard.showToast(`Parcelle ${nicad} exclue : moins de 2 individus`, 'warning');
        return null;
    }

    return {
        'Village': cleanValue(getValue('Village')),
        'nicad': cleanValue(getValue('nicad') || getValue('Num_parcel_2')),
        'Num_parcel_2': cleanValue(getValue('Num_parcel_2')),
        'Prenom': prenoms.join('\n'),
        'Nom': noms.join('\n'),
        'Sexe': sexes.join('\n'),
        'Numero_piece': pieces.join('\n'),
        'Telephone': telephones.join('\n'),
        'Date_naissance': datesNaissance.join('\n'),
        'Residence': residences.join('\n'),
        'superficie': cleanValue(getValue('superficie')),
        'Vocation_1': cleanValue(getValue('Vocation_1')),
        'type_usa': cleanValue(getValue('type_usa'))
    };
}

function processFile(type) {
    const originalData = type === 'individual' ? window.BoundouDashboard.originalIndividualData : window.BoundouDashboard.originalCollectiveData;
    if (!originalData || originalData.length === 0) {
        showToast('Aucun fichier chargé', 'error');
        return;
    }

    const processBtn = document.getElementById(`generate-${type}`);
    const processText = document.getElementById(`processText${type.charAt(0).toUpperCase() + type.slice(1)}`);
    processText.innerHTML = '<span class="loading"></span>Traitement en cours...';
    processBtn.disabled = true;

    setTimeout(() => {
        try {
            const headers = originalData[0];
            const dataRows = originalData.slice(1);
            const results = type === 'individual' ? processIndividualData(originalData) : processCollectiveData(originalData);
            if (type === 'individual') {
                window.BoundouDashboard.processedIndividualData = results;
            } else {
                window.BoundouDashboard.processedCollectiveData = results;
            }

            const totalRows = dataRows.length;
            const validCount = results.length;
            const errorCount = totalRows - validCount;

            window.DeliberationListGenerator.displayFileInfo(originalData, type);
            window.DeliberationListGenerator.displayResults(totalRows, validCount, errorCount, collectiveParcelErrors, type);
            generateDeliberationList(type);
            processBtn.disabled = false;
            processText.innerHTML = `Traiter et Générer Liste ${type === 'individual' ? 'Individuelle' : 'Collective'}`;
            showToast(`Traitement terminé : ${validCount} parcelles valides`, 'success');
        } catch (error) {
            console.error('Erreur lors du traitement:', error);
            showToast('Erreur lors du traitement du fichier', 'error');
            processBtn.disabled = false;
            processText.innerHTML = `Traiter et Générer Liste ${type === 'individual' ? 'Individuelle' : 'Collective'}`;
        }
    }, 100);
}

function generateDeliberationList(type) {
    if (window.BoundouDashboard.isProcessingFile) {
        showToast('Traitement en cours, veuillez patienter', 'error');
        return;
    }

    const data = type === 'individual' ? window.BoundouDashboard.processedIndividualData : window.BoundouDashboard.processedCollectiveData;
    if (!data || data.length === 0) {
        showToast('Aucune donnée à traiter', 'error');
        return;
    }

    const columns = window.DeliberationListGenerator.getOrderedColumns(data);
    const orderedData = data.map(row => {
        const orderedRow = {};
        columns.forEach(col => {
            orderedRow[col] = row[col] || '';
        });
        return orderedRow;
    });

    const ws = XLSX.utils.json_to_sheet(orderedData, { header: columns });
    const colWidths = columns.map(col => {
        if (['Village', 'Residence'].includes(col)) return { wch: 20 };
        if (['nicad', 'Num_parcel_2'].includes(col)) return { wch: 15 };
        if (['Prenom', 'Nom'].includes(col)) return { wch: 15 };
        if (['Numero_piece', 'Telephone'].includes(col)) return { wch: 15 };
        if (['Date_naissance'].includes(col)) return { wch: 12 };
        return { wch: 10 };
    });
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, type === 'individual' ? 'LISTE_INDIVIDUELLES' : 'LISTE_COLLECTIVES');

    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    const fileName = type === 'individual' ? `LISTE_INDIVIDUELLES_${dateStr}.xlsx` : `LISTE_COLLECTIVES_${dateStr}.xlsx`;
    XLSX.writeFile(wb, fileName);

    const confirmationHtml = `
        <div class="results-section" style="margin-top: 20px;">
            <h3>📥 Téléchargement terminé</h3>
            <p><strong>Fichier généré :</strong> ${fileName}</p>
            <p><strong>Nombre de parcelles :</strong> ${data.length}</p>
            <p><strong>Colonnes incluses :</strong> ${columns.length}</p>
            <div style="margin-top: 10px; padding: 10px; background: #e8f5e8; border-radius: 5px;">
                <small><strong>💡 Format :</strong> Chaque ligne représente une parcelle avec tous les affectataires regroupés dans les mêmes colonnes (séparés par des retours à la ligne)</small>
            </div>
        </div>
    `;
    const resultsDiv = document.getElementById(`results${type.charAt(0).toUpperCase() + type.slice(1)}`);
    if (resultsDiv) {
        resultsDiv.innerHTML += confirmationHtml;
    }

    showToast(`Liste ${type === 'individual' ? 'individuelle' : 'collective'} générée : ${fileName}`, 'success');
}

function resetDeliberationData() {
    window.BoundouDashboard.processedIndividualData = [];
    window.BoundouDashboard.processedCollectiveData = [];
    window.BoundouDashboard.originalIndividualData = null;
    window.BoundouDashboard.originalCollectiveData = null;
    document.getElementById('fileNameIndividual').textContent = '';
    document.getElementById('fileNameCollective').textContent = '';
    document.getElementById('fileInfoIndividual').style.display = 'none';
    document.getElementById('fileInfoCollective').style.display = 'none';
    document.getElementById('resultsIndividual').style.display = 'none';
    document.getElementById('resultsCollective').style.display = 'none';
    document.getElementById('previewIndividual').style.display = 'none';
    document.getElementById('previewCollective').style.display = 'none';
    document.getElementById('generate-individual').disabled = true;
    document.getElementById('generate-collective').disabled = true;
    showToast('Données de délibération réinitialisées', 'info');
}

async function initializeApp() {
    try {
        initializePerformanceMonitoring();
        initializeTheme();
        await retryDataLoad();
        initializeMap(); // Ensure map is initialized
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay to ensure map rendering
        initializeEventHandlers();
        initializeSubTabs();
        initializeFilters();
        initializeSearch();
        initializePrint();
        initializeAccessibility();
        updateGlobalStats();
        window.addEventListener('resize', handleResize);
        registerServiceWorker();
        loadUserPreferences(); // Move this after map initialization
        showToast('Application initialisée avec succès!', 'success');
        console.log('Application Boundou Dashboard initialized');
    } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
        showToast('Erreur lors du chargement de l\'application', 'error');
    } finally {
        document.getElementById('loading-screen')?.classList.add('hidden');
    }
}

function saveUserPreferences() {
    localStorage.setItem('userPreferences', JSON.stringify({
        theme: document.documentElement.dataset.colorScheme,
        fontScale: fontScale,
        lastActiveSection: document.querySelector('.tab-button.active')?.dataset.section,
        lastSelectedCommune: lastSelectedCommune
    }));
}

function loadUserPreferences() {
    setTimeout(() => {
        const saved = localStorage.getItem('userPreferences');
        if (!saved) return;
        try {
            const preferences = JSON.parse(saved);
            if (preferences.theme) document.documentElement.dataset.colorScheme = preferences.theme;
            if (preferences.fontScale) {
                fontScale = preferences.fontScale;
                document.documentElement.style.setProperty('--font-scale', fontScale);
            }
            if (preferences.lastActiveSection) {
                switchSection(preferences.lastActiveSection);
            }
            if (preferences.lastSelectedCommune && communesLayer) {
                lastSelectedCommune = preferences.lastSelectedCommune;
                const layer = communesLayer.getLayers().find(l => getCommuneName(l.feature.properties) === lastSelectedCommune);
                if (layer) zoomToCommune(lastSelectedCommune, layer);
                else console.warn('No layer found for commune:', lastSelectedCommune);
            }
        } catch (error) {
            console.warn('Erreur lors du chargement des préférences:', error);
        }
    }, 500); // Delay to ensure map initialization
}

window.addEventListener('beforeunload', saveUserPreferences);
document.addEventListener('DOMContentLoaded', () => {
    loadUserPreferences();
    initializeApp();
});

window.addEventListener('error', (event) => {
    console.error('Erreur globale:', event.error);
    showToast('Une erreur inattendue s\'est produite', 'error');
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Promise rejetée:', event.reason);
    showToast('Erreur de traitement des données', 'error');
});

// Extend the global BoundouDashboard object with additional methods
Object.assign(window.BoundouDashboard, {
    switchSection,
    showCommuneDetails,
    applyFilters,
    exportDataHandler,
    exportToGeoJSON,
    retryDataLoad,
    loadExcelFile,
    processIndividualData,
    processCollectiveData,
    generateDeliberationList,
    resetDeliberationData,
    showToast,
    cleanValue,
    formatParcelData
});
