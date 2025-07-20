// Global variables
let map;
let communesLayer;
let parcellesData = [];
let communesData = null;
let currentCharts = {};
let fontScale = 1;

// PATCH: filtres indépendants
let mapFilteredParcellesData = [];
let statsFilteredParcellesData = [];

// Colors palette
const colors = {
  primary: '#1B3B59',
  secondary: '#D2691E', 
  accent: '#4A7C59',
  warning: '#F4A460',
  background: '#F5E6D3',
  chartColors: [
    '#1FB8CD', '#FFC185', '#B4413C', '#ECEBD5', '#5D878F', 
    '#DB4545', '#D2BA4C', '#964325', '#944454', '#13343B'
  ]
};

// Utility functions
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideInRight 0.3s ease reverse';
    setTimeout(() => {
      if (container.contains(toast)) {
        container.removeChild(toast);
      }
    }, 300);
  }, 3000);
}

function animateValue(element, start, end, duration = 1000) {
  if (!element) return;
  const startTime = performance.now();
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const current = start + (end - start) * progress;
    element.textContent = typeof end === 'number'
      ? (end % 1 === 0 ? Math.floor(current) : current.toFixed(1))
      : end;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// Data loading
async function loadExternalData() {
  try {
    showToast('Chargement des données...', 'info');
    const communesResponse = await fetch('data/communes_boundou.geojson');
    if (!communesResponse.ok) throw new Error(`Erreur de chargement du GeoJSON: ${communesResponse.status}`);
    communesData = await communesResponse.json();
    const parcellesResponse = await fetch('data/parcelles.json');
    if (!parcellesResponse.ok) throw new Error(`Erreur de chargement des parcelles: ${parcellesResponse.status}`);
    parcellesData = await parcellesResponse.json();
    mapFilteredParcellesData = [...parcellesData];
    statsFilteredParcellesData = [...parcellesData];
    showToast('Données chargées avec succès!', 'success');
    return true;
  } catch (error) {
    showToast(`Erreur: ${error.message}`, 'error');
    communesData = getSampleGeoJSON();
    parcellesData = getSampleParcelles();
    mapFilteredParcellesData = [...parcellesData];
    statsFilteredParcellesData = [...parcellesData];
    return false;
  }
}

function getSampleGeoJSON() {
  return {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature", 
        "properties": {
          "REG": "Tambacounda",
          "DEPT": "Goudiry",
          "CAV": "Boundou",
          "CCRCA": "Koussan",
          "CCRCA_1": "KOUSSAN",
          "NOM": "KOUSSAN",
          "CODE": "23301"
        },
        "geometry": {
          "type": "Polygon",
          "coordinates": [[[-12.1, 14.2], [-12.0, 14.2], [-12.0, 14.3], [-12.1, 14.3], [-12.1, 14.2]]]
        }
      }
    ]
  };
}

function getSampleParcelles() {
  return [
    {
      "id_parcelle": "0522030300264",
      "commune": "KOUSSAN",
      "village": "koulare",
      "nicad": "Non", 
      "superficie": 2.5,
      "type_usag": "Agriculture_irriguée",
      "deliberee": "Non",
      "autorite_delib": "Non spécifié",
      "numero_cadastrale": null
    }
  ];
}

// Data processing
function calculateCommuneStats(commune, dataSource) {
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

function getColorByParcelleCount(count) {
  if (count === 0) return '#E5E5E5';
  if (count <= 1) return colors.primary;
  if (count <= 2) return colors.accent; 
  return colors.warning;
}

function getCommuneName(properties) {
  if (!properties) return 'Commune inconnue';
  return properties.CCRCA_1 || properties.CCRCA || properties.NOM || 'Commune inconnue';
}

function initializeMap() {
  if (!document.getElementById('map')) return;
  map = L.map('map').setView([12.5, -12.0], 8);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 18
  }).addTo(map);
  loadCommunesLayer(mapFilteredParcellesData);
}

function loadCommunesLayer(data) {
  if (!map || !communesData) return;
  if (communesLayer) map.removeLayer(communesLayer);
  communesLayer = L.geoJSON(communesData, {
    style: function(feature) {
      const communeName = getCommuneName(feature.properties);
      const communeStats = calculateCommuneStats(communeName, data);
      const count = communeStats.totalParcelles;
      return {
        fillColor: getColorByParcelleCount(count),
        weight: 2,
        opacity: 1,
        color: '#2C2C2C',
        dashArray: '3',
        fillOpacity: 0.7
      };
    },
    onEachFeature: function(feature, layer) {
      const communeName = getCommuneName(feature.properties);
      const communeStats = calculateCommuneStats(communeName, data);
      const popupContent = `
        <div class="popup-content">
          <h3>${communeName}</h3>
          <p><strong>Région:</strong> ${feature.properties.REG || 'N/A'}</p>
          <p><strong>Département:</strong> ${feature.properties.DEPT || 'N/A'}</p>
          <p><strong>Parcelles:</strong> ${communeStats.totalParcelles}</p>
          <p><strong>Superficie:</strong> ${communeStats.superficieTotale.toFixed(1)} ha</p>
          <button onclick="showCommuneDetails('${communeName}')" class="btn btn--primary btn--sm">
            Voir les détails
          </button>
        </div>
      `;
      layer.bindPopup(popupContent);
      layer.on({
        mouseover: function(e) { e.target.setStyle({ weight: 3, fillOpacity: 0.9 }); },
        mouseout: function(e) { communesLayer.resetStyle(e.target); },
        click: function(e) { showCommuneDetails(communeName); }
      });
    }
  }).addTo(map);
  if (communesData.features && communesData.features.length > 0) {
    map.fitBounds(communesLayer.getBounds());
  }
}

function showCommuneDetails(communeName) {
  const stats = calculateCommuneStats(communeName, mapFilteredParcellesData);
  const panel = document.getElementById('stats-panel');
  if (!panel) return;
  const selectedCommune = document.getElementById('selected-commune');
  if (selectedCommune) selectedCommune.textContent = `Commune de ${communeName}`;
  animateValue(document.getElementById('total-parcelles'), 0, stats.totalParcelles);
  animateValue(document.getElementById('superficie-totale'), 0, stats.superficieTotale);
  const nicadPercentage = stats.totalParcelles > 0 ? Math.round((stats.nicadCount / stats.totalParcelles) * 100) : 0;
  const delibereesPercentage = stats.totalParcelles > 0 ? Math.round((stats.delibereesCount / stats.totalParcelles) * 100) : 0;
  setTimeout(() => {
    const nicadEl = document.getElementById('pourcentage-nicad');
    const delibereesEl = document.getElementById('pourcentage-deliberees');
    if (nicadEl) nicadEl.textContent = `${nicadPercentage}%`;
    if (delibereesEl) delibereesEl.textContent = `${delibereesPercentage}%`;
  }, 500);
  panel.classList.remove('hidden');
  setTimeout(() => {
    createUsageChart(stats.typesUsage);
    createStatusChart(stats.nicadCount, stats.delibereesCount, stats.totalParcelles);
  }, 600);
  showToast(`Détails chargés pour ${communeName}`, 'success');
}

function createUsageChart(typesUsage) {
  const ctx = document.getElementById('usage-chart');
  if (!ctx) return;
  if (currentCharts.usage) currentCharts.usage.destroy();
  const labels = Object.keys(typesUsage);
  const data = Object.values(typesUsage);
  if (labels.length === 0) {
    labels.push('Aucune donnée');
    data.push(1);
  }
  currentCharts.usage = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels.map(label => label.replace(/_/g, ' ')),
      datasets: [{
        data: data,
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
          position: 'bottom',
          labels: { font: { size: 12 }, padding: 15, usePointStyle: true }
        },
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
        {
          label: 'Oui',
          data: [nicadCount, delibereesCount],
          backgroundColor: [colors.accent, colors.secondary],
          borderRadius: 4
        },
        {
          label: 'Non',
          data: [total - nicadCount, total - delibereesCount],
          backgroundColor: ['#E5E5E5', '#E5E5E5'],
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true }
      },
      plugins: {
        legend: { position: 'top' },
        title: { display: true, text: 'Statuts des Parcelles', font: { size: 14, weight: 'bold' } }
      },
      animation: { duration: 1000, easing: 'easeInOutQuart' }
    }
  });
}

// PATCH: filtres indépendants
function applyMapFilters() {
  const communeFilter = document.getElementById('map-commune-filter');
  const usageFilter = document.getElementById('map-usage-filter');
  if (!communeFilter || !usageFilter) return;
  const communeValue = communeFilter.value;
  const usageValue = usageFilter.value;
  mapFilteredParcellesData = parcellesData.filter(p => {
    const communeMatch = !communeValue || p.commune === communeValue;
    const usageMatch = !usageValue || p.type_usag === usageValue;
    return communeMatch && usageMatch;
  });
  loadCommunesLayer(mapFilteredParcellesData);
  showToast(`${mapFilteredParcellesData.length} parcelles trouvées (Carte)`, 'info');
}

function applyStatsFilters() {
  const communeFilter = document.getElementById('stats-commune-filter');
  const usageFilter = document.getElementById('stats-usage-filter');
  if (!communeFilter || !usageFilter) return;
  const communeValue = communeFilter.value;
  const usageValue = usageFilter.value;
  statsFilteredParcellesData = parcellesData.filter(p => {
    const communeMatch = !communeValue || p.commune === communeValue;
    const usageMatch = !usageValue || p.type_usag === usageValue;
    return communeMatch && usageMatch;
  });
  updateGlobalStats(statsFilteredParcellesData);
  createGlobalCharts(statsFilteredParcellesData);
  showToast(`${statsFilteredParcellesData.length} parcelles trouvées (Stats)`, 'info');
}

function initializeFilters(communeFilterId, usageFilterId) {
  const communeSelect = document.getElementById(communeFilterId);
  const usageSelect = document.getElementById(usageFilterId);
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

function exportDataHandler(data, filename = 'parcelles_boundou.csv') {
  const csv = convertToCSV(data);
  downloadCSV(csv, filename);
  showToast(`Données exportées avec succès (${filename})`, 'success');
}

function convertToCSV(data) {
  if (!data || data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const csvHeaders = headers.join(',');
  const csvRows = data.map(row => 
    headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
    }).join(',')
  );
  return [csvHeaders, ...csvRows].join('\n');
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

function updateGlobalStats(data) {
  const totalCommunes = new Set(data.map(p => p.commune).filter(Boolean)).size;
  const totalParcelles = data.length;
  const superficieGlobale = data.reduce((sum, p) => sum + (parseFloat(p.superficie) || 0), 0);
  const nicadCount = data.filter(p => p.nicad === 'Oui').length;
  const delibereesCount = data.filter(p => p.deliberee === 'Oui').length;
  const totalCommunesEl = document.getElementById('total-communes');
  const totalParcellesEl = document.getElementById('total-parcelles-global');
  const superficieEl = document.getElementById('superficie-globale');
  const nicadPercentageEl = document.getElementById('nicad-percentage-global');
  const delibereesPercentageEl = document.getElementById('deliberees-percentage-global');
  if (totalCommunesEl) totalCommunesEl.textContent = totalCommunes;
  if (totalParcellesEl) totalParcellesEl.textContent = totalParcelles;
  if (superficieEl) superficieEl.textContent = superficieGlobale.toFixed(1);
  if (nicadPercentageEl && totalParcelles > 0) {
    const nicadPercentage = Math.round((nicadCount / totalParcelles) * 100);
    nicadPercentageEl.textContent = `${nicadPercentage}%`;
  }
  if (delibereesPercentageEl && totalParcelles > 0) {
    const delibereesPercentage = Math.round((delibereesCount / totalParcelles) * 100);
    delibereesPercentageEl.textContent = `${delibereesPercentage}%`;
  }
}

function createGlobalCharts(data) {
  setTimeout(() => {
    createCommunesChart(data);
    createGlobalUsageChart(data);
  }, 300);
}

function createCommunesChart(data) {
  const ctx = document.getElementById('communes-chart');
  if (!ctx || !communesData || !communesData.features) return;
  const communeNames = communesData.features.map(f => getCommuneName(f.properties));
  const parcelleCounts = communeNames.map(name =>
    calculateCommuneStats(name, data).totalParcelles
  );
  if (currentCharts.communes) currentCharts.communes.destroy();
  currentCharts.communes = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: communeNames,
      datasets: [{
        label: 'Nombre de parcelles',
        data: parcelleCounts,
        backgroundColor: colors.chartColors.slice(0, communeNames.length),
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
        x: { ticks: { maxRotation: 45, minRotation: 0 } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.label}: ${context.parsed.y} parcelle${context.parsed.y > 1 ? 's' : ''}`;
            }
          }
        }
      },
      animation: { duration: 1500, easing: 'easeInOutQuart' }
    }
  });
}

function createGlobalUsageChart(data) {
  const ctx = document.getElementById('global-usage-chart');
  if (!ctx) return;
  const usageStats = data.reduce((acc, p) => {
    if (p.type_usag) {
      acc[p.type_usag] = (acc[p.type_usag] || 0) + 1;
    }
    return acc;
  }, {});
  const labels = Object.keys(usageStats);
  const values = Object.values(usageStats);
  if (labels.length === 0) {
    labels.push('Aucune donnée');
    values.push(1);
  }
  if (currentCharts.globalUsage) currentCharts.globalUsage.destroy();
  currentCharts.globalUsage = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels.map(label => label.replace(/_/g, ' ')),
      datasets: [{
        data: values,
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
                return {
                  text: `${label} (${percentage}%)`,
                  fillStyle: data.datasets[0].backgroundColor[i],
                  hidden: false,
                  index: i
                };
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

function initializeEventHandlers() {
  // Carte
  const mapCommuneFilter = document.getElementById('map-commune-filter');
  const mapUsageFilter = document.getElementById('map-usage-filter');
  if (mapCommuneFilter) mapCommuneFilter.addEventListener('change', applyMapFilters);
  if (mapUsageFilter) mapUsageFilter.addEventListener('change', applyMapFilters);
  const mapExportData = document.getElementById('map-export-data');
  if (mapExportData) mapExportData.addEventListener('click', () =>
    exportDataHandler(mapFilteredParcellesData, 'parcelles_boundou_carte.csv')
  );

  // Statistiques
  const statsCommuneFilter = document.getElementById('stats-commune-filter');
  const statsUsageFilter = document.getElementById('stats-usage-filter');
  if (statsCommuneFilter) statsCommuneFilter.addEventListener('change', applyStatsFilters);
  if (statsUsageFilter) statsUsageFilter.addEventListener('change', applyStatsFilters);
  const statsExportData = document.getElementById('stats-export-data');
  if (statsExportData) statsExportData.addEventListener('click', () =>
    exportDataHandler(statsFilteredParcellesData, 'parcelles_boundou_stats.csv')
  );

  // Tab navigation
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', function() {
      const section = this.dataset.section;
      switchSection(section);
    });
  });

  // Dashboard tabs
  document.querySelectorAll('.dashboard-tab').forEach(button => {
    button.addEventListener('click', function() {
      const dashboard = this.dataset.dashboard;
      switchDashboard(dashboard);
    });
  });

  // Close stats panel
  const closeStats = document.getElementById('close-stats');
  if (closeStats) {
    closeStats.addEventListener('click', function() {
      const panel = document.getElementById('stats-panel');
      if (panel) panel.classList.add('hidden');
    });
  }

  // Theme toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }

  // Font size controls
  const fontIncrease = document.getElementById('font-increase');
  const fontDecrease = document.getElementById('font-decrease');
  if (fontIncrease) fontIncrease.addEventListener('click', () => adjustFontSize(0.1));
  if (fontDecrease) fontDecrease.addEventListener('click', () => adjustFontSize(-0.1));
}

function switchSection(sectionName) {
  document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
  const activeTab = document.querySelector(`[data-section="${sectionName}"]`);
  if (activeTab) activeTab.classList.add('active');
  document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));
  const activeSection = document.getElementById(`${sectionName}-section`);
  if (activeSection) activeSection.classList.add('active');
  if (sectionName === 'stats') {
    updateGlobalStats(statsFilteredParcellesData);
    createGlobalCharts(statsFilteredParcellesData);
  } else if (sectionName === 'map') {
    setTimeout(() => map && map.invalidateSize(), 100);
  }
}

function switchDashboard(dashboardName) {
  document.querySelectorAll('.dashboard-tab').forEach(btn => btn.classList.remove('active'));
  const activeTab = document.querySelector(`[data-dashboard="${dashboardName}"]`);
  if (activeTab) activeTab.classList.add('active');
  const iframe = document.getElementById('dashboard-frame');
  const loading = document.querySelector('.dashboard-loading');
  if (!iframe) return;
  const urls = {
    'boundou': 'https://boundoudash.netlify.app/',
    'edl': 'https://edlinventairesboundou.netlify.app/'
  };
  if (loading) loading.style.display = 'block';
  iframe.src = urls[dashboardName] || '';
  iframe.onload = function() {
    setTimeout(() => {
      if (loading) loading.style.display = 'none';
    }, 1000);
  };
}

function toggleTheme() {
  const currentTheme = document.documentElement.dataset.colorScheme || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.colorScheme = newTheme;
  const themeIcon = document.querySelector('.theme-icon');
  if (themeIcon) themeIcon.textContent = newTheme === 'light' ? '🌙' : '☀️';
  localStorage.setItem('theme', newTheme);
  showToast(`Mode ${newTheme === 'dark' ? 'sombre' : 'clair'} activé`, 'success');
}

function adjustFontSize(delta) {
  fontScale = Math.max(0.8, Math.min(1.4, fontScale + delta));
  document.documentElement.style.setProperty('--font-scale', fontScale);
  showToast(`Taille du texte: ${Math.round(fontScale * 100)}%`, 'info');
}

async function initializeApp() {
  await loadExternalData();
  initializeFilters('map-commune-filter', 'map-usage-filter');
  initializeFilters('stats-commune-filter', 'stats-usage-filter');
  initializeEventHandlers();
  initializeMap();
  loadCommunesLayer(mapFilteredParcellesData);
  updateGlobalStats(statsFilteredParcellesData);
  createGlobalCharts(statsFilteredParcellesData);
}

document.addEventListener('DOMContentLoaded', initializeApp);
