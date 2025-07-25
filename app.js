// === Boundou Dashboard Application ===
// Global variables
let map;
let communesLayer;
let parcellesData = [];
let communesData = null;
let currentCharts = {};
let fontScale = 1;
let filteredParcellesData = [];

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
          <p><strong>Superficie totale:</strong> ${communeStats.superficieTotale.toFixed(1)} ha</p>
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

  if (communesData.features?.length > 0) map.fitBounds(communesLayer.getBounds());
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
  if (closeStats) closeStats.addEventListener('click', () => document.getElementById('stats-panel')?.classList.add('hidden'));

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
    const layer = communesLayer.getLayers().find(l => getCommuneName(l.feature.properties) === communeValue);
    if (layer) zoomToCommune(communeValue, layer);
  }

  showToast(`${filteredParcellesData.length} parcelles trouvées`, 'info');
}

function exportDataHandler() {
  const csv = convertToCSV(filteredParcellesData);
  downloadCSV(csv, 'parcelles_boundou.csv');
  showToast('Données exportées avec succès', 'success');
}

function convertToCSV(data) {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')].concat(
    data.map(row => headers.map(header => {
      const value = row[header];
      return value === null || value === undefined ? '' : 
             typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
    }).join(','))
  );
  return csvRows.join('\n');
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
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

async function initializeApp() {
  try {
    initializePerformanceMonitoring();
    initializeTheme();
    await retryDataLoad();
    initializeMap();
    initializeEventHandlers();
    initializeFilters();
    initializeSearch();
    initializePrint();
    initializeAccessibility();
    updateGlobalStats();
    window.addEventListener('resize', handleResize);
    registerServiceWorker();
    showToast('Application initialisée avec succès!', 'success');
    console.log('Application Boundou Dashboard initialisée');
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
    lastActiveSection: document.querySelector('.tab-button.active')?.dataset.section
  }));
}

function loadUserPreferences() {
  const saved = localStorage.getItem('userPreferences');
  if (!saved) return;
  try {
    const preferences = JSON.parse(saved);
    if (preferences.theme) document.documentElement.dataset.colorScheme = preferences.theme;
    if (preferences.fontScale) {
      fontScale = preferences.fontScale;
      document.documentElement.style.setProperty('--font-scale', fontScale);
    }
    if (preferences.lastActiveSection) setTimeout(() => switchSection(preferences.lastActiveSection), 100);
  } catch (error) {
    console.warn('Erreur lors du chargement des préférences:', error);
  }
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

window.BoundouDashboard = {
  switchSection,
  showCommuneDetails,
  applyFilters,
  exportDataHandler,
  exportToGeoJSON,
  retryDataLoad
};