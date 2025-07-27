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

function checkXLSXAvailability() {
  if (typeof XLSX === 'undefined') {
    console.error('XLSX library not loaded');
    window.BoundouDashboard.showToast('Erreur : bibliothèque XLSX non chargée', 'error');
    return false;
  }
  return true;
}

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
  if (!data || data.length === 0) {
    console.warn('Aucune donnée processée disponible');
    return;
  }

  const headers = Object.keys(data[0] || {});
  const validCount = data.length;
  const errorCount = window.BoundouDashboard.originalData ? 
    (window.BoundouDashboard.originalData.slice(1).length - validCount) : 0;

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
  
  // S'assurer que le preview s'affiche
  setTimeout(() => {
    displayPreview(data, type);
  }, 100);
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
      // Correction : gérer correctement les valeurs avec \n
      let displayValue;
      if (typeof value === 'string' && value.includes('\n')) {
        const lines = value.split('\n');
        displayValue = lines.length > 2 ? lines.slice(0, 2).join(', ') + '...' : lines.join(', ');
      } else {
        displayValue = String(value);
      }
      
      // Correction : échapper les guillemets dans le title
      const titleValue = String(value).replace(/"/g, '&quot;').replace(/\n/g, ', ');
      tableHtml += `<td title="${titleValue}">${displayValue}</td>`;
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

// === NOUVELLES FONCTIONS POUR LE TRAITEMENT COLLECTIF ===

// Fonction utilitaire pour trouver l'index d'une colonne
function findColumnIndex(headers, possibleNames) {
  for (const name of possibleNames) {
    const index = headers.findIndex(h => 
      h && h.toString().toLowerCase().trim() === name.toLowerCase()
    );
    if (index !== -1) return index;
  }
  return -1;
}

// Fonction utilitaire pour obtenir la valeur d'une cellule
function getCellValue(row, columnIndex) {
  if (columnIndex === -1 || !row || columnIndex >= row.length) {
    return '';
  }
  const value = row[columnIndex];
  return value !== null && value !== undefined ? String(value).trim() : '';
}

// Fonction pour traiter les données collectives avec regroupement
function processCollectiveData(rawData) {
  if (!rawData || rawData.length <= 1) {
    throw new Error('Données insuffisantes dans le fichier');
  }

  const headers = rawData[0];
  const dataRows = rawData.slice(1);
  
  console.log('Headers trouvés:', headers);
  console.log('Nombre de lignes de données:', dataRows.length);
  
  // Mapping des colonnes importantes
  const columnMapping = {
    'Village': findColumnIndex(headers, ['Village', 'village', 'VILLAGE']),
    'nicad': findColumnIndex(headers, ['nicad', 'NICAD', 'Nicad']),
    'Num_parcel_2': findColumnIndex(headers, ['Num_parcel_2', 'NUM_PARCEL_2', 'numero_parcelle', 'Numero_parcelle']),
    'Prenom': findColumnIndex(headers, ['Prenom', 'PRENOM', 'prénom', 'Prénom', 'prenom']),
    'Nom': findColumnIndex(headers, ['Nom', 'NOM', 'nom']),
    'Sexe': findColumnIndex(headers, ['Sexe', 'SEXE', 'sexe']),
    'Numero_piece': findColumnIndex(headers, ['Numero_piece', 'NUMERO_PIECE', 'numero_piece', 'Num_piece']),
    'Telephone': findColumnIndex(headers, ['Telephone', 'TELEPHONE', 'téléphone', 'Téléphone', 'tel']),
    'Date_naissance': findColumnIndex(headers, ['Date_naissance', 'DATE_NAISSANCE', 'date_naiss', 'Date_naiss']),
    'Residence': findColumnIndex(headers, ['Residence', 'RESIDENCE', 'résidence', 'Résidence']),
    'superficie': findColumnIndex(headers, ['superficie', 'SUPERFICIE', 'Superficie']),
    'Vocation_1': findColumnIndex(headers, ['Vocation_1', 'VOCATION_1', 'Vocation', 'vocation']),
    'type_usa': findColumnIndex(headers, ['type_usa', 'TYPE_USA', 'type_usag', 'Type_usag'])
  };

  console.log('Mapping des colonnes:', columnMapping);

  // Grouper les données par parcelle (nicad + Num_parcel_2)
  const parcelGroups = {};
  
  dataRows.forEach((row, index) => {
    if (!row || row.length === 0) return;
    
    const nicad = getCellValue(row, columnMapping.nicad);
    const numParcel = getCellValue(row, columnMapping.Num_parcel_2);
    const village = getCellValue(row, columnMapping.Village);
    
    if (!nicad && !numParcel) {
      console.warn(`Ligne ${index + 2}: nicad et Num_parcel_2 manquants`);
      return;
    }
    
    const parcelKey = `${village}_${nicad}_${numParcel}`;
    
    if (!parcelGroups[parcelKey]) {
      parcelGroups[parcelKey] = {
        Village: village,
        nicad: nicad,
        Num_parcel_2: numParcel,
        superficie: getCellValue(row, columnMapping.superficie),
        Vocation_1: getCellValue(row, columnMapping.Vocation_1),
        type_usa: getCellValue(row, columnMapping.type_usa),
        Residence: getCellValue(row, columnMapping.Residence),
        affectataires: []
      };
    }
    
    // Ajouter l'affectataire s'il a des informations personnelles
    const prenom = getCellValue(row, columnMapping.Prenom);
    const nom = getCellValue(row, columnMapping.Nom);
    
    if (prenom || nom) {
      parcelGroups[parcelKey].affectataires.push({
        Prenom: prenom,
        Nom: nom,
        Sexe: getCellValue(row, columnMapping.Sexe),
        Numero_piece: getCellValue(row, columnMapping.Numero_piece),
        Telephone: getCellValue(row, columnMapping.Telephone),
        Date_naissance: getCellValue(row, columnMapping.Date_naissance)
      });
    }
  });

  // Convertir en format de sortie avec affectataires regroupés
  const processedData = [];
  
  Object.values(parcelGroups).forEach(parcel => {
    if (parcel.affectataires.length === 0) {
      // Parcelle sans affectataires identifiés - créer une entrée vide
      processedData.push({
        Village: parcel.Village,
        nicad: parcel.nicad,
        Num_parcel_2: parcel.Num_parcel_2,
        Prenom: '',
        Nom: '',
        Sexe: '',
        Numero_piece: '',
        Telephone: '',
        Date_naissance: '',
        Residence: parcel.Residence,
        superficie: parcel.superficie,
        Vocation_1: parcel.Vocation_1,
        type_usa: parcel.type_usa
      });
    } else {
      // Regrouper tous les affectataires dans une seule ligne
      processedData.push({
        Village: parcel.Village,
        nicad: parcel.nicad,
        Num_parcel_2: parcel.Num_parcel_2,
        Prenom: parcel.affectataires.map(a => a.Prenom).filter(p => p).join('\n'),
        Nom: parcel.affectataires.map(a => a.Nom).filter(n => n).join('\n'),
        Sexe: parcel.affectataires.map(a => a.Sexe).filter(s => s).join('\n'),
        Numero_piece: parcel.affectataires.map(a => a.Numero_piece).filter(n => n).join('\n'),
        Telephone: parcel.affectataires.map(a => a.Telephone).filter(t => t).join('\n'),
        Date_naissance: parcel.affectataires.map(a => a.Date_naissance).filter(d => d).join('\n'),
        Residence: parcel.Residence,
        superficie: parcel.superficie,
        Vocation_1: parcel.Vocation_1,
        type_usa: parcel.type_usa
      });
    }
  });

  console.log(`Traitement terminé: ${processedData.length} parcelles regroupées`);
  return processedData;
}

// Fonction de diagnostic pour analyser la structure du fichier
function analyzeFileStructure(rawData) {
  if (!rawData || rawData.length === 0) {
    return { error: 'Fichier vide' };
  }

  const headers = rawData[0];
  const dataRows = rawData.slice(1).filter(row => row && row.length > 0);
  
  const analysis = {
    totalRows: dataRows.length,
    headers: headers,
    headerCount: headers.length,
    sampleRows: dataRows.slice(0, 3),
    emptyColumns: [],
    filledColumns: []
  };

  // Analyser chaque colonne
  headers.forEach((header, index) => {
    const hasData = dataRows.some(row => {
      const value = row[index];
      return value !== null && value !== undefined && String(value).trim() !== '';
    });
    
    if (hasData) {
      analysis.filledColumns.push({ name: header, index });
    } else {
      analysis.emptyColumns.push({ name: header, index });
    }
  });

  return analysis;
}

// === INTÉGRATION AVEC BOUNDOU DASHBOARD ===

// S'assurer que BoundouDashboard existe
window.BoundouDashboard = window.BoundouDashboard || {};

// Fonction mise à jour pour traiter les fichiers collectifs
window.BoundouDashboard.processCollectiveFile = async function(file) {
  if (!checkXLSXAvailability()) return;
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Diagnostic de la structure
        const analysis = analyzeFileStructure(rawData);
        console.log('Analyse de la structure du fichier:', analysis);
        
        // Traitement des données collectives
        const processedData = processCollectiveData(rawData);
        
        // Stocker les données
        window.BoundouDashboard.originalData = rawData;
        window.BoundouDashboard.processedDeliberationData = processedData;
        
        window.BoundouDashboard.showToast(`Fichier collectif traité avec succès: ${processedData.length} parcelles`, 'success');
        resolve(processedData);
        
      } catch (error) {
        console.error('Erreur lors du traitement du fichier collectif:', error);
        window.BoundouDashboard.showToast(`Erreur: ${error.message}`, 'error');
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
    reader.readAsArrayBuffer(file);
  });
};

// Fonction pour traiter les fichiers individuels (si elle n'existe pas déjà)
window.BoundouDashboard.processIndividualFile = window.BoundouDashboard.processIndividualFile || async function(file) {
  if (!checkXLSXAvailability()) return;
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Traitement simple pour les fichiers individuels
        if (rawData.length <= 1) {
          throw new Error('Fichier vide ou sans données');
        }
        
        const headers = rawData[0];
        const processedData = rawData.slice(1).map(row => {
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] || '';
          });
          return obj;
        }).filter(row => Object.values(row).some(val => val && String(val).trim()));
        
        // Stocker les données
        window.BoundouDashboard.originalData = rawData;
        window.BoundouDashboard.processedDeliberationData = processedData;
        
        window.BoundouDashboard.showToast(`Fichier individuel traité avec succès: ${processedData.length} lignes`, 'success');
        resolve(processedData);
        
      } catch (error) {
        console.error('Erreur lors du traitement du fichier individuel:', error);
        window.BoundouDashboard.showToast(`Erreur: ${error.message}`, 'error');
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
    reader.readAsArrayBuffer(file);
  });
};

// Export du module
window.DeliberationListGenerator = {
  initializeDeliberationHandlers,
  handleFiles,
  displayFileInfo,
  displayPreview,
  colonnesAConserver,
  getOrderedColumns,
  processCollectiveData,
  analyzeFileStructure,
  findColumnIndex,
  getCellValue
};

// Initialisation automatique
//document.addEventListener('DOMContentLoaded', () => {
//  if (typeof window.DeliberationListGenerator.initializeDeliberationHandlers === 'function') {
//    window.DeliberationListGenerator.initializeDeliberationHandlers();
//  }
//});
