// === Boundou Deliberation List Generator ===
// Module pour la gestion des fichiers Excel et la génération des listes de délibérations

// Colonnes à conserver pour les fichiers individuels
const colonnesAConserver = [
    'Village', 'nicad', 'Num_parcel_2', 'Prenom', 'Nom', 'Date_naiss',
    'superficie', 'Num_piece', 'Telephone', 'Vocation', 'type_usag', 'Sexe'
];

// Initialisation des gestionnaires d'événements
function initializeDeliberationHandlers() {
    const uploadSectionIndividual = document.getElementById('uploadSectionIndividual');
    const uploadSectionCollective = document.getElementById('uploadSectionCollective');
    const fileInputIndividual = document.getElementById('individual-file');
    const fileInputCollective = document.getElementById('collective-file');

    if (!uploadSectionIndividual || !uploadSectionCollective || !fileInputIndividual || !fileInputCollective) {
        console.error('Éléments nécessaires pour le drag & drop non trouvés');
        window.BoundouDashboard.showToast('Erreur : conteneur de téléchargement non trouvé', 'error');
        return;
    }

    // Configuration du drag & drop pour individuel
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadSectionIndividual.addEventListener(eventName, preventDefaults, false);
        uploadSectionCollective.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        uploadSectionIndividual.addEventListener(eventName, () => highlight('individual'), false);
        uploadSectionCollective.addEventListener(eventName, () => highlight('collective'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadSectionIndividual.addEventListener(eventName, () => unhighlight('individual'), false);
        uploadSectionCollective.addEventListener(eventName, () => unhighlight('collective'), false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function highlight(type) {
        document.getElementById(`uploadSection${type.charAt(0).toUpperCase() + type.slice(1)}`).classList.add('dragover');
    }

    function unhighlight(type) {
        document.getElementById(`uploadSection${type.charAt(0).toUpperCase() + type.slice(1)}`).classList.remove('dragover');
    }

    uploadSectionIndividual.addEventListener('drop', (e) => handleDrop(e, 'individual'), false);
    uploadSectionCollective.addEventListener('drop', (e) => handleDrop(e, 'collective'), false);

    function handleDrop(e, type) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files, type);
    }

    // Gestion des fichiers via input
    fileInputIndividual.addEventListener('change', (e) => handleFiles(e.target.files, 'individual'));
    fileInputCollective.addEventListener('change', (e) => handleFiles(e.target.files, 'collective'));
}

function handleFiles(files, type) {
    if (files.length === 0) return;
    const file = files[0];
    if (!file.name.match(/\.(xlsx|xls)$/)) {
        window.BoundouDashboard.showToast('Veuillez sélectionner un fichier Excel (.xlsx ou .xls)', 'error');
        return;
    }

    document.getElementById(`fileName${type.charAt(0).toUpperCase() + type.slice(1)}`).textContent = `📄 ${file.name}`;
    window.BoundouDashboard.loadExcelFile(file, type);
}

function displayFileInfo(data, type) {
    if (!['individual', 'collective'].includes(type)) {
        console.error('Type de fichier invalide:', type);
        window.BoundouDashboard.showToast('Erreur : type de fichier invalide', 'error');
        return;
    }

    if (!data || data.length === 0) {
        window.BoundouDashboard.showToast('Aucune donnée valide trouvée dans le fichier', 'error');
        return;
    }

    const headers = data[0];
    const dataRows = data.slice(1);
    const validCount = type === 'individual' ? window.BoundouDashboard.processedIndividualData.length : window.BoundouDashboard.processedCollectiveData.length;

    const infoHtml = `
        <div class="info-section">
            <h3>📊 Informations du fichier</h3>
            <div class="stats">
                <div class="stat-card">
                    <h3>${dataRows.length}</h3>
                    <p>Lignes de données</p>
                </div>
                <div class="stat-card">
                    <h3>${validCount}</h3>
                    <p>Parcelles valides</p>
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
    const fileInfo = document.getElementById(`fileInfo${type.charAt(0).toUpperCase() + type.slice(1)}`);
    if (fileInfo) {
        fileInfo.innerHTML = infoHtml;
        fileInfo.style.cssText = 'display: block !important;';
    }
}

function displayResults(totalRows, validCount, errorCount, collectiveErrors = [], type) {
    if (!['individual', 'collective'].includes(type)) {
        console.error('Type de fichier invalide:', type);
        window.BoundouDashboard.showToast('Erreur : type de fichier invalide', 'error');
        return;
    }

    let errorsHtml = '';
    if (type === 'collective' && collectiveErrors.length > 0) {
        errorsHtml = `
            <div class="error-details">
                <h4>⚠️ Parcelles exclues (moins de 2 individus) :</h4>
                <ul>
                    ${collectiveErrors.map(error => `<li>${error}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    const resultsHtml = `
        <div class="results-section">
            <h3>✅ Traitement terminé</h3>
            <div class="stats">
                <div class="stat-card">
                    <h3>${totalRows}</h3>
                    <p>Parcelles traitées</p>
                </div>
                <div class="stat-card">
                    <h3>${validCount}</h3>
                    <p>Parcelles valides</p>
                </div>
                <div class="stat-card">
                    <h3>${errorCount}</h3>
                    <p>Parcelles avec erreurs</p>
                </div>
            </div>
            ${errorsHtml}
        </div>
    `;
    const results = document.getElementById(`results${type.charAt(0).toUpperCase() + type.slice(1)}`);
    if (results) {
        results.innerHTML = resultsHtml;
        results.style.cssText = 'display: block !important;';
    }
    displayPreview(type);
}

function displayPreview(type) {
    if (!['individual', 'collective'].includes(type)) {
        console.error('Type de fichier invalide:', type);
        window.BoundouDashboard.showToast('Erreur : type de fichier invalide', 'error');
        return;
    }

    const data = type === 'individual' ? window.BoundouDashboard.processedIndividualData : window.BoundouDashboard.processedCollectiveData;
    if (!data || data.length === 0) {
        console.warn('Aucune donnée pour l\'aperçu');
        window.BoundouDashboard.showToast('Aucune donnée à afficher dans l\'aperçu', 'warning');
        return;
    }

    const previewData = data.slice(0, 3);
    const columns = getOrderedColumns(data);

    let tableHtml = `
        <div class="info-section">
            <h3>👀 Aperçu des données (3 premières lignes)</h3>
            <p><strong>Format de sortie :</strong> Chaque parcelle sur une ligne avec tous les individus en colonnes séparées</p>
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
            const displayValue = value.includes('\n');
            tableHtml += `<td title="${value.replace(/\n/g, ', ')}>${displayValue}</td>`;
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
                • Tous les affectataires regroupés dans les mêmes colonnes, séparés par des retours à la ligne<br>
                • Colonnes : ${columns.join(', ')}</small>
            </div>
        </div>
    `;
    const previewDiv = document.getElementById(`preview${type.charAt(0).toUpperCase() + type.slice(1)}`);
    if (previewDiv) {
        previewDiv.innerHTML = tableHtml;
        previewDiv.style.cssText = 'display: block !important;';
    } else {
        console.error('Element preview non trouvé');
        window.BoundouDashboard.showToast('Erreur : conteneur d\'aperçu non trouvé', 'error');
    }
}

function getOrderedColumns(data) {
    const orderedColumns = [
        'Village', 'nicad', 'Num_parcel_2', 'Prenom', 'Nom', 'Sexe',
        'Numero_piece', 'Telephone', 'Date_naissance', 'Residence',
        'superficie', 'Vocation_1', 'type_usa'
    ];
    const availableColumns = orderedColumns.filter(col => data.some(row => row.hasOwnProperty(col)));
    console.log('Colonnes disponibles :', availableColumns);
    return availableColumns;
}

// Export du module
window.DeliberationListGenerator = {
    initializeDeliberationHandlers,
    handleFiles,
    displayFileInfo,
    displayResults,
    displayPreview,
    colonnesAConserver,
    getSortedColumns
};
