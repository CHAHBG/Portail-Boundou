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
  const uploadSectionIndividual = document.getElementById('uploadSectionIndividual');
  const uploadSectionCollective = document.getElementById('uploadSectionCollective');
  const fileInputIndividual = document.getElementById('individual-file');
  const fileInputCollective = document.getElementById('collective-file');
  const processBtnIndividual = document.getElementById('generate-individual');
  const processBtnCollective = document.getElementById('generate-collective');
  const resetBtn = document.getElementById('reset-deliberation');

  if (!uploadSectionIndividual || !uploadSectionCollective || !fileInputIndividual || !fileInputCollective) {
    console.error('Éléments nécessaires pour le drag & drop non trouvés');
    window.BoundouDashboard.showToast('Erreur : conteneur de téléchargement non trouvé', 'error');
    return;
  }

  // Configuration du drag & drop
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    uploadSectionIndividual.addEventListener(eventName, preventDefaults, false);
    uploadSectionCollective.addEventListener(eventName, preventDefaults, false);
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    uploadSectionIndividual.addEventListener(eventName, highlightIndividual, false);
    uploadSectionCollective.addEventListener(eventName, highlightCollective, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    uploadSectionIndividual.addEventListener(eventName, unhighlightIndividual, false);
    uploadSectionCollective.addEventListener(eventName, unhighlightCollective, false);
  });

  uploadSectionIndividual.addEventListener('drop', (e) => handleDrop(e, 'individual'), false);
  uploadSectionCollective.addEventListener('drop', (e) => handleDrop(e, 'collective'), false);

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

function highlightIndividual(e) {
  const uploadSection = document.getElementById('uploadSectionIndividual');
  uploadSection.classList.add('dragover');
}

function highlightCollective(e) {
  const uploadSection = document.getElementById('uploadSectionCollective');
  uploadSection.classList.add('dragover');
}

function unhighlightIndividual(e) {
  const uploadSection = document.getElementById('uploadSectionIndividual');
  uploadSection.classList.remove('dragover');
}

function unhighlightCollective(e) {
  const uploadSection = document.getElementById('uploadSectionCollective');
  uploadSection.classList.remove('dragover');
}

function handleDrop(e, type) {
  const dt = e.dataTransfer;
  const files = dt.files;
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
    document.getElementById(`fileName${type === 'individual' ? 'Individual' : 'Collective'}`).textContent = `📄 ${file.name}`;
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
  const validCount = data.length;
  const errorCount = originalData ? (originalData.slice(1).length - validCount) : 0;

  const infoHtml = `
    <div class="info-section">
      <h3>📊 Informations du fichier</h3>
      <div class="stats">
        <div class="stat-card">
          <h3>${data.length}</h3>
          <p>Parcelles valides</p>
        </div>
        <div class="stat-card">
          <h3>${errorCount}</h3>
          <p>Parcelles avec erreurs</p>
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
  const fileInfo = document.getElementById(`fileInfo${type === 'individual' ? 'Individual' : 'Collective'}`);
  if (fileInfo) {
    fileInfo.innerHTML = infoHtml;
    fileInfo.style.display = 'block';
  }
  displayPreview(data, type);
}

function displayPreview(data, type) {
  if (!data || data.length === 0) return;
  const previewData = data.slice(0, 3);
  const columns = getOrderedColumns(data, type);
  let tableHtml = `
    <div class="info-section">
      <h3>👀 Aperçu des données (3 premières lignes)</h3>
      <p><strong>Format de sortie :</strong> ${type === 'individual' ? 'Une ligne par parcelle' : 'Tous les affectataires regroupés'}</p>
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
      console.log(`Column: ${col}, Value: ${value}, Type: ${typeof value}`);
      const displayValue = typeof value === 'string' && value.includes('\n') ? value.split('\n')[0] + '...' : String(value); // Modified
      tableHtml += `<td title="${String(value).replace(/\n/g, ', ')}">${displayValue}</td>`; // Modified
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
  const preview = document.getElementById(`preview${type === 'individual' ? 'Individual' : 'Collective'}`);
  if (preview) {
    preview.innerHTML = tableHtml;
    preview.style.display = 'block';
  }
}

function getOrderedColumns(data, type) {
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
  displayPreview,
  colonnesAConserver,
  getOrderedColumns
};

// Initialisation automatique
//document.addEventListener('DOMContentLoaded', () => {
//  window.DeliberationListGenerator.initializeDeliberationHandlers();
//});
