// === Boundou Deliberation List Generator ===
// Module pour la gestion des fichiers Excel et la génération des listes de délibérations

// Colonnes à conserver pour les fichiers individuels
const colonnesAConserver = [
    'Village', 'nicad', 'Num_parcel_2', 'Prenom', 'Nom', 'Date_naiss',
    'superficie', 'Num_piece', 'Telephone', 'Vocation', 'type_usag', 'Sexe'
];

// Initialisation des gestionnaires d'événements
function initializeDeliberationHandlers() {
    const uploadSection = document.getElementById('uploadSection');
    const fileInput = document.getElementById('fileInput');
    const processBtn = document.getElementById('processBtn');
    const resetBtn = document.getElementById('reset-deliberation');

    if (!uploadSection || !fileInput) {
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

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function highlight(e) {
        uploadSection.classList.add('dragover');
    }

    function unhighlight(e) {
        uploadSection.classList.remove('dragover');
    }

    uploadSection.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    // Gestion des fichiers via input
    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

    // Bouton de traitement
    if (processBtn) {
        processBtn.addEventListener('click', processFile);
    }

    // Bouton de réinitialisation
    if (resetBtn) {
        resetBtn.addEventListener('click', () => window.BoundouDashboard.resetDeliberationData());
    }
}

function handleFiles(files) {
    if (files.length === 0) return;
    const file = files[0];
    if (!file.name.match(/\.(xlsx|xls)$/)) {
        window.BoundouDashboard.showToast('Veuillez sélectionner un fichier Excel (.xlsx ou .xls)', 'error');
        return;
    }

    document.getElementById('fileName').textContent = `📄 ${file.name}`;
    window.BoundouDashboard.loadExcelFile(file);
}

function displayFileInfo(data) {
    if (!data || data.length === 0) {
        window.BoundouDashboard.showToast('Aucune donnée valide trouvée dans le fichier', 'error');
        return;
    }

    const headers = data[0];
    const dataRows = data.slice(1);
    const validCount = window.BoundouDashboard.processedDeliberationData.length;

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
    const fileInfo = document.getElementById('fileInfo');
    if (fileInfo) {
        fileInfo.innerHTML = infoHtml;
        fileInfo.style.cssText = 'display: block !important;';
    }
}

function displayResults(totalRows, validCount, errorCount) {
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
        </div>
    `;
    const results = document.getElementById('results');
    if (results) {
        results.innerHTML = resultsHtml;
        results.style.cssText = 'display: block !important;';
        document.getElementById('downloadBtn').style.display = 'inline-block';
    }
    displayPreview();
}

function displayPreview() {
    const data = window.BoundouDashboard.processedDeliberationData;
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
                • Tous les affectataires regroupés dans les mêmes colonnes, séparés par des retours à la ligne<br>
                • Colonnes : ${columns.join(', ')}</small>
            </div>
        </div>
    `;
    const preview = document.getElementById('preview');
    if (preview) {
        preview.innerHTML = tableHtml;
        preview.style.cssText = 'display: block !important;';
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

function processFile() {
    if (!window.BoundouDashboard.originalData || window.BoundouDashboard.originalData.length === 0) {
        window.BoundouDashboard.showToast('Aucun fichier chargé', 'error');
        return;
    }

    const processBtn = document.getElementById('processBtn');
    const processText = document.getElementById('processText');
    processText.innerHTML = '<span class="loading"></span>Traitement en cours...';
    processBtn.disabled = true;

    setTimeout(() => {
        try {
            const headers = window.BoundouDashboard.originalData[0];
            const dataRows = window.BoundouDashboard.originalData.slice(1);
            const results = window.BoundouDashboard.processCollectiveData(window.BoundouDashboard.originalData);
            window.BoundouDashboard.processedDeliberationData = results;

            const totalRows = dataRows.length;
            const validCount = results.length;
            const errorCount = totalRows - validCount;

            displayFileInfo(window.BoundouDashboard.originalData);
            displayResults(totalRows, validCount, errorCount);
            processBtn.disabled = false;
            processText.innerHTML = 'Traiter le fichier';
            window.BoundouDashboard.showToast(`Traitement terminé : ${validCount} parcelles valides`, 'success');
        } catch (error) {
            console.error('Erreur lors du traitement:', error);
            window.BoundouDashboard.showToast('Erreur lors du traitement du fichier', 'error');
            processBtn.disabled = false;
            processText.innerHTML = 'Traiter le fichier';
        }
    }, 100);
}

// Export du module
window.DeliberationListGenerator = {
    initializeDeliberationHandlers,
    handleFiles,
    displayFileInfo,
    displayPreview,
    colonnesAConserver,
    getOrderedColumns,
    processFile
};
