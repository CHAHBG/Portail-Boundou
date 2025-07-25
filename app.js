// Global variables
let map;
let communesLayer;
let parcellesData = [];
let communesData = null;
let currentCharts = {};
let fontScale = 1;
let filteredParcellesData = []; // Pour les données filtrées

// Configuration des communes avec statut d'opération
const communesConfig = {
  // Communes avec opérations en cours (selon vos données)
  'NDOGA BABACAR': { status: 'active', hasOperations: true },
  'MISSIRAH': { status: 'active', hasOperations: true },
  'BANDAFASSI': { status: 'active', hasOperations: true },
  'NETTEBOULOU': { status: 'active', hasOperations: true },
  'FONGOLEMBI': { status: 'active', hasOperations: true },
  'DIMBOLI': { status: 'active', hasOperations: true },
  'GABOU': { status: 'active', hasOperations: true },
  'BEMBOU': { status: 'active', hasOperations: true },
  'DINDEFELLO': { status: 'active', hasOperations: true },
  'TOMBORONKOTO': { status: 'active', hasOperations: true },
  'BALLOU': { status: 'active', hasOperations: true },
  'MOUDERY': { status: 'active', hasOperations: true },
  'BALA': { status: 'active', hasOperations: true },
  'KOAR': { status: 'active', hasOperations: true },
  
  // Communes avec opérations non démarrées
  'SABODALA': { status: 'pending', hasOperations: false },
  'MEDINA BAFFE': { status: 'pending', hasOperations: false },
  'SINTHIOU MALEME': { status: 'pending', hasOperations: false }
  
  // Note: KOUSSAN, DOUGUE, BANI ISRAEL ne sont plus dans vos données
  // Les communes restantes du GeoJSON (sans configuration) seront considérées comme "hors zone"
};

// Colors palette
const colors = {
  primary: '#1B3B59',
  secondary: '#D2691E', 
  accent: '#4A7C59',
  warning: '#F4A460',
  background: '#F5E6D3',
  // Nouvelles couleurs pour les statuts d'opération
  operationsActive: '#2E8B57',    // Vert pour opérations en cours
  operationsPending: '#D3D3D3',   // Gris pour opérations non démarrées
  operationsActiveHover: '#228B22',
  operationsPendingHover: '#A9A9A9',
  chartColors: ['#1FB8CD', '#FFC185', '#B4413C', '#ECEBD5', '#5D878F', '#DB4545', '#D2BA4C', '#964325', '#944454', '#13343B']
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
    element.textContent = typeof end === 'number' ? 
      (end % 1 === 0 ? Math.floor(current) : current.toFixed(1)) : 
      end;
    
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  
  requestAnimationFrame(update);
}

// Fonction de validation des données
function validateData(communesData, parcellesData) {
  const errors = [];
  
  if (!communesData || !communesData.features || !Array.isArray(communesData.features)) {
    errors.push('Structure GeoJSON invalide');
  }
  
  if (!Array.isArray(parcellesData)) {
    errors.push('Le fichier parcelles.json doit contenir un array');
  }
  
  // Vérification de la cohérence des noms de communes
  if (communesData.features && parcellesData.length > 0) {
    const communeNames = new Set(
      communesData.features.map(f => getCommuneName(f.properties))
    );
    const parcelleCommunes = new Set(
      parcellesData.map(p => p.commune).filter(Boolean)
    );
    
    const missingCommunes = [...parcelleCommunes].filter(c => !communeNames.has(c));
    if (missingCommunes.length > 0) {
      console.warn('Communes dans parcelles mais pas dans GeoJSON:', missingCommunes);
    }
  }
  
  return errors;
}

// Fonction pour débugger les données
function debugData() {
  console.log('=== DEBUG BOUNDOU DASHBOARD ===');
  console.log('Communes dans GeoJSON:', communesData?.features?.map(f => getCommuneName(f.properties)));
  console.log('Communes dans parcelles:', [...new Set(parcellesData.map(p => p.commune).filter(Boolean))]);
  console.log('Configuration communes:', Object.keys(communesConfig));
  
  // Analyse détaillée par commune
  const communesAvecParcelles = [...new Set(parcellesData.map(p => p.commune).filter(Boolean))];
  console.log('Analyse par commune:', 
    communesAvecParcelles.map(commune => ({
      commune,
      count: parcellesData.filter(p => p.commune === commune).length,
      config: communesConfig[commune.toUpperCase()] || 'Non configurée',
      status: communesConfig[commune.toUpperCase()]?.status || 'non défini'
    }))
  );
  
  // Vérifier les communes du GeoJSON sans parcelles
  const communesGeoJSON = communesData?.features?.map(f => getCommuneName(f.properties)) || [];
  const communesSansParcelles = communesGeoJSON.filter(c => !communesAvecParcelles.includes(c));
  console.log('Communes du GeoJSON sans parcelles:', communesSansParcelles);
  
  // Statistiques générales
  console.log('Statistiques générales:', {
    totalParcelles: parcellesData.length,
    totalCommunesAvecParcelles: communesAvecParcelles.length,
    totalCommunesGeoJSON: communesGeoJSON.length,
    filteredParcelles: filteredParcellesData.length
  });
}

// Data loading functions
async function loadExternalData() {
  try {
    showToast('Chargement des données...', 'info');
    
    // Load GeoJSON data
    const communesResponse = await fetch('data/communes_boundou.geojson');
    if (!communesResponse.ok) {
      throw new Error(`Erreur de chargement du GeoJSON: ${communesResponse.status}`);
    }
    communesData = await communesResponse.json();
    
    // Load parcelles data
    const parcellesResponse = await fetch('data/parcelles.json');
    if (!parcellesResponse.ok) {
      throw new Error(`Erreur de chargement des parcelles: ${parcellesResponse.status}`);
    }
    parcellesData = await parcellesResponse.json();
    
    // Validate data structure
    const validationErrors = validateData(communesData, parcellesData);
    if (validationErrors.length > 0) {
      throw new Error(`Erreurs de validation: ${validationErrors.join(', ')}`);
    }
    
    // Initialiser les données filtrées
    filteredParcellesData = [...parcellesData];
    
    // Check commune name consistency
    const communeNames = communesData.features.map(f => getCommuneName(f.properties));
    const parcelleCommunes = [...new Set(parcellesData.map(p => p.commune).filter(Boolean))];
    
    console.log('Communes dans GeoJSON:', communeNames);
    console.log('Communes dans parcelles:', parcelleCommunes);
    
    // *** AJOUT : Appel de la fonction debug après chargement des données ***
    debugData();
    
    showToast('Données chargées avec succès!', 'success');
    return true;
    
  } catch (error) {
    console.error('Erreur de chargement des données:', error);
    showToast(`Erreur: ${error.message}`, 'error');
    
    // Fallback to sample data
    showToast('Utilisation des données d\'exemple', 'warning');
    communesData = getSampleGeoJSON();
    parcellesData = getSampleParcelles();
    filteredParcellesData = [...parcellesData];
    
    // Debug même avec les données d'exemple
    debugData();
    
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

// Data processing functions
function calculateCommuneStats(commune, dataSource = parcellesData) {
  const communeParcelles = dataSource.filter(p => p.commune === commune);
  
  return {
    totalParcelles: communeParcelles.length,
    superficieTotale: communeParcelles.reduce((sum, p) => sum + (parseFloat(p.superficie) || 0), 0),
    nicadCount: communeParcelles.filter(p => p.nicad === 'Oui').length,
    delibereesCount: communeParcelles.filter(p => p.deliberee === 'Oui').length,
    typesUsage: communeParcelles.reduce((acc, p) => {
      if (p.type_usag) {
        acc[p.type_usag] = (acc[p.type_usag] || 0) + 1;
      }
      return acc;
    }, {})
  };
}

// Nouvelle fonction pour obtenir la couleur basée sur le statut d'opération
function getColorByOperationStatus(communeName, parcelleCount) {
  if (!communeName || typeof communeName !== 'string') {
    return '#F0F0F0'; // Gris pour données invalides
  }
  
  const config = communesConfig[communeName.toUpperCase()];
  
  if (!config) {
    // Commune non configurée (hors zone PROCASEF)
    return '#F0F0F0'; // Gris très clair
  }
  
  if (config.status === 'pending') {
    // Opérations non démarrées
    return colors.operationsPending;
  }
  
  // Opérations en cours - couleur verte
  return colors.operationsActive;
}

function getCommuneName(properties) {
  if (!properties) return 'Commune inconnue';
  return properties.CCRCA_1 || properties.CCRCA || properties.NOM || 'Commune inconnue';
}

// Map functions
function initializeMap() {
  if (!document.getElementById('map')) {
    console.warn('Element map non trouvé');
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
  
  if (communesLayer) {
    map.removeLayer(communesLayer);
  }
  
  communesLayer = L.geoJSON(communesData, {
    style: function(feature) {
      const communeName = getCommuneName(feature.properties);
      const communeStats = calculateCommuneStats(communeName, filteredParcellesData);
      const count = communeStats.totalParcelles;
      const config = communesConfig[communeName.toUpperCase()];
      
      let fillColor = getColorByOperationStatus(communeName, count);
      let opacity = 0.7;
      
      // Si c'est une commune hors zone PROCASEF, réduire l'opacité
      if (!config) {
        opacity = 0.3;
      }
      
      return {
        fillColor: fillColor,
        weight: 2,
        opacity: 1,
        color: '#2C2C2C',
        dashArray: config ? '0' : '5,5', // Ligne pointillée pour les communes hors zone
        fillOpacity: opacity
      };
    },
    onEachFeature: function(feature, layer) {
      const communeName = getCommuneName(feature.properties);
      const communeStats = calculateCommuneStats(communeName, filteredParcellesData);
      const config = communesConfig[communeName.toUpperCase()];
      
      let statusText = 'Hors zone PROCASEF';
      let buttonHtml = '';
      
      if (config) {
        statusText = config.status === 'active' ? 
          'Opérations foncières en cours' : 
          'Opérations foncières non démarrées';
        
        if (config.hasOperations && communeStats.totalParcelles > 0) {
          buttonHtml = `
            <button onclick="showCommuneDetails('${communeName}')" class="btn btn--primary btn--sm">
              Voir les détails
            </button>
          `;
        }
      }
      
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
          const layer = e.target;
          layer.setStyle({
            weight: 3,
            fillOpacity: config ? 0.9 : 0.5
          });
        },
        mouseout: function(e) {
          communesLayer.resetStyle(e.target);
        },
        click: function(e) {
          if (config && config.hasOperations && communeStats.totalParcelles > 0) {
            showCommuneDetails(communeName);
          }
        }
      });
    }
  }).addTo(map);
  
  if (communesData.features && communesData.features.length > 0) {
    map.fitBounds(communesLayer.getBounds());
  }
}

// Nouvelle fonction pour mettre à jour la légende de la carte
function updateMapLegend() {
  const legendElement = document.querySelector('.map-legend');
  if (!legendElement) return;
  
  legendElement.innerHTML = `
    <h4>Légende</h4>
    <div class="legend-item">
      <span class="legend-color" style="background: ${colors.operationsActive}"></span>
      <span>Opérations foncières en cours</span>
    </div>
    <div class="legend-item">
      <span class="legend-color" style="background: ${colors.operationsPending}"></span>
      <span>Opérations foncières non démarrées</span>
    </div>
    <div class="legend-item">
      <span class="legend-color" style="background: #F0F0F0; border: 1px dashed #999"></span>
      <span>Hors zone PROCASEF</span>
    </div>
  `;
}

function showCommuneDetails(communeName) {
  const stats = calculateCommuneStats(communeName, filteredParcellesData);
  const panel = document.getElementById('stats-panel');
  
  if (!panel) return;
  
  // Update commune name
  const selectedCommune = document.getElementById('selected-commune');
  if (selectedCommune) {
    selectedCommune.textContent = `Commune de ${communeName}`;
  }
  
  // Animate statistics avec nouveau libellé
  animateValue(document.getElementById('total-parcelles'), 0, stats.totalParcelles);
  animateValue(document.getElementById('superficie-totale'), 0, stats.superficieTotale);
  
  const nicadPercentage = stats.totalParcelles > 0 ? 
    Math.round((stats.nicadCount / stats.totalParcelles) * 100) : 0;
  const delibereesPercentage = stats.totalParcelles > 0 ? 
    Math.round((stats.delibereesCount / stats.totalParcelles) * 100) : 0;
  
  setTimeout(() => {
    const nicadEl = document.getElementById('pourcentage-nicad');
    const delibereesEl = document.getElementById('pourcentage-deliberees');
    if (nicadEl) nicadEl.textContent = `${nicadPercentage}%`;
    if (delibereesEl) delibereesEl.textContent = `${delibereesPercentage}%`;
  }, 500);
  
  // Show panel
  panel.classList.remove('hidden');
  
  // Create charts with delay to ensure proper rendering
  setTimeout(() => {
    createUsageChart(stats.typesUsage);
    createStatusChart(stats.nicadCount, stats.delibereesCount, stats.totalParcelles);
  }, 600);
  
  showToast(`Détails chargés pour ${communeName}`, 'success');
}

// Chart functions
function createUsageChart(typesUsage) {
  const ctx = document.getElementById('usage-chart');
  if (!ctx) return;
  
  if (currentCharts.usage) {
    currentCharts.usage.destroy();
  }
  
  const labels = Object.keys(typesUsage);
  const data = Object.values(typesUsage);
  
  // Handle empty data case
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
          labels: {
            font: {
              size: 12
            },
            padding: 15,
            usePointStyle: true
          }
        },
        title: {
          display: true,
          text: 'Types d\'Usage',
          font: {
            size: 14,
            weight: 'bold'
          }
        }
      },
      animation: {
        animateRotate: true,
        duration: 1000
      }
    }
  });
}

function createStatusChart(nicadCount, delibereesCount, total) {
  const ctx = document.getElementById('status-chart');
  if (!ctx) return;
  
  if (currentCharts.status) {
    currentCharts.status.destroy();
  }
  
  currentCharts.status = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['NICAD', 'Délibérées'],
      datasets: [{
        label: 'Oui',
        data: [nicadCount, delibereesCount],
        backgroundColor: [colors.accent, colors.secondary],
        borderRadius: 4
      }, {
        label: 'Non',
        data: [total - nicadCount, total - delibereesCount],
        backgroundColor: ['#E5E5E5', '#E5E5E5'],
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true
        },
        y: {
          stacked: true,
          beginAtZero: true
        }
      },
      plugins: {
        legend: {
          position: 'top'
        },
        title: {
          display: true,
          text: 'Statuts des Parcelles',
          font: {
            size: 14,
            weight: 'bold'
          }
        }
      },
      animation: {
        duration: 1000,
        easing: 'easeInOutQuart'
      }
    }
  });
}

function createGlobalCharts() {
  // Delay to ensure elements are visible
  setTimeout(() => {
    createCommunesChart();
    createGlobalUsageChart();
  }, 300);
}

function createCommunesChart() {
  const ctx = document.getElementById('communes-chart');
  if (!ctx || !communesData || !communesData.features) return;
  
  // *** CORRECTION ***
  // Afficher toutes les communes qui ont des parcelles, avec couleurs différentes selon le statut
  const communeNames = [...new Set(parcellesData.map(p => p.commune).filter(Boolean))].sort();
  const parcelleCounts = communeNames.map(name => 
    calculateCommuneStats(name, filteredParcellesData).totalParcelles
  );
  
  // Définir les couleurs selon le statut de chaque commune
  const backgroundColors = communeNames.map(name => {
    const config = communesConfig[name.toUpperCase()];
    if (!config) return '#F0F0F0'; // Hors zone
    return config.status === 'active' ? colors.operationsActive : colors.operationsPending;
  });
  
  if (currentCharts.communes) {
    currentCharts.communes.destroy();
  }
  
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
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        },
        x: {
          ticks: {
            maxRotation: 45,
            minRotation: 0
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const communeName = context.label;
              const config = communesConfig[communeName.toUpperCase()];
              let status = 'Hors zone PROCASEF';
              if (config) {
                status = config.status === 'active' ? 'Opérations en cours' : 'Opérations non démarrées';
              }
              return [
                `${context.label}: ${context.parsed.y} parcelle${context.parsed.y > 1 ? 's' : ''} levée${context.parsed.y > 1 ? 's' : ''}`,
                `Statut: ${status}`
              ];
            }
          }
        }
      },
      animation: {
        duration: 1500,
        easing: 'easeInOutQuart'
      }
    }
  });
}

function createGlobalUsageChart() {
  const ctx = document.getElementById('global-usage-chart');
  if (!ctx) return;
  
  const usageStats = filteredParcellesData.reduce((acc, p) => {
    if (p.type_usag) {
      acc[p.type_usag] = (acc[p.type_usag] || 0) + 1;
    }
    return acc;
  }, {});
  
  const labels = Object.keys(usageStats);
  const data = Object.values(usageStats);
  
  // Handle empty data case
  if (labels.length === 0) {
    labels.push('Aucune donnée');
    data.push(1);
  }
  
  if (currentCharts.globalUsage) {
    currentCharts.globalUsage.destroy();
  }
  
  currentCharts.globalUsage = new Chart(ctx, {
    type: 'pie',
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
          position: 'right',
          labels: {
            font: {
              size: 11
            },
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
      animation: {
        animateRotate: true,
        duration: 1500
      }
    }
  });
}

// Event handlers
function initializeEventHandlers() {
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
  
  // Filters
  const communeFilter = document.getElementById('commune-filter');
  const usageFilter = document.getElementById('usage-filter');
  if (communeFilter) communeFilter.addEventListener('change', applyFilters);
  if (usageFilter) usageFilter.addEventListener('change', applyFilters);
  
  // Export data
  const exportData = document.getElementById('export-data');
  if (exportData) exportData.addEventListener('click', exportDataHandler);
}

function switchSection(sectionName) {
  // Update tabs
  document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
  const activeTab = document.querySelector(`[data-section="${sectionName}"]`);
  if (activeTab) activeTab.classList.add('active');
  
  // Update sections
  document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));
  const activeSection = document.getElementById(`${sectionName}-section`);
  if (activeSection) activeSection.classList.add('active');
  
  // Special handling for different sections
  if (sectionName === 'stats') {
    createGlobalCharts();
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
  
  // Réinitialiser l'état de chargement
  if (loading) {
    loading.style.display = 'block';
  }
  
  // Vider l'iframe avant de charger la nouvelle URL
  iframe.src = 'about:blank';
  
  // Petit délai pour assurer le nettoyage
  setTimeout(() => {
    iframe.src = urls[dashboardName] || '';
  }, 100);
  
  // Timeout de sécurité pour masquer le chargement
  const fallbackTimeout = setTimeout(() => {
    if (loading) {
      loading.style.display = 'none';
    }
  }, 10000); // Augmenté à 10 secondes
  
  // Gestionnaire de chargement avec nettoyage du timeout
  iframe.onload = function() {
    clearTimeout(fallbackTimeout);
    if (loading) {
      // Petit délai pour laisser le contenu se stabiliser
      setTimeout(() => {
        loading.style.display = 'none';
      }, 500);
    }
  };
  
  // Gestionnaire d'erreur
  iframe.onerror = function() {
    clearTimeout(fallbackTimeout);
    if (loading) {
      loading.innerHTML = '<p>Erreur de chargement du tableau de bord</p>';
      setTimeout(() => {
        loading.style.display = 'none';
      }, 2000);
    }
  };
}

function toggleTheme() {
  const currentTheme = document.documentElement.dataset.colorScheme || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  
  document.documentElement.dataset.colorScheme = newTheme;
  
  const themeIcon = document.querySelector('.theme-icon');
  if (themeIcon) {
    themeIcon.textContent = newTheme === 'light' ? '🌙' : '☀️';
  }
  
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
  
  // Mettre à jour les statistiques globales
  updateGlobalStats();
  
  // Mettre à jour la carte
  if (communesLayer) {
    loadCommunesLayer();
  }
  
  // Mettre à jour les graphiques globaux si on est sur la section stats
  createGlobalCharts();
  
  showToast(`${filteredParcellesData.length} parcelles trouvées`, 'info');
}

function exportDataHandler() {
  const data = filteredParcellesData;
  const csv = convertToCSV(data);
  downloadCSV(csv, 'parcelles_boundou.csv');
  showToast('Données exportées avec succès', 'success');
}

function convertToCSV(data) {
  if (data.length === 0) return '';
  
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

// Initialize filters
function initializeFilters() {
  const communeSelect = document.getElementById('commune-filter');
  const usageSelect = document.getElementById('usage-filter');
  
  // Vérifier si les éléments existent
  if (!communeSelect || !usageSelect) {
    console.warn('Éléments de filtre non trouvés');
    return;
  }
  
  // Clear existing options
  communeSelect.innerHTML = '<option value="">Toutes les communes</option>';
  usageSelect.innerHTML = '<option value="">Tous les usages</option>';
  
  // *** CORRECTION PRINCIPALE *** 
  // Utiliser toutes les communes qui ont des parcelles, pas seulement celles avec hasOperations: true
  const communes = [...new Set(parcellesData.map(p => p.commune).filter(Boolean))]
    .sort();
    
  console.log('Communes trouvées pour le filtre:', communes); // Debug
    
  communes.forEach(commune => {
    const option = document.createElement('option');
    option.value = commune;
    option.textContent = commune;
    communeSelect.appendChild(option);
  });
  
  // Populate usage filter - avec vérification des valeurs null
  const usageSet = new Set(
    parcellesData.map(p => p.type_usag).filter(Boolean)
  );
  const usages = Array.from(usageSet).sort();
  usages.forEach(usage => {
    const option = document.createElement('option');
    option.value = usage;
    option.textContent = usage.replace(/_/g, ' ');
    usageSelect.appendChild(option);
  });
}

// Update global statistics
function updateGlobalStats() {
  const dataToUse = filteredParcellesData.length > 0 ? filteredParcellesData : parcellesData;
  
  // *** CORRECTION *** 
  // Compter toutes les communes qui ont des parcelles (pas seulement celles avec hasOperations)
  const communesAvecParcelles = new Set(
    dataToUse
      .map(p => p.commune)
      .filter(commune => commune && typeof commune === 'string')
  ).size;
  
  const totalParcelles = dataToUse.length;
  const superficieGlobale = dataToUse.reduce((sum, p) => sum + (parseFloat(p.superficie) || 0), 0);
  const nicadCount = dataToUse.filter(p => p.nicad === 'Oui').length;
  const delibereesCount = dataToUse.filter(p => p.deliberee === 'Oui').length;
  
  // Mettre à jour l'affichage
  const totalCommunesEl = document.getElementById('total-communes');
  const totalParcellesEl = document.getElementById('total-parcelles-global');
  const superficieEl = document.getElementById('superficie-globale');
  const nicadPercentageEl = document.getElementById('nicad-percentage-global');
  const delibereesPercentageEl = document.getElementById('deliberees-percentage-global');
  
  if (totalCommunesEl) totalCommunesEl.textContent = communesAvecParcelles;
  if (totalParcellesEl) totalParcellesEl.textContent = totalParcelles;
  if (superficieEl) superficieEl.textContent = superficieGlobale.toFixed(1);
  
  // Calculer et afficher les pourcentages
  if (nicadPercentageEl && totalParcelles > 0) {
    const nicadPercentage = Math.round((nicadCount / totalParcelles) * 100);
    nicadPercentageEl.textContent = `${nicadPercentage}%`;
  }
  
  if (delibereesPercentageEl && totalParcelles > 0) {
    const delibereesPercentage = Math.round((delibereesCount / totalParcelles) * 100);
    delibereesPercentageEl.textContent = `${delibereesPercentage}%`;
  }
}

// Theme initialization
function initializeTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.dataset.colorScheme = savedTheme;
  
  const themeIcon = document.querySelector('.theme-icon');
  if (themeIcon) {
    themeIcon.textContent = savedTheme === 'light' ? '🌙' : '☀️';
  }
}

// Responsive handling
function handleResize() {
  if (map) {
    setTimeout(() => map.invalidateSize(), 100);
  }
  
  // Redraw charts on resize
  Object.values(currentCharts).forEach(chart => {
    if (chart && chart.resize) {
      chart.resize();
    }
  });
}

// Accessibility enhancements
function initializeAccessibility() {
  // Add keyboard navigation for tabs
  document.querySelectorAll('.tab-button').forEach((tab, index, tabs) => {
    tab.setAttribute('tabindex', index === 0 ? '0' : '-1');
    tab.setAttribute('role', 'tab');
    
    tab.addEventListener('keydown', (e) => {
      let nextIndex;
      
      switch (e.key) {
        case 'ArrowRight':
          nextIndex = (index + 1) % tabs.length;
          break;
        case 'ArrowLeft':
          nextIndex = (index - 1 + tabs.length) % tabs.length;
          break;
        case 'Home':
          nextIndex = 0;
          break;
        case 'End':
          nextIndex = tabs.length - 1;
          break;
        default:
          return;
      }
      
      e.preventDefault();
      tabs[nextIndex].focus();
      tabs[nextIndex].click();
    });
  });
}

// Error handling and retry logic
function retryDataLoad(maxRetries = 3) {
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
      } else {
        throw error;
      }
    }
  }
  
  return attempt();
}

// Performance monitoring
function initializePerformanceMonitoring() {
  if (window.performance && window.performance.mark) {
    window.performance.mark('app-start');
    
    window.addEventListener('load', () => {
      window.performance.mark('app-loaded');
      window.performance.measure('app-load-time', 'app-start', 'app-loaded');
      
      const measure = window.performance.getEntriesByName('app-load-time')[0];
      console.log(`Application loaded in ${measure.duration.toFixed(2)}ms`);
    });
  }
}

// Service Worker registration for offline support
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('Service Worker registered:', registration);
      })
      .catch(error => {
        console.warn('Service Worker registration failed:', error);
      });
  }
}

// Data validation helpers
function validateParcelleData(parcelle) {
  const required = ['id_parcelle', 'commune'];
  const errors = [];
  
  required.forEach(field => {
    if (!parcelle[field]) {
      errors.push(`Champ requis manquant: ${field}`);
    }
  });
  
  // Validate superficie
  if (parcelle.superficie && isNaN(parseFloat(parcelle.superficie))) {
    errors.push('Superficie doit être un nombre');
  }
  
  return errors;
}

// Search functionality
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
    
    searchTimeout = setTimeout(() => {
      performSearch(query);
    }, 300);
  });
}

function performSearch(query) {
  const results = parcellesData.filter(parcelle => {
    return Object.values(parcelle).some(value => {
      return value && value.toString().toLowerCase().includes(query);
    });
  });
  
  displaySearchResults(results.slice(0, 10)); // Limiter à 10 résultats
}

function displaySearchResults(results) {
  const searchResults = document.getElementById('search-results');
  if (!searchResults) return;
  
  if (results.length === 0) {
    searchResults.innerHTML = '<div class="search-no-results">Aucun résultat trouvé</div>';
    return;
  }
  
  const resultsHTML = results.map(parcelle => `
    <div class="search-result-item" onclick="highlightParcelle('${parcelle.id_parcelle}')">
      <div class="search-result-title">${parcelle.id_parcelle}</div>
      <div class="search-result-details">
        ${parcelle.commune} - ${parcelle.village || 'Village non spécifié'}
        <br>
        Superficie: ${parcelle.superficie || 'N/A'} ha
      </div>
    </div>
  `).join('');
  
  searchResults.innerHTML = resultsHTML;
}

function highlightParcelle(parcelleId) {
  const parcelle = parcellesData.find(p => p.id_parcelle === parcelleId);
  if (!parcelle) return;
  
  // Switch to map view
  switchSection('map');
  
  // Show commune details
  showCommuneDetails(parcelle.commune);
  
  // Close search results
  const searchResults = document.getElementById('search-results');
  if (searchResults) searchResults.innerHTML = '';
  
  showToast(`Parcelle ${parcelleId} sélectionnée`, 'success');
}

// Print functionality
function initializePrint() {
  const printButton = document.getElementById('print-button');
  if (printButton) {
    printButton.addEventListener('click', handlePrint);
  }
}

function handlePrint() {
  // Prepare print styles
  document.body.classList.add('printing');
  
  // Trigger print
  window.print();
  
  // Clean up after print
  setTimeout(() => {
    document.body.classList.remove('printing');
  }, 1000);
}

// Data export enhancements
function exportToGeoJSON() {
  const features = filteredParcellesData.map(parcelle => {
    return {
      type: 'Feature',
      properties: { ...parcelle },
      geometry: {
        type: 'Point',
        coordinates: [0, 0] // Placeholder coordinates
      }
    };
  });
  
  const geoJSON = {
    type: 'FeatureCollection',
    features: features
  };
  
  const blob = new Blob([JSON.stringify(geoJSON, null, 2)], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'parcelles_boundou.geojson';
  link.click();
  window.URL.revokeObjectURL(url);
}

// Animation utilities
function fadeIn(element, duration = 300) {
  if (!element) return;
  
  element.style.opacity = '0';
  element.style.display = 'block';
  
  const start = performance.now();
  
  function animate(currentTime) {
    const elapsed = currentTime - start;
    const progress = Math.min(elapsed / duration, 1);
    
    element.style.opacity = progress;
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    }
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
    const progress = Math.min(elapsed / duration, 1);
    
    element.style.height = (targetHeight * progress) + 'px';
    
    if (progress >= 1) {
      element.style.height = 'auto';
      element.style.overflow = 'visible';
    } else {
      requestAnimationFrame(animate);
    }
  }
  
  requestAnimationFrame(animate);
}

// Main initialization function
async function initializeApp() {
  try {
    // Initialize performance monitoring
    initializePerformanceMonitoring();
    
    // Initialize theme
    initializeTheme();
    
    // Load data with retry logic
    await retryDataLoad();
    
    // Initialize components
    initializeMap();
    initializeEventHandlers();
    initializeFilters();
    initializeSearch();
    initializePrint();
    initializeAccessibility();
    
    // Update global statistics
    updateGlobalStats();
    
    // Set up resize handler
    window.addEventListener('resize', handleResize);
    
    // Register service worker for offline support
    registerServiceWorker();
    
    // Show success message
    showToast('Application initialisée avec succès!', 'success');
    
    console.log('Application Boundou Dashboard initialisée');
    
  } catch (error) {
    console.error('Erreur lors de l\'initialisation:', error);
    showToast('Erreur lors du chargement de l\'application', 'error');
  } finally {
    // Masquer l'écran de chargement
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) loadingScreen.classList.add('hidden');
  }
}

// Auto-save functionality for user preferences
function saveUserPreferences() {
  const preferences = {
    theme: document.documentElement.dataset.colorScheme,
    fontScale: fontScale,
    lastActiveSection: document.querySelector('.tab-button.active')?.dataset.section
  };
  
  localStorage.setItem('userPreferences', JSON.stringify(preferences));
}

function loadUserPreferences() {
  const saved = localStorage.getItem('userPreferences');
  if (!saved) return;
  
  try {
    const preferences = JSON.parse(saved);
    
    if (preferences.theme) {
      document.documentElement.dataset.colorScheme = preferences.theme;
    }
    
    if (preferences.fontScale) {
      fontScale = preferences.fontScale;
      document.documentElement.style.setProperty('--font-scale', fontScale);
    }
    
    if (preferences.lastActiveSection) {
      setTimeout(() => switchSection(preferences.lastActiveSection), 100);
    }
  } catch (error) {
    console.warn('Erreur lors du chargement des préférences:', error);
  }
}

// Save preferences on beforeunload
window.addEventListener('beforeunload', saveUserPreferences);

// Load preferences on startup
document.addEventListener('DOMContentLoaded', () => {
  loadUserPreferences();
  initializeApp();
});

// Global error handler
window.addEventListener('error', (event) => {
  console.error('Erreur globale:', event.error);
  showToast('Une erreur inattendue s\'est produite', 'error');
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  console.error('Promise rejetée:', event.reason);
  showToast('Erreur de traitement des données', 'error');
});

// Export functions for external use
window.BoundouDashboard = {
  switchSection,
  showCommuneDetails,
  applyFilters,
  exportDataHandler,
  exportToGeoJSON,
  retryDataLoad
};
