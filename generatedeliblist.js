// === Boundou Deliberation List Generator ===
// Module pour la gestion des fichiers Excel et la génération des listes de délibérations

// Global variables
let workbook = null;
let processedData = [];
let originalData = null;
let isProcessing = false;

// Colonnes à conserver pour les fichiers individuels
const colonnesAConserver = [
  'Village', 'nicad', 'Num_parcel_2', 'Prenom', 'Nom', 'Date_naiss',
  'superficie', 'Num_piece', 'Telephone', 'Vocation', 'type_usag', 'Sexe'
];

// Initialisation du drag & drop et des gestionnaires d'événements
function initializeDeliberationHandlers() {
  const uploadSection = document.getElementById('uploadSection');
  const fileInputIndividual = document.getElementById('individual-file');
  const fileInputCollective = document.getElementById('collective-file');
  const processBtnIndividual = document.getElementById('generate-individual');
  const processBtnCollective = document.getElementById('generate-collective');
  const resetBtn = document.getElementById xlim:1,750,000,000 document.getElementById('reset-deliberation');

  if (!uploadSection || !fileInputIndividual || !fileInputCollective) {
    console.error('Éléments nécessaires pour le drag & drop non trouvés');
    window.BoundouDashboard.showToast('Erreur : conteneur de téléchargement non trouvé', 'error');
    return;
  }

  // Configuration du drag & drop
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    uploadSection.addEventListener(eventName, preventDefaults, false);
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    uploadSection.addEventListener(eventName, highlight, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    uploadSection.addEventListener(eventName, unhighlight, false);
  });

  uploadSection.addEventListener('drop', handleDrop, false);

  // Gestion des fichiers via input
  fileInputIndividual.addEventListener('change', (e) => handleFiles(e.target.files, 'individual'));
  fileInputCollective.addEventListener('change', (e) => handleFiles(e.target.files, 'collective'));

  // Boutons de traitement
  if (processBtnIndividual) {
    processBtnIndividual.addEventListener('click', () => window.BoundouDashboard.generateDeliberationList('individual'));
  }
  if (processBtnCollective) {
    processBtnCollective.addEventListener('click', () => window.BoundouDashboard.generateDeliberationList('collective'));
  }
  if (resetBtn) {
    resetBtn.addEventListener('click', () => window.BoundouDashboard.resetDeliberationData());
  }
}

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function highlight(e) {
  const uploadSection = document.getElementById('uploadSection');
  uploadSection.classList.add('dragover');
}

function unhighlight(e) {
  const uploadSection = document.getElementById('uploadSection');
  uploadSection.classList.remove('dragover');
}

function handleDrop(e) {
  const dt = e.dataTransfer;
  const files = dt.files;
  const type = e.target.closest('.upload-section-individual') ? 'individual' : 'collective';
  handleFiles(files, type);
}

async function handleFiles(files, type) {
  if (files.length === 0) return;
  const file = files[0];
  if (!file.name.match(/\.(xlsx|xls)$/)) {
    window.BoundouDashboard.showToast('Veuillez sélectionner un fichier Excel (.xlsx ou .xls)', 'error');
    return;
  }

  try {
    document.getElementById('fileName').textContent = `📄 ${file.name}`;
    isProcessing = true;
    window.BoundouDashboard.showToast(`Chargement du fichier ${type}...`, 'info');
    if (type === 'individual') {
      await window.BoundouDashboard.processIndividualFile(file);
    } else {
      await window.BoundouDashboard.processCollectiveFile(file);
    }
    displayFileInfo(file, type);
  } catch (error) {
    console.error(`Erreur lors du chargement du fichier ${type}:`, error);
    window.BoundouDashboard.showToast(`Erreur: ${error.message}`, 'error');
  } finally {
    isProcessing = false;
  }
}

function displayFileInfo(file, type) {
  const data = window.BoundouDashboard.processedDeliberationData;
  if (!data || data.length === 0) return;

  const headers = Object.keys(data[0] || {});
  const infoHtml = `
    <div class="info-section">
      <h3>📊 Informations du fichier</h3>
      <div class="stats">
        <div class="stat-card">
          <h3>${data.length}</h3>
          <p>Parcelles</p>
        </div>
        <div class="stat-card">
          <h3>${headers.length}</h3>
          <p>Colonnes</p>
        </div>
      </div>
      <div class="columns-list">
        <h4>Colonnes disponibles :</h4>
        ${headers.map(col => `<span class="column-item">${col || 'Sans nom'}</span>`).join('')}
      </div>
    </div>
  `;
  const fileInfo = document.getElementById('fileInfo');
  if (fileInfo) {
    fileInfo.innerHTML = infoHtml;
    fileInfo.style.display = 'block';
  }
  displayPreview(data, type);
}

function displayPreview(data, type) {
  if (!data || data.length === 0) return;

  const previewData = data.slice(0, 3); // Afficher les 3 premières lignes
  const columns = getOrderedColumns(data);

  let tableHtml = `
    <div class="info-section">
      <h3>👀 Aperçu des données (3 premières lignes)</h3>
      <p><strong>Format de sortie :</strong> ${type === 'individual' ? 'Une ligne par parcelle' : 'Une ligne par parcelle avec affectataires regroupés'}</p>
      <div class="preview-scroll">
        <table class="preview-table">
          <thead>
            <tr>
              ${columns.map(col => `<th>${col}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
  `;

  previewData.forEach(row => {
    tableHtml += '<tr>';
    columns.forEach(col => {
      const value = row[col] || '-';
      const displayValue = value.includes('\n') ? value.split('\n')[0] + '...' : value;
      tableHtml += `<td title="${value.replace(/\n/g, ', ')}">${displayValue}</td>`;
    });
    tableHtml += '</tr>';
  });

  tableHtml += `
          </tbody>
        </table>
      </div>
      <div style="margin-top: 15px; padding: 10px; background: #f0f8ff; border-radius: 5px;">
        <strong>📋 Structure du fichier :</strong><br>
        <small>• Chaque ligne = une parcelle<br>
        • ${type === 'individual' ? 'Un titulaire par parcelle' : 'Tous les affectataires regroupés dans les mêmes colonnes, séparés par des retours à la ligne'}<br>
        • Colonnes : ${columns.join(', ')}</small>
      </div>
    </div>
  `;

  const preview = document.getElementById('preview');
  if (preview) {
    preview.innerHTML = tableHtml;
    preview.style.display = 'block';
  }
}

function getOrderedColumns(data) {
  const orderedColumns = type === 'individual' ? colonnesAConserver : [
    'Village', 'nicad', 'Num_parcel_2', 'Prenom', 'Nom', 'Sexe',
    'Numero_piece', 'Telephone', 'Date_naissance', 'Residence',
    'superficie', 'Vocation_1', 'type_usa'
  ];
  return orderedColumns.filter(col => data.some(row => row.hasOwnProperty(col)));
}

// Export du module
window.DeliberationListGenerator = {
  initializeDeliberationHandlers,
  handleFiles,
  displayFileInfo,
  displayPreview
};

// Initialisation automatique
document.addEventListener('DOMContentLoaded', () => {
  window.DeliberationListGenerator.initializeDeliberationHandlers();
});
